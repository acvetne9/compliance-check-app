import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceRuns, complianceResults } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

/**
 * GET /api/compliance/[id]/policies
 * Returns all unique policy IDs checked against this doc by this user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ policyIds: [] });

  const runs = await db
    .select({ id: complianceRuns.id })
    .from(complianceRuns)
    .where(and(eq(complianceRuns.complianceDocId, id), eq(complianceRuns.userId, userId)));

  const policyIds = new Set<string>();
  for (const run of runs) {
    const results = await db
      .select({ policyId: complianceResults.policyId })
      .from(complianceResults)
      .where(eq(complianceResults.complianceRunId, run.id));
    for (const r of results) policyIds.add(r.policyId);
  }

  return NextResponse.json({ policyIds: [...policyIds] });
}
