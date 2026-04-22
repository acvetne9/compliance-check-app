import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceRuns, complianceDocs } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

/**
 * GET /api/runs
 * List completed compliance runs for this user only.
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ runs: [] });

  const runs = await db
    .select({
      id: complianceRuns.id,
      status: complianceRuns.status,
      requirementsCount: complianceRuns.requirementsCount,
      metCount: complianceRuns.metCount,
      notMetCount: complianceRuns.notMetCount,
      unclearCount: complianceRuns.unclearCount,
      startedAt: complianceRuns.startedAt,
      completedAt: complianceRuns.completedAt,
      complianceDocId: complianceRuns.complianceDocId,
      docFileName: complianceDocs.fileName,
    })
    .from(complianceRuns)
    .innerJoin(complianceDocs, eq(complianceRuns.complianceDocId, complianceDocs.id))
    .where(and(eq(complianceRuns.status, "completed"), eq(complianceRuns.userId, userId)))
    .orderBy(desc(complianceRuns.completedAt));

  return NextResponse.json({ runs });
}
