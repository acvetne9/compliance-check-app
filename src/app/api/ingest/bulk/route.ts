import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { ingestPolicy, isPolicyIngested } from "@/lib/ingest";

/**
 * POST /api/ingest/bulk
 * Ingest all policy PDFs from the local Public Policies directory.
 * This is an admin-only endpoint for initial setup.
 *
 * Body: { policyDir: string } — absolute path to the Public Policies folder.
 */
export async function POST(request: NextRequest) {
  const { policyDir } = await request.json();

  if (!policyDir) {
    return NextResponse.json(
      { error: "Missing policyDir in request body" },
      { status: 400 }
    );
  }

  const results: Array<{
    fileName: string;
    folderId: string;
    status: "ingested" | "skipped" | "error";
    error?: string;
    chunkCount?: number;
  }> = [];

  // Read all folder directories
  const folders = await readdir(policyDir, { withFileTypes: true });
  const folderNames = folders
    .filter((f) => f.isDirectory())
    .map((f) => f.name);

  let totalIngested = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const folderId of folderNames) {
    const folderPath = path.join(policyDir, folderId);
    const files = await readdir(folderPath);
    const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

    for (const fileName of pdfFiles) {
      try {
        // Skip if already ingested
        const alreadyIngested = await isPolicyIngested(fileName, folderId);
        if (alreadyIngested) {
          results.push({ fileName, folderId, status: "skipped" });
          totalSkipped++;
          continue;
        }

        const filePath = path.join(folderPath, fileName);
        const buffer = await readFile(filePath);
        const result = await ingestPolicy(buffer, fileName, folderId);

        results.push({
          fileName,
          folderId,
          status: "ingested",
          chunkCount: result.chunkCount,
        });
        totalIngested++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({ fileName, folderId, status: "error", error: message });
        totalErrors++;
      }
    }
  }

  return NextResponse.json({
    summary: {
      total: results.length,
      ingested: totalIngested,
      skipped: totalSkipped,
      errors: totalErrors,
    },
    results,
  });
}
