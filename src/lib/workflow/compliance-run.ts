import { getWritable, sleep } from "workflow";
import { db } from "@/lib/db";
import {
  complianceDocs,
  complianceRuns,
  requirements as requirementsTable,
  complianceResults,
} from "@/lib/db/schema";
import { extractPdfText } from "@/lib/pdf";
import { extractRequirements } from "@/lib/ai/extract-requirements";
import { checkRequirement } from "@/lib/ai/check-requirement";
import { hashRequirementText } from "@/types";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Progress event types streamed to the client
// ---------------------------------------------------------------------------

export type ProgressEvent =
  | { type: "started"; runId: string; complianceDocId: string }
  | { type: "extracting"; message: string }
  | {
      type: "requirements_extracted";
      count: number;
      documentTitle: string;
    }
  | {
      type: "checking";
      requirementIndex: number;
      totalRequirements: number;
      requirementText: string;
    }
  | {
      type: "check_complete";
      requirementIndex: number;
      requirementId: string;
      status: "met" | "not_met" | "unclear";
      policyCount: number;
    }
  | {
      type: "completed";
      runId: string;
      met: number;
      notMet: number;
      unclear: number;
    }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Step functions (full Node.js access, auto-retry)
// ---------------------------------------------------------------------------

async function fetchComplianceDoc(complianceDocId: string) {
  "use step";
  const [doc] = await db
    .select()
    .from(complianceDocs)
    .where(eq(complianceDocs.id, complianceDocId));
  if (!doc) throw new Error(`Compliance doc ${complianceDocId} not found`);

  const response = await fetch(doc.blobUrl);
  const buffer = await response.arrayBuffer();
  const extraction = await extractPdfText(Buffer.from(buffer));

  return { doc, extraction };
}

async function extractRequirementsStep(
  fullText: string,
  fileName: string
) {
  "use step";
  return extractRequirements(fullText, fileName);
}

async function checkSingleRequirement(
  requirementText: string,
  requirementHash: string,
  policyIds: string[] | undefined
) {
  "use step";
  return checkRequirement(requirementText, requirementHash, { policyIds });
}

async function saveRunResults(
  runId: string,
  reqResults: Array<{
    requirementId: string;
    checks: Array<{
      policyId: string;
      status: string;
      evidence: string;
      confidence: number;
      reasoning: string;
    }>;
    aggregatedStatus: string;
  }>
) {
  "use step";

  let met = 0;
  let notMet = 0;
  let unclear = 0;

  for (const req of reqResults) {
    // Update requirement aggregated status
    await db
      .update(requirementsTable)
      .set({ aggregatedStatus: req.aggregatedStatus })
      .where(eq(requirementsTable.id, req.requirementId));

    if (req.aggregatedStatus === "met") met++;
    else if (req.aggregatedStatus === "not_met") notMet++;
    else unclear++;

    // Insert compliance results
    for (const check of req.checks) {
      await db.insert(complianceResults).values({
        requirementId: req.requirementId,
        policyId: check.policyId,
        complianceRunId: runId,
        status: check.status,
        evidence: check.evidence,
        confidence: check.confidence,
        reasoning: check.reasoning,
      });
    }
  }

  // Update run record
  await db
    .update(complianceRuns)
    .set({
      status: "completed",
      metCount: met,
      notMetCount: notMet,
      unclearCount: unclear,
      completedAt: new Date(),
    })
    .where(eq(complianceRuns.id, runId));

  return { met, notMet, unclear };
}

// ---------------------------------------------------------------------------
// Main workflow function
// ---------------------------------------------------------------------------

export async function complianceCheckWorkflow(
  complianceDocId: string,
  policyIds: string[] | null,
  runId: string
) {
  "use workflow";

  const writable = getWritable<string>();
  const writer = writable.getWriter();

  const emit = async (event: ProgressEvent) => {
    await writer.write(JSON.stringify(event));
  };

  try {
    await emit({ type: "started", runId, complianceDocId });

    // Step 1: Fetch and extract compliance doc
    await emit({ type: "extracting", message: "Extracting text from compliance document..." });
    const { doc, extraction } = await fetchComplianceDoc(complianceDocId);

    // Step 2: Extract requirements
    await emit({ type: "extracting", message: "Analyzing document for compliance requirements..." });
    const extracted = await extractRequirementsStep(
      extraction.text,
      doc.fileName
    );

    await emit({
      type: "requirements_extracted",
      count: extracted.totalFound,
      documentTitle: extracted.documentTitle,
    });

    // Step 3: Save requirement records to DB
    const savedRequirements: Array<{ id: string; text: string; hash: string }> = [];
    for (const req of extracted.requirements) {
      const hash = hashRequirementText(req.text);
      const [saved] = await db
        .insert(requirementsTable)
        .values({
          complianceRunId: runId,
          externalId: req.id,
          section: req.section,
          text: req.text,
          textHash: hash,
          category: req.category,
        })
        .returning({ id: requirementsTable.id });
      savedRequirements.push({ id: saved.id, text: req.text, hash });
    }

    // Update run with requirement count
    await db
      .update(complianceRuns)
      .set({
        status: "checking",
        requirementsCount: savedRequirements.length,
      })
      .where(eq(complianceRuns.id, runId));

    // Step 4: Check each requirement (batches of 5 for parallelism)
    const allReqResults: Array<{
      requirementId: string;
      checks: Array<{
        policyId: string;
        status: string;
        evidence: string;
        confidence: number;
        reasoning: string;
      }>;
      aggregatedStatus: string;
    }> = [];

    const batchSize = 5;
    for (let i = 0; i < savedRequirements.length; i += batchSize) {
      const batch = savedRequirements.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (req, j) => {
          const idx = i + j;
          await emit({
            type: "checking",
            requirementIndex: idx,
            totalRequirements: savedRequirements.length,
            requirementText: req.text.slice(0, 100),
          });

          const checks = await checkSingleRequirement(
            req.text,
            req.hash,
            policyIds ?? undefined
          );

          // Aggregate: met if ANY policy meets it, unclear if any unclear and none met
          let aggregatedStatus: string = "not_met";
          if (checks.some((c) => c.result.status === "met")) {
            aggregatedStatus = "met";
          } else if (checks.some((c) => c.result.status === "unclear")) {
            aggregatedStatus = "unclear";
          }

          await emit({
            type: "check_complete",
            requirementIndex: idx,
            requirementId: req.id,
            status: aggregatedStatus as "met" | "not_met" | "unclear",
            policyCount: checks.length,
          });

          return {
            requirementId: req.id,
            checks: checks.map((c) => ({
              policyId: c.policyId,
              status: c.result.status,
              evidence: c.result.evidence,
              confidence: c.result.confidence,
              reasoning: c.result.reasoning,
            })),
            aggregatedStatus,
          };
        })
      );

      allReqResults.push(...batchResults);

      // Brief pause between batches to avoid rate limits
      if (i + batchSize < savedRequirements.length) {
        await sleep("1s");
      }
    }

    // Step 5: Save all results
    const totals = await saveRunResults(runId, allReqResults);

    await emit({
      type: "completed",
      runId,
      met: totals.met,
      notMet: totals.notMet,
      unclear: totals.unclear,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await emit({ type: "error", message });

    await db
      .update(complianceRuns)
      .set({ status: "failed" })
      .where(eq(complianceRuns.id, runId));

    throw error;
  } finally {
    writer.releaseLock();
  }
}
