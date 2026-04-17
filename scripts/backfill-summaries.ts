/**
 * Backfill policy summaries for policies that were ingested without them.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/backfill-summaries.ts
 */

import { db } from "../src/lib/db";
import { policies, policyChunks } from "../src/lib/db/schema";
import { generatePolicySummary } from "../src/lib/ingest";
import { eq, or, isNull } from "drizzle-orm";

async function main() {
  // Find policies without summaries (null or empty string)
  const unsummarized = await db
    .select({ id: policies.id, fileName: policies.fileName })
    .from(policies)
    .where(or(isNull(policies.summary), eq(policies.summary, "")));

  console.log(`Found ${unsummarized.length} policies without summaries\n`);

  let done = 0;
  let errors = 0;

  for (const policy of unsummarized) {
    try {
      // Get the policy text from chunks
      const chunks = await db
        .select({ content: policyChunks.content })
        .from(policyChunks)
        .where(eq(policyChunks.policyId, policy.id))
        .orderBy(policyChunks.chunkIndex);

      const fullText = chunks.map((c) => c.content).join("\n\n");

      if (!fullText.trim()) {
        console.log(`  ⊘ ${policy.fileName} (no text)`);
        continue;
      }

      const { summary, structuredSummary } = await generatePolicySummary(
        fullText,
        policy.fileName
      );

      await db
        .update(policies)
        .set({ summary, structuredSummary })
        .where(eq(policies.id, policy.id));

      done++;
      console.log(`  ✓ ${policy.fileName}`);
    } catch (e) {
      errors++;
      console.error(`  ✗ ${policy.fileName}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nDone: ${done} | Errors: ${errors}`);
}

main().catch(console.error);
