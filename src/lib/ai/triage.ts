import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const triageResultSchema = z.object({
  relevant: z.array(
    z.object({
      policyId: z.string(),
      relevance: z.enum(["yes", "maybe", "no"]),
    })
  ),
});

export type TriageResult = z.infer<typeof triageResultSchema>;

const BATCH_SIZE = 30; // Process 30 policies at a time to stay under token limits

/**
 * Tier 1 triage: use Haiku to determine which policies are relevant.
 * Batches policies to avoid token limit issues.
 */
export async function triagePolicies(
  requirementText: string,
  policySummaries: Array<{ policyId: string; fileName: string; summary: string }>
): Promise<Array<{ policyId: string; relevance: "yes" | "maybe" }>> {
  // Only triage policies that have summaries
  const withSummaries = policySummaries.filter((p) => p.summary && p.summary.trim());
  if (withSummaries.length === 0) return [];

  const allResults: Array<{ policyId: string; relevance: "yes" | "maybe" }> = [];

  // Process in batches
  for (let i = 0; i < withSummaries.length; i += BATCH_SIZE) {
    const batch = withSummaries.slice(i, i + BATCH_SIZE);

    const summaryList = batch
      .map((p) => `[${p.policyId}] ${p.fileName}: ${p.summary}`)
      .join("\n");

    try {
      const { object } = await generateObject({
        model: anthropic("claude-haiku-4-5-20251001"),
        schema: triageResultSchema,
        maxOutputTokens: 2000,
        system: `You are a healthcare compliance analyst. Given a compliance requirement and a list of policy summaries, determine which policies are relevant.

- "yes": The policy clearly addresses the topic of this requirement
- "maybe": The policy might be related but it's not certain
- "no": The policy is clearly unrelated

Be very inclusive — mark as "maybe" if there is any possible connection.`,
        prompt: `REQUIREMENT:\n${requirementText}\n\nPOLICY SUMMARIES:\n${summaryList}`,
      });

      const matches = object.relevant.filter(
        (r): r is { policyId: string; relevance: "yes" | "maybe" } =>
          r.relevance === "yes" || r.relevance === "maybe"
      );
      allResults.push(...matches);
    } catch {
      // If a batch fails (rate limit etc), skip it
    }
  }

  return allResults;
}
