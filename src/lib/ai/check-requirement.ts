import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { cachedChecks, policies } from "@/lib/db/schema";
import { complianceCheckSchema, type ComplianceCheckResult } from "@/types";
import { getChunksForPolicy } from "./embeddings";
import { triagePolicies } from "./triage";
import { eq, and, inArray } from "drizzle-orm";

export interface CheckRequirementOptions {
  /** Specific policy IDs to check against. If omitted, searches all. */
  policyIds?: string[];
  /** Skip the cache lookup (force re-check). */
  skipCache?: boolean;
}

export interface CheckResult {
  policyId: string;
  policyFileName: string;
  result: ComplianceCheckResult;
  fromCache: boolean;
}

/**
 * Full pipeline for checking one requirement against relevant policies.
 *
 * 1. Check cross-run cache for existing results
 * 2. Embed requirement, vector search for relevant policy chunks
 * 3. Tier 1 (Haiku triage): filter to relevant policies using summaries
 * 4. Tier 2 (Sonnet deep check): check against full chunks with prompt caching
 * 5. Cache results for future runs
 */
export async function checkRequirement(
  requirementText: string,
  requirementHash: string,
  options: CheckRequirementOptions = {}
): Promise<CheckResult[]> {
  const { policyIds, skipCache = false } = options;
  const results: CheckResult[] = [];

  // Step 1: Check cache
  if (!skipCache) {
    const cached = await getCachedResults(requirementHash, policyIds);
    if (cached.length > 0) {
      results.push(...cached);
      // If we have cached results for all requested policies, return early
      if (policyIds && cached.length >= policyIds.length) {
        return results;
      }
    }
  }

  const cachedPolicyIds = new Set(results.map((r) => r.policyId));

  // Step 2: Tier 1 — Haiku triage using policy summaries
  const policyRecords = await db
    .select({
      id: policies.id,
      fileName: policies.fileName,
      summary: policies.summary,
    })
    .from(policies)
    .where(
      policyIds && policyIds.length > 0
        ? inArray(policies.id, policyIds)
        : undefined
    );

  // Filter out already-cached policies
  const candidatePolicies = policyRecords.filter(
    (p) => !cachedPolicyIds.has(p.id)
  );

  const triageResults = await triagePolicies(
    requirementText,
    candidatePolicies.map((p) => ({
      policyId: p.id,
      fileName: p.fileName,
      summary: p.summary ?? "",
    }))
  );

  const relevantPolicyIds = triageResults.map((r) => r.policyId);

  if (relevantPolicyIds.length === 0) return results;

  // Step 4: Tier 2 — Sonnet deep check with prompt caching
  // Group chunks by policy for cache efficiency
  for (const targetPolicyId of relevantPolicyIds) {
    if (cachedPolicyIds.has(targetPolicyId)) continue;

    const policy = candidatePolicies.find((p) => p.id === targetPolicyId);
    if (!policy) continue;

    const chunks = await getChunksForPolicy(targetPolicyId);

    const policyText = chunks
      .map(
        (c) =>
          `${c.sectionHeader ? `[${c.sectionHeader}] ` : ""}(p.${c.pageStart + 1}) ${c.content}`
      )
      .join("\n\n---\n\n");

    // Deep check with prompt caching on policy text
    const checkResult = await deepCheck(requirementText, policyText, policy.fileName);

    // Cache the result
    await cacheResult(requirementHash, targetPolicyId, checkResult);

    results.push({
      policyId: targetPolicyId,
      policyFileName: policy.fileName,
      result: checkResult,
      fromCache: false,
    });
  }

  return results;
}

/**
 * Tier 2: Deep compliance check using Sonnet with prompt caching.
 * The policy text is sent as a cached system message so subsequent
 * requirements checked against the same policy reuse the cache.
 */
async function deepCheck(
  requirementText: string,
  policyText: string,
  policyFileName: string
): Promise<ComplianceCheckResult> {
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6-20250514"),
    schema: complianceCheckSchema,
    maxOutputTokens: 2000,
    messages: [
      {
        role: "system" as const,
        content: `You are a healthcare compliance auditor. Given a compliance requirement and a policy document, determine whether the requirement is met.

- "met": The policy explicitly addresses and satisfies this requirement. Quote the exact passage.
- "not_met": The policy does not address this requirement, or contradicts it.
- "unclear": The policy partially addresses this, or the language is ambiguous.

Be precise. Quote exact text from the policy as evidence.`,
      },
      {
        role: "system" as const,
        content: `POLICY DOCUMENT: ${policyFileName}\n\n${policyText}`,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      {
        role: "user" as const,
        content: `Check this requirement:\n${requirementText}`,
      },
    ],
  });

  return object;
}

/**
 * Look up cached results for a requirement hash.
 */
async function getCachedResults(
  requirementHash: string,
  policyIds?: string[]
): Promise<CheckResult[]> {
  let query = db
    .select({
      policyId: cachedChecks.policyId,
      status: cachedChecks.status,
      evidence: cachedChecks.evidence,
      confidence: cachedChecks.confidence,
      reasoning: cachedChecks.reasoning,
      fileName: policies.fileName,
    })
    .from(cachedChecks)
    .innerJoin(policies, eq(cachedChecks.policyId, policies.id))
    .where(eq(cachedChecks.requirementHash, requirementHash))
    .$dynamic();

  const rows = await query;

  return rows
    .filter((r) => !policyIds || policyIds.includes(r.policyId))
    .map((r) => ({
      policyId: r.policyId,
      policyFileName: r.fileName,
      result: {
        status: r.status as ComplianceCheckResult["status"],
        evidence: r.evidence ?? "",
        confidence: r.confidence ?? 0,
        reasoning: r.reasoning ?? "",
      },
      fromCache: true,
    }));
}

/**
 * Store a check result in the cross-run cache.
 */
async function cacheResult(
  requirementHash: string,
  policyId: string,
  result: ComplianceCheckResult
): Promise<void> {
  await db
    .insert(cachedChecks)
    .values({
      requirementHash,
      policyId,
      status: result.status,
      evidence: result.evidence,
      confidence: result.confidence,
      reasoning: result.reasoning,
    })
    .onConflictDoUpdate({
      target: [cachedChecks.requirementHash, cachedChecks.policyId],
      set: {
        status: result.status,
        evidence: result.evidence,
        confidence: result.confidence,
        reasoning: result.reasoning,
        checkedAt: new Date(),
      },
    });
}
