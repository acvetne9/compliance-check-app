export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { complianceDocs } from "@/lib/db/schema";
import { uploadPdf } from "@/lib/blob";

/**
 * POST /api/upload
 * Upload a compliance PDF — stores in blob, creates DB record,
 * and immediately extracts text via Claude so compliance runs are fast.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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

    // 1. Upload to blob
    const blobUrl = await uploadPdf(file.name, buffer, "compliance");

    // 2. Extract text from PDF using Claude Haiku (fast, works on serverless)
    let textContent: string | null = null;
    let pageCount: number | null = null;
    try {
      const base64 = buffer.toString("base64");
      const { text } = await generateText({
        model: anthropic("claude-haiku-4-5-20251001"),
        maxOutputTokens: 64000,
        messages: [
          {
            role: "user" as const,
            content: [
              {
                type: "file" as const,
                data: base64,
                mediaType: "application/pdf" as const,
              },
              {
                type: "text" as const,
                text: "Extract ALL text from this PDF document. Return the complete text content exactly as it appears, preserving structure, numbering, and formatting. Do not summarize or skip anything.",
              },
            ],
          },
        ],
      });
      textContent = text;
      // Rough page estimate from file size (~2KB per page for text PDFs)
      pageCount = Math.max(1, Math.round(buffer.length / 2048));
    } catch {
      // Text extraction failed — run will fall back to PDF-native path
    }

    // 3. Create DB record with extracted text
    const [doc] = await db
      .insert(complianceDocs)
      .values({
        fileName: file.name,
        blobUrl,
        textContent,
        pageCount,
      })
      .returning();

    return NextResponse.json({
      doc,
      indexed: textContent !== null,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
