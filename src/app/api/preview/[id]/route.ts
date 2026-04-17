import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { policies, complianceDocs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/preview/[id]
 * Returns the Blob URL for previewing a PDF.
 * Searches both policies and compliance docs.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check policies first
  const [policy] = await db
    .select({ blobUrl: policies.blobUrl, fileName: policies.fileName })
    .from(policies)
    .where(eq(policies.id, id));

  if (policy) {
    return NextResponse.json({
      url: policy.blobUrl,
      fileName: policy.fileName,
      type: "policy",
    });
  }

  // Check compliance docs
  const [doc] = await db
    .select({ blobUrl: complianceDocs.blobUrl, fileName: complianceDocs.fileName })
    .from(complianceDocs)
    .where(eq(complianceDocs.id, id));

  if (doc) {
    return NextResponse.json({
      url: doc.blobUrl,
      fileName: doc.fileName,
      type: "compliance",
    });
  }

  return NextResponse.json({ error: "Document not found" }, { status: 404 });
}
