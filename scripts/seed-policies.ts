/**
 * Seed script: Upload and ingest all policy PDFs.
 *
 * Usage:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-policies.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-policies.ts --limit 5  # test with 5 files
 */

import { readFile, readdir } from "fs/promises";
import path from "path";
import { extractPdfText } from "../src/lib/pdf";
import { chunkPages } from "../src/lib/chunker";
import { uploadPdf } from "../src/lib/blob";
import { generatePolicySummary } from "../src/lib/ingest";
import { db } from "../src/lib/db";
import { policies, policyChunks } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const POLICY_DIR = path.resolve(__dirname, "../../Public Policies");
const limit = process.argv.includes("--limit")
  ? parseInt(process.argv[process.argv.indexOf("--limit") + 1], 10)
  : Infinity;

async function seedFolder(folderId: string, folderPath: string, remaining: { count: number }) {
  const files = await readdir(folderPath);
  const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  for (const fileName of pdfFiles) {
    if (remaining.count <= 0) break;

    // Check if already exists
    const existing = await db
      .select({ id: policies.id })
      .from(policies)
      .where(eq(policies.fileName, fileName))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    try {
      const filePath = path.join(folderPath, fileName);
      const buffer = await readFile(filePath);

      // Extract text
      const extraction = await extractPdfText(buffer);
      const chunks = chunkPages(extraction.pages);

      // Upload to Blob
      const blobUrl = await uploadPdf(fileName, buffer, "policies");

      // Generate summary (skip if no ANTHROPIC_API_KEY to allow partial seeding)
      let summary = "";
      let structuredSummary = "";
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const summaries = await generatePolicySummary(extraction.text, fileName);
          summary = summaries.summary;
          structuredSummary = summaries.structuredSummary;
        } catch (e) {
          console.warn(`  Warning: Summary generation failed for ${fileName}, continuing without summary`);
        }
      }

      // Store policy
      const [policy] = await db
        .insert(policies)
        .values({
          folderId,
          fileName,
          blobUrl,
          summary,
          structuredSummary,
          pageCount: extraction.totalPages,
          tokenCount: Math.ceil(extraction.text.length / 4),
          isIngested: true,
          ingestedAt: new Date(),
        })
        .returning({ id: policies.id });

      // Store chunks
      if (chunks.length > 0) {
        await db.insert(policyChunks).values(
          chunks.map((chunk) => ({
            policyId: policy.id,
            chunkIndex: chunk.index,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            content: chunk.content,
            sectionHeader: chunk.sectionHeader,
            tokenCount: chunk.tokenCount,
          }))
        );
      }

      ingested++;
      remaining.count--;
      console.log(`  ✓ ${folderId}/${fileName} (${extraction.totalPages} pages, ${chunks.length} chunks)`);
    } catch (e) {
      errors++;
      console.error(`  ✗ ${folderId}/${fileName}: ${e instanceof Error ? e.message : e}`);
    }
  }

  return { total: pdfFiles.length, ingested, skipped, errors };
}

async function seedComplianceDocs() {
  const compDir = path.resolve(__dirname, "../../compliance");
  const files = await readdir(compDir);
  const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

  const { complianceDocs } = await import("../src/lib/db/schema");

  for (const fileName of pdfFiles) {
    const existing = await db
      .select({ id: complianceDocs.id })
      .from(complianceDocs)
      .where(eq(complianceDocs.fileName, fileName))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⊘ ${fileName} (already exists)`);
      continue;
    }

    const buffer = await readFile(path.join(compDir, fileName));
    const extraction = await extractPdfText(buffer);
    const blobUrl = await uploadPdf(fileName, buffer, "compliance");

    await db.insert(complianceDocs).values({
      fileName,
      blobUrl,
      textContent: extraction.text,
      pageCount: extraction.totalPages,
    });

    console.log(`  ✓ ${fileName} (${extraction.totalPages} pages, ${extraction.text.length} chars)`);
  }
}

async function main() {
  console.log("=== AndreasGPT Policy Seed ===\n");

  if (limit < Infinity) {
    console.log(`Limiting to ${limit} files\n`);
  }

  const folders = await readdir(POLICY_DIR, { withFileTypes: true });
  const folderNames = folders
    .filter((f) => f.isDirectory())
    .map((f) => f.name)
    .sort();

  const remaining = { count: limit };
  let totalIngested = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const folderId of folderNames) {
    if (remaining.count <= 0) break;
    console.log(`\n${folderId}/`);
    const result = await seedFolder(
      folderId,
      path.join(POLICY_DIR, folderId),
      remaining
    );
    totalIngested += result.ingested;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }

  console.log("\n\n--- Compliance Docs ---");
  await seedComplianceDocs();

  console.log("\n=== Done ===");
  console.log(`Ingested: ${totalIngested}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
