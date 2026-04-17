export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceDocs } from "@/lib/db/schema";
import { uploadPdf } from "@/lib/blob";

/**
 * POST /api/upload
 * Upload a compliance PDF to Blob storage and create a DB record.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blobUrl = await uploadPdf(
      file.name,
      buffer,
      type === "policy" ? "policies" : "compliance"
    );

    // Create compliance doc record
    const [doc] = await db
      .insert(complianceDocs)
      .values({
        fileName: file.name,
        blobUrl,
      })
      .returning();

    return NextResponse.json({ doc }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
