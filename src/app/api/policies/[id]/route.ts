import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  policies,
  policyChunks,
  complianceResults,
  requirements,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deletePdf } from "@/lib/blob";

/**
 * GET /api/policies/[id]
 * Returns single policy metadata + cached compliance results.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, id));

  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  // Get compliance results for this policy
  const results = await db
    .select({
      requirementId: complianceResults.requirementId,
      status: complianceResults.status,
      evidence: complianceResults.evidence,
      confidence: complianceResults.confidence,
      reasoning: complianceResults.reasoning,
      checkedAt: complianceResults.checkedAt,
      requirementText: requirements.text,
      requirementSection: requirements.section,
      requirementExternalId: requirements.externalId,
      requirementCategory: requirements.category,
    })
    .from(complianceResults)
    .innerJoin(requirements, eq(complianceResults.requirementId, requirements.id))
    .where(eq(complianceResults.policyId, id))
;

  return NextResponse.json({ policy, complianceResults: results });
}

/**
 * DELETE /api/policies/[id]
 * Remove a policy and its chunks from DB and Blob storage.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [policy] = await db
    .select({ id: policies.id, blobUrl: policies.blobUrl })
    .from(policies)
    .where(eq(policies.id, id));

  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  // Delete from Blob storage
  await deletePdf(policy.blobUrl);

  // Delete chunks (cascades from schema, but explicit for clarity)
  await db.delete(policyChunks).where(eq(policyChunks.policyId, id));

  // Delete policy record
  await db.delete(policies).where(eq(policies.id, id));

  return NextResponse.json({ deleted: true });
}
