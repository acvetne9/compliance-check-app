import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { policyChunks } from "@/lib/db/schema";
import { sql, cosineDistance, desc } from "drizzle-orm";

const embeddingModel = openai.embedding("text-embedding-3-small");

/**
 * Generate an embedding for a single text string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text });
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch.
 * Processes in parallel with a concurrency limit of 10.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
    maxParallelCalls: 10,
  });
  return embeddings;
}

export interface SimilarChunk {
  id: string;
  policyId: string;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  content: string;
  sectionHeader: string | null;
  tokenCount: number;
  similarity: number;
}

/**
 * Search for policy chunks most similar to a query embedding.
 * Uses pgvector cosine distance for fast similarity search.
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  options: { limit?: number; minSimilarity?: number } = {}
): Promise<SimilarChunk[]> {
  const { limit = 15, minSimilarity = 0.3 } = options;

  const similarity = sql<number>`1 - (${cosineDistance(policyChunks.embedding, queryEmbedding)})`;

  const results = await db
    .select({
      id: policyChunks.id,
      policyId: policyChunks.policyId,
      chunkIndex: policyChunks.chunkIndex,
      pageStart: policyChunks.pageStart,
      pageEnd: policyChunks.pageEnd,
      content: policyChunks.content,
      sectionHeader: policyChunks.sectionHeader,
      tokenCount: policyChunks.tokenCount,
      similarity,
    })
    .from(policyChunks)
    .where(sql`1 - (${cosineDistance(policyChunks.embedding, queryEmbedding)}) > ${minSimilarity}`)
    .orderBy(desc(similarity))
    .limit(limit);

  return results;
}

/**
 * Search for similar chunks, embedding the query text first.
 */
export async function searchByText(
  queryText: string,
  options: { limit?: number; minSimilarity?: number } = {}
): Promise<SimilarChunk[]> {
  const embedding = await generateEmbedding(queryText);
  return searchSimilarChunks(embedding, options);
}
