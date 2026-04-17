import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  complianceDocs,
  complianceRuns,
  requirements,
  complianceResults,
  policies,
} from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

/**
 * GET /api/compliance/[id]
 * Returns compliance doc metadata + latest run results.
 * By default shows only not_met and unclear items (gaps view).
 * Pass ?view=full for all results.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const view = request.nextUrl.searchParams.get("view") ?? "gaps";

  const [doc] = await db
    .select()
    .from(complianceDocs)
    .where(eq(complianceDocs.id, id));

  if (!doc) {
    return NextResponse.json(
      { error: "Compliance doc not found" },
      { status: 404 }
    );
  }

  // Get latest run
  const [latestRun] = await db
    .select()
    .from(complianceRuns)
    .where(eq(complianceRuns.complianceDocId, id))
    .orderBy(desc(complianceRuns.startedAt))
    .limit(1);

  if (!latestRun) {
    return NextResponse.json({ doc, run: null, requirements: [] });
  }

  // Get requirements for this run
  let reqs = await db
    .select()
    .from(requirements)
    .where(eq(requirements.complianceRunId, latestRun.id))
    .orderBy(requirements.externalId);

  // Filter to gaps only if not full view
  if (view === "gaps") {
    reqs = reqs.filter(
      (r) =>
        r.aggregatedStatus === "not_met" || r.aggregatedStatus === "unclear"
    );
  }

  // Get detailed results for each requirement
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

  // Group results by requirement
  const requirementsWithResults = reqs.map((req) => ({
    ...req,
    results: results.filter((r) => r.requirementId === req.id),
  }));

  return NextResponse.json({
    doc,
    run: latestRun,
    requirements: requirementsWithResults,
  });
}
