import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { db } from "@/lib/db";
import { complianceDocs, complianceRuns } from "@/lib/db/schema";
import { complianceCheckWorkflow } from "@/lib/workflow/compliance-run";
import { eq } from "drizzle-orm";

/**
 * POST /api/run
 * Start a compliance check workflow.
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

  // Start the durable workflow
  const workflowRun = await start(complianceCheckWorkflow, [
    complianceDocId,
    policyIds ?? null,
    run.id,
  ]);

  // Update run with workflow ID
  await db
    .update(complianceRuns)
    .set({ workflowRunId: workflowRun.runId, status: "extracting" })
    .where(eq(complianceRuns.id, run.id));

  return NextResponse.json({
    runId: run.id,
    workflowRunId: workflowRun.runId,
  });
}
