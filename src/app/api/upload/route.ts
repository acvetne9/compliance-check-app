import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceDocs, policies } from "@/lib/db/schema";
import { uploadPdf } from "@/lib/blob";

/**
 * POST /api/upload
 * Upload a PDF (policy or compliance doc) to Blob storage.
 * For compliance docs, creates a DB record immediately.
 * For policies, just uploads to Blob (use /api/ingest to process).
 *
 * Form data: file (PDF), type ("policy" | "compliance"), folderId (for policies)
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as "policy" | "compliance" | null;

  if (!file || !type) {
    return NextResponse.json(
      { error: "Missing file or type" },
      { status: 400 }
    );
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const blobUrl = await uploadPdf(file.name, buffer, type === "policy" ? "policies" : "compliance");

  if (type === "compliance") {
    // Create compliance doc record
    const [doc] = await db
      .insert(complianceDocs)
      .values({
        fileName: file.name,
        blobUrl,
      })
      .returning();

    return NextResponse.json({ doc }, { status: 201 });
  }

  // For policies, return the blob URL for follow-up ingestion
  const folderId = formData.get("folderId") as string | null;
  return NextResponse.json(
    { blobUrl, fileName: file.name, folderId, message: "Uploaded. Call /api/ingest to process." },
    { status: 201 }
  );
}
