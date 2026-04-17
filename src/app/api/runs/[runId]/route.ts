import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  complianceRuns,
  complianceDocs,
  requirements,
  complianceResults,
  policies,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { sortByReqNumber } from "@/types";

/**
 * GET /api/runs/[runId]
 * Get full results for a specific compliance run.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const [run] = await db
    .select()
    .from(complianceRuns)
    .where(eq(complianceRuns.id, runId));

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const [doc] = await db
    .select()
    .from(complianceDocs)
    .where(eq(complianceDocs.id, run.complianceDocId));

  const reqs = sortByReqNumber(
    await db
      .select()
      .from(requirements)
      .where(eq(requirements.complianceRunId, runId))
  );

  const reqIds = reqs.map((r) => r.id);
  const results =
    reqIds.length > 0
      ? await db
          .select({
            requirementId: complianceResults.requirementId,
            policyId: complianceResults.policyId,
            policyFileName: policies.fileName,
            status: complianceResults.status,
            evidence: complianceResults.evidence,
            confidence: complianceResults.confidence,
            reasoning: complianceResults.reasoning,
          })
          .from(complianceResults)
          .innerJoin(policies, eq(complianceResults.policyId, policies.id))
          .where(inArray(complianceResults.requirementId, reqIds))
      : [];

  const requirementsWithResults = reqs.map((req) => ({
    ...req,
    results: results.filter((r) => r.requirementId === req.id),
  }));

  return NextResponse.json({
    doc,
    run,
    requirements: requirementsWithResults,
  });
}

/**
 * DELETE /api/runs/[runId]
 * Delete a compliance run and its results.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  await db.delete(complianceResults).where(eq(complianceResults.complianceRunId, runId));
  await db.delete(requirements).where(eq(requirements.complianceRunId, runId));
  await db.delete(complianceRuns).where(eq(complianceRuns.id, runId));

  return NextResponse.json({ deleted: true });
}
