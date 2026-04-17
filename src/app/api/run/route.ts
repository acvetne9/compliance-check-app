import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceDocs, complianceRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/run
 * Start a compliance check run.
 * Body: { complianceDocId: string, policyIds?: string[] }
 */
export async function POST(request: NextRequest) {
  const { complianceDocId, policyIds } = await request.json();

  if (!complianceDocId) {
    return NextResponse.json(
      { error: "Missing complianceDocId" },
      { status: 400 }
    );
  }

  // Verify doc exists
  const [doc] = await db
    .select({ id: complianceDocs.id })
    .from(complianceDocs)
    .where(eq(complianceDocs.id, complianceDocId));

  if (!doc) {
    return NextResponse.json(
      { error: "Compliance doc not found" },
      { status: 404 }
    );
  }

  // Create run record
  const [run] = await db
    .insert(complianceRuns)
    .values({
      complianceDocId,
      status: "pending",
    })
    .returning();

  return NextResponse.json({ runId: run.id });
}
