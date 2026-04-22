export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceDocs } from "@/lib/db/schema";
import { uploadPdf } from "@/lib/blob";
import { getUserId } from "@/lib/auth";
import { extractPdfText } from "@/lib/pdf";

/**
 * POST /api/upload
 * Upload compliance PDF → extract text (fast) → create DB record.
 * Text extraction via pdf-parse is < 1 second. Requirement extraction
 * is deferred to the run route where it streams progress via SSE.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blobUrl = await uploadPdf(file.name, buffer, "compliance");

    const userId = await getUserId();

    // Extract text and real page count (fast — no API calls)
    let textContent: string | null = null;
    let pageCount = 1;
    try {
      const extraction = await extractPdfText(buffer);
      textContent = extraction.text;
      pageCount = extraction.totalPages;
    } catch {
      pageCount = Math.max(1, Math.round(buffer.length / 2048));
    }

    const [doc] = await db
      .insert(complianceDocs)
      .values({
        fileName: file.name,
        blobUrl,
        userId,
        pageCount,
        textContent,
      })
      .returning();

    return NextResponse.json({ doc }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
