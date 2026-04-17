import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  complianceRuns,
  complianceDocs,
  requirements,
  complianceResults,
  policies,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sortByReqNumber } from "@/types";

/**
 * GET /api/runs/[runId]/export?format=csv|json
 * Export compliance run results as CSV or JSON download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  const [run] = await db
    .select()
    .from(complianceRuns)
    .where(eq(complianceRuns.id, runId));

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const [doc] = await db
    .select({ fileName: complianceDocs.fileName })
    .from(complianceDocs)
    .where(eq(complianceDocs.id, run.complianceDocId));

  const reqs = sortByReqNumber(
    await db
      .select()
      .from(requirements)
      .where(eq(requirements.complianceRunId, runId))
  );

  const results = await db
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
    .where(eq(complianceResults.complianceRunId, runId));

  const rows = reqs.map((req) => {
    const reqResults = results.filter((r) => r.requirementId === req.id);
    const bestResult = reqResults[0];
    return {
      id: req.externalId ?? req.id,
      section: req.section ?? "",
      category: req.category ?? "",
      requirement: req.text,
      status: req.aggregatedStatus ?? "not_checked",
      policy: bestResult?.policyFileName ?? "",
      evidence: bestResult?.evidence ?? "",
      reasoning: bestResult?.reasoning ?? "",
      confidence: bestResult?.confidence ?? 0,
    };
  });

  const docName = doc?.fileName?.replace(/\.pdf$/i, "") ?? "results";

  if (format === "json") {
    return new Response(
      JSON.stringify(
        {
          run: {
            id: run.id,
            document: doc?.fileName,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            met: run.metCount,
            notMet: run.notMetCount,
            unclear: run.unclearCount,
          },
          requirements: rows,
        },
        null,
        2
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${docName}-compliance-report.json"`,
        },
      }
    );
  }

  // CSV format
  const csvHeader =
    "ID,Section,Category,Requirement,Status,Policy,Evidence,Reasoning,Confidence";
  const csvRows = rows.map((r) =>
    [
      r.id,
      r.section,
      r.category,
      `"${r.requirement.replace(/"/g, '""')}"`,
      r.status,
      r.policy,
      `"${r.evidence.replace(/"/g, '""')}"`,
      `"${r.reasoning.replace(/"/g, '""')}"`,
      r.confidence,
    ].join(",")
  );

  return new Response([csvHeader, ...csvRows].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${docName}-compliance-report.csv"`,
    },
  });
}
