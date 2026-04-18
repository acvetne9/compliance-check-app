/**
 * Embeddings module — replaced with Haiku-based relevance matching.
 *
 * Instead of vector embeddings (which require OpenAI/Voyage), we use
 * Claude Haiku to match requirements to relevant policies via their
 * structured summaries. This keeps the entire stack on a single
 * Anthropic API key.
 *
 * The triage module (./triage.ts) handles relevance matching.
 * The check-requirement module fetches full chunks for matched policies.
 */

import { db } from "@/lib/db";
import { policyChunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get all chunks for a specific policy.
 */
export async function getChunksForPolicy(policyId: string) {
  return db
    .select({
      content: policyChunks.content,
      pageStart: policyChunks.pageStart,
      pageEnd: policyChunks.pageEnd,
      sectionHeader: policyChunks.sectionHeader,
      tokenCount: policyChunks.tokenCount,
    })
    .from(policyChunks)
    .where(eq(policyChunks.policyId, policyId))
    .orderBy(policyChunks.chunkIndex);
}
