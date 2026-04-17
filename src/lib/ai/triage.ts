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

/**
 * Tier 1 triage: use Haiku to quickly determine which policies
 * are relevant to a given requirement.
 *
 * Accepts policy structured summaries (not full text) to minimize cost.
 * Returns only "yes" and "maybe" matches for Tier 2 deep checking.
 */
export async function triagePolicies(
  requirementText: string,
  policySummaries: Array<{ policyId: string; fileName: string; summary: string }>
): Promise<Array<{ policyId: string; relevance: "yes" | "maybe" }>> {
  if (policySummaries.length === 0) return [];

  const summaryList = policySummaries
    .map((p) => `[${p.policyId}] ${p.fileName}: ${p.summary}`)
    .join("\n");

  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: triageResultSchema,
    maxOutputTokens: 2000,
    system: `You are a healthcare compliance analyst. Given a compliance requirement and a list of policy summaries, determine which policies are relevant to the requirement.

- "yes": The policy clearly addresses the topic of this requirement
- "maybe": The policy might be related but it's not certain
- "no": The policy is clearly unrelated

Be inclusive — it's better to include a "maybe" than to miss a relevant policy.`,
    prompt: `REQUIREMENT:\n${requirementText}\n\nPOLICY SUMMARIES:\n${summaryList}`,
  });

  return object.relevant.filter(
    (r): r is { policyId: string; relevance: "yes" | "maybe" } =>
      r.relevance === "yes" || r.relevance === "maybe"
  );
}
