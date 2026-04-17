import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { extractPdfText, type PdfExtraction } from "./pdf";
import { chunkPages, type TextChunk } from "./chunker";
import { db } from "./db";
import { policies, policyChunks } from "./db/schema";
import { uploadPdf } from "./blob";
import { eq } from "drizzle-orm";

export interface IngestResult {
  policyId: string;
  fileName: string;
  folderId: string;
  pageCount: number;
  chunkCount: number;
  summary: string;
  structuredSummary: string;
}

/**
 * Extract text and create chunks from a PDF buffer.
 */
export async function extractAndChunkAsync(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<{
  extraction: PdfExtraction;
  chunks: TextChunk[];
}> {
  const extraction = await extractPdfText(buffer);
  const chunks = chunkPages(extraction.pages);
  return { extraction, chunks };
}

/**
 * Generate a structured summary of a policy document using Claude Haiku.
 * Returns a concise summary of key provisions, requirements, and prohibitions.
 */
export async function generatePolicySummary(
  fullText: string,
  fileName: string
): Promise<{ summary: string; structuredSummary: string }> {
  const truncatedText =
    fullText.length > 30000 ? fullText.slice(0, 30000) + "\n...[truncated]" : fullText;

  const { text: summary } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    maxOutputTokens: 300,
    system:
      "You are a healthcare compliance analyst. Summarize the policy document in 2-3 sentences focusing on what it covers, requires, and prohibits.",
    prompt: `Policy: ${fileName}\n\n${truncatedText}`,
  });

  const { text: structuredSummary } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    maxOutputTokens: 500,
    system: `You are a healthcare compliance analyst. Extract the key provisions from this policy as a JSON object with these fields:
- "provisions": array of key things the policy establishes or allows
- "requirements": array of things the policy requires (must/shall statements)
- "prohibitions": array of things the policy prohibits or restricts
Keep each item to one sentence. Maximum 5 items per field.`,
    prompt: `Policy: ${fileName}\n\n${truncatedText}`,
  });

  return { summary, structuredSummary };
}

/**
 * Full ingestion pipeline for a single policy PDF.
 * Extracts text, chunks, generates embeddings and summaries, stores everything.
 */
export async function ingestPolicy(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  fileName: string,
  folderId: string
): Promise<IngestResult> {
  // 1. Extract text and chunk
  const { extraction, chunks } = await extractAndChunkAsync(buffer);

  // 2. Upload PDF to Blob storage
  const blobUrl = await uploadPdf(fileName, buffer as Uint8Array, "policies");

  // 3. Generate summaries via Haiku (used for triage matching)
  const { summary, structuredSummary } = await generatePolicySummary(
    extraction.text,
    fileName
  );

  // 4. Store policy record
  const [policy] = await db
    .insert(policies)
    .values({
      folderId,
      fileName,
      blobUrl,
      summary,
      structuredSummary,
      pageCount: extraction.totalPages,
      tokenCount: Math.ceil(extraction.text.length / 4),
      isIngested: true,
      ingestedAt: new Date(),
    })
    .returning({ id: policies.id });

  // 5. Store chunks (no embeddings — using Haiku triage instead)
  if (chunks.length > 0) {
    await db.insert(policyChunks).values(
      chunks.map((chunk) => ({
        policyId: policy.id,
        chunkIndex: chunk.index,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        content: chunk.content,
        sectionHeader: chunk.sectionHeader,
        tokenCount: chunk.tokenCount,
      }))
    );
  }

  return {
    policyId: policy.id,
    fileName,
    folderId,
    pageCount: extraction.totalPages,
    chunkCount: chunks.length,
    summary,
    structuredSummary,
  };
}

/**
 * Check if a policy has already been ingested (by fileName + folderId).
 */
export async function isPolicyIngested(
  fileName: string,
  folderId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: policies.id })
    .from(policies)
    .where(eq(policies.fileName, fileName))
    .limit(1);
  return existing.length > 0;
}
