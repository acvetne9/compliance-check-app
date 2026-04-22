export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  complianceDocs,
  complianceRuns,
  requirements as requirementsTable,
  complianceResults,
  policies,
  policyChunks, // fallback if cachedPolicyText missing
  cachedChecks,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { extractRequirements, extractRequirementsFromPdf } from "@/lib/ai/extract-requirements";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { complianceCheckSchema, hashRequirementText } from "@/types";

// Tier 1 limits: 50 RPM, 50K ITPM, 10K OTPM
// With prompt caching, only the first request per policy pays full input tokens.
// Subsequent requests are ~200 tokens each. Retry handles occasional rate limits.
const PARALLEL = 8;
const BATCH_DELAY_MS = 1500; // 8 req every 1.5s — retries handle rate limits

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { complianceDocId, policyIds: requestedPolicyIds, resumeRunId } = body;
    if (!complianceDocId && !resumeRunId) {
      return NextResponse.json({ error: "Missing complianceDocId or resumeRunId" }, { status: 400 });
    }

    const userId = await getUserId();

    // Resume an existing run or start a new one
    let run: any;
    let resolvedDocId = complianceDocId;

    if (resumeRunId) {
      const [existing] = await db.select().from(complianceRuns).where(eq(complianceRuns.id, resumeRunId));
      if (!existing) return NextResponse.json({ error: "Run not found" }, { status: 404 });
      run = existing;
      resolvedDocId = existing.complianceDocId;
      await db.update(complianceRuns).set({ status: "checking" }).where(eq(complianceRuns.id, run.id));
    }

    const [doc] = await db.select().from(complianceDocs).where(eq(complianceDocs.id, resolvedDocId));
    if (!doc) {
      return NextResponse.json({ error: "Compliance doc not found" }, { status: 404 });
    }

    const policyList = requestedPolicyIds?.length
      ? await db.select().from(policies).where(inArray(policies.id, requestedPolicyIds))
      : resumeRunId
        // For resume: get policies from existing results
        ? await (async () => {
            const existingResults = await db.select({ policyId: complianceResults.policyId }).from(complianceResults).where(eq(complianceResults.complianceRunId, resumeRunId));
            const pIds = [...new Set(existingResults.map(r => r.policyId))];
            return pIds.length > 0 ? db.select().from(policies).where(inArray(policies.id, pIds)) : db.select().from(policies);
          })()
        : await db.select().from(policies);
    if (policyList.length === 0) {
      return NextResponse.json({ error: "No policies selected" }, { status: 400 });
    }

    if (!run) {
      [run] = await db.insert(complianceRuns).values({ complianceDocId: resolvedDocId, status: "extracting", userId }).returning();
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch {}
        };

        try {
          send({ type: "started", runId: run.id, complianceDocId, policyCount: policyList.length });

          // Phase 1: Get requirements — should be pre-extracted from upload
          let extractedReqs: any;
          const [freshDoc] = await db.select().from(complianceDocs).where(eq(complianceDocs.id, resolvedDocId));
          const currentDoc = freshDoc ?? doc;

          if (currentDoc.requirementsJson) {
            send({ type: "extracting", message: "Loading requirements..." });
            extractedReqs = JSON.parse(currentDoc.requirementsJson);
          } else if (currentDoc.textContent) {
            // Fallback: text exists but requirements not yet extracted
            send({ type: "extracting", message: "Extracting requirements..." });
            extractedReqs = await extractRequirements(currentDoc.textContent, currentDoc.fileName);
            await db.update(complianceDocs).set({ requirementsJson: JSON.stringify(extractedReqs), extractionStatus: "done" }).where(eq(complianceDocs.id, resolvedDocId));
          } else {
            // Last resort: extract directly from PDF
            send({ type: "extracting", message: "Reading PDF and extracting requirements..." });
            const response = await fetch(currentDoc.blobUrl);
            const pdfBuffer = Buffer.from(await response.arrayBuffer());
            extractedReqs = await extractRequirementsFromPdf(pdfBuffer, currentDoc.fileName);
            await db.update(complianceDocs).set({ requirementsJson: JSON.stringify(extractedReqs), extractionStatus: "done" }).where(eq(complianceDocs.id, resolvedDocId));
          }

          send({ type: "requirements_extracted", count: extractedReqs.requirements.length, documentTitle: extractedReqs.documentTitle ?? doc.fileName });

          // On resume, reuse existing requirements; otherwise insert new ones
          const savedReqs: Array<{ id: string; externalId: string; text: string; hash: string; category: string }> = [];
          if (resumeRunId) {
            const existingReqs = await db.select().from(requirementsTable).where(eq(requirementsTable.complianceRunId, run.id));
            for (const req of existingReqs) {
              savedReqs.push({ id: req.id, externalId: req.externalId ?? "", text: req.text, hash: req.textHash, category: req.category ?? "" });
            }
          } else {
            for (const req of extractedReqs.requirements) {
              const hash = hashRequirementText(req.text);
              const [saved] = await db.insert(requirementsTable).values({
                complianceRunId: run.id, externalId: req.id, section: req.section, text: req.text, textHash: hash, category: req.category,
              }).returning({ id: requirementsTable.id });
              savedReqs.push({ id: saved.id, externalId: req.id, text: req.text, hash, category: req.category ?? "" });
            }
          }

          await db.update(complianceRuns).set({ status: "checking", requirementsCount: savedReqs.length }).where(eq(complianceRuns.id, run.id));

          // Load already-completed checks for this run (for resume)
          const completedChecks = new Set<string>();
          if (resumeRunId) {
            const existing = await db.select({ requirementId: complianceResults.requirementId, policyId: complianceResults.policyId })
              .from(complianceResults).where(eq(complianceResults.complianceRunId, run.id));
            for (const r of existing) completedChecks.add(`${r.requirementId}::${r.policyId}`);
          }

          // Phase 2: Check each policy
          let totalMet = 0, totalNotMet = 0, totalUnclear = 0;

          for (let pi = 0; pi < policyList.length; pi++) {
            const policy = policyList[pi];
            send({ type: "policy_start", policyId: policy.id, policyFileName: policy.fileName, policyIndex: pi, totalPolicies: policyList.length, requirementCount: savedReqs.length });

            // Use cached policy text if available, otherwise build from chunks
            let policyText = policy.cachedPolicyText ?? "";
            if (!policyText) {
              const allChunks = await db.select({ content: policyChunks.content, pageStart: policyChunks.pageStart, sectionHeader: policyChunks.sectionHeader })
                .from(policyChunks).where(eq(policyChunks.policyId, policy.id)).orderBy(policyChunks.chunkIndex);
              const SKIP_PATTERNS = /revision history|board action|regulatory agency approval|revised \d{2}\/\d{2}\/\d{4}.*\n.*revised/i;
              const filtered = allChunks.filter((c) => !SKIP_PATTERNS.test(c.content));
              policyText = filtered.map((c) => `${c.sectionHeader ? `[${c.sectionHeader}] ` : ""}(p.${c.pageStart + 1}) ${c.content}`).join("\n\n---\n\n");
              // Cache for next time
              await db.update(policies).set({ cachedPolicyText: policyText }).where(eq(policies.id, policy.id)).catch(() => {});
            }

            let policyMet = 0, policyNotMet = 0, policyUnclear = 0;

            for (let ri = 0; ri < savedReqs.length; ri += PARALLEL) {
              const batch = savedReqs.slice(ri, ri + PARALLEL);

              await Promise.allSettled(batch.map(async (req, bi) => {
                const reqIdx = ri + bi;

                // Skip already-completed checks (resume support)
                if (completedChecks.has(`${req.id}::${policy.id}`)) {
                  // Count existing result for totals
                  const [existing] = await db.select({ status: complianceResults.status }).from(complianceResults)
                    .where(and(eq(complianceResults.requirementId, req.id), eq(complianceResults.policyId, policy.id))).limit(1);
                  if (existing) {
                    if (existing.status === "met" || existing.status === "not_applicable") policyMet++;
                    else if (existing.status === "not_met") policyNotMet++;
                    else policyUnclear++;
                  }
                  send({ type: "check_complete", policyId: policy.id, requirementIndex: reqIdx, requirementId: req.id,
                    externalId: req.externalId, requirementText: req.text, totalRequirements: savedReqs.length,
                    status: existing?.status ?? "unclear", evidence: "(resumed)", reasoning: "(from previous run)" });
                  return;
                }

                let status = "not_met", evidence = "", reasoning = "", confidence = 0;
                let fromCache = false;

                // Cache lookup: exact requirementHash + policyId
                const [cached] = await db
                  .select({ status: cachedChecks.status, evidence: cachedChecks.evidence, confidence: cachedChecks.confidence, reasoning: cachedChecks.reasoning })
                  .from(cachedChecks)
                  .where(and(eq(cachedChecks.requirementHash, req.hash), eq(cachedChecks.policyId, policy.id)))
                  .limit(1);
                if (cached) {
                  status = cached.status;
                  evidence = cached.evidence ?? "";
                  confidence = cached.confidence ?? 0;
                  reasoning = cached.reasoning ?? "";
                  fromCache = true;
                }

                // API call only if no cache hit
                if (!fromCache && policyText.trim()) {
                  const maxRetries = 3;
                  for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                      const { object } = await generateObject({
                        model: anthropic("claude-haiku-4-5-20251001"),
                        schema: complianceCheckSchema,
                        maxOutputTokens: 2000,
                        messages: [
                          { role: "system" as const, content: `You are a healthcare compliance auditor. Check if this policy meets or violates a specific requirement.

STATUS DEFINITIONS:
- "met" = the policy addresses and satisfies this requirement. Evidence: quote the relevant passage. Reasoning: explain how it satisfies it.
- "not_met" = the policy COVERS this topic but FAILS to meet the requirement (an actual compliance violation). Evidence: quote what the policy says instead. Reasoning: explain why it falls short.
- "not_applicable" = the policy does not cover this topic at all — the requirement simply doesn't apply to this policy. This is NOT a violation. Evidence: briefly state what the policy is about. Reasoning: explain why the requirement is unrelated.
- "unclear" = the policy partially addresses this or the language is ambiguous. Evidence: quote the ambiguous text. Reasoning: explain what is unclear or missing.

CRITICAL: If the requirement is about a topic the policy doesn't cover at all (e.g. hospice requirement vs. a staffing policy), the answer is "not_applicable", NOT "not_met". "not_met" means the policy tries to address this topic but does it incorrectly or incompletely.

Always provide evidence and reasoning for EVERY status.` },
                          { role: "system" as const, content: `POLICY: ${policy.fileName}\n\n${policyText}`, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
                          { role: "user" as const, content: `Does this policy meet this requirement?\n\n${req.externalId}: ${req.text}` },
                        ],
                      });
                      status = object.status;
                      evidence = object.evidence;
                      reasoning = object.reasoning;
                      confidence = object.confidence;
                      break;
                    } catch (err: any) {
                      const isRateLimit = err?.message?.includes("rate limit") || err?.message?.includes("429");
                      if (isRateLimit && attempt < maxRetries - 1) {
                        await new Promise((r) => setTimeout(r, 5000 * Math.pow(3, attempt)));
                      } else if (attempt === maxRetries - 1) {
                        status = "unclear";
                        reasoning = `API error after ${maxRetries} attempts`;
                      }
                    }
                  }

                  // Cache only results from actual API calls
                  await db
                    .insert(cachedChecks)
                    .values({ requirementHash: req.hash, policyId: policy.id, status, evidence, confidence, reasoning })
                    .onConflictDoUpdate({
                      target: [cachedChecks.requirementHash, cachedChecks.policyId],
                      set: { status, evidence, confidence, reasoning, checkedAt: new Date() },
                    })
                    .catch(() => {});
                }

                if (status === "met" || status === "not_applicable") policyMet++;
                else if (status === "not_met") policyNotMet++;
                else policyUnclear++;

                await db.insert(complianceResults).values({
                  requirementId: req.id, policyId: policy.id, complianceRunId: run.id,
                  status, evidence, confidence, reasoning,
                });

                send({
                  type: "check_complete", policyId: policy.id, requirementIndex: reqIdx, requirementId: req.id,
                  externalId: req.externalId, requirementText: req.text, totalRequirements: savedReqs.length,
                  status, evidence, reasoning,
                });
              }));

              // Rate limit: wait between batches to stay under 50 RPM
              if (ri + PARALLEL < savedReqs.length) {
                await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
              }
            }

            totalMet += policyMet; totalNotMet += policyNotMet; totalUnclear += policyUnclear;
            send({ type: "policy_done", policyId: policy.id, policyFileName: policy.fileName, met: policyMet, notMet: policyNotMet, unclear: policyUnclear });
          }

          for (const req of savedReqs) {
            const rr = await db.select({ status: complianceResults.status }).from(complianceResults).where(eq(complianceResults.requirementId, req.id));
            let agg = "not_met";
            if (rr.some((r) => r.status === "met")) agg = "met";
            else if (rr.some((r) => r.status === "unclear")) agg = "unclear";
            await db.update(requirementsTable).set({ aggregatedStatus: agg }).where(eq(requirementsTable.id, req.id));
          }

          await db.update(complianceRuns).set({ status: "completed", metCount: totalMet, notMetCount: totalNotMet, unclearCount: totalUnclear, completedAt: new Date() }).where(eq(complianceRuns.id, run.id));
          send({ type: "completed", runId: run.id, met: totalMet, notMet: totalNotMet, unclear: totalUnclear });
        } catch (error) {
          send({ type: "error", message: error instanceof Error ? error.message : "Unknown error" });
          await db.update(complianceRuns).set({ status: "failed" }).where(eq(complianceRuns.id, run.id)).catch(() => {});
        } finally {
          try { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); } catch {}
        }
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
  } catch (error) {
    return NextResponse.json({ error: `Server error: ${error instanceof Error ? error.message : "Unknown"}` }, { status: 500 });
  }
}
