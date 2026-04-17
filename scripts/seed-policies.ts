/**
 * Seed script: Upload and ingest all 373 policy PDFs.
 *
 * Usage:
 *   npx tsx scripts/seed-policies.ts
 *
 * Requires environment variables:
 *   DATABASE_URL, BLOB_READ_WRITE_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY
 *
 * This calls the bulk ingest API endpoint, which must be running locally.
 * Alternatively, run with --direct to bypass the API and ingest directly.
 */

import { readFile, readdir } from "fs/promises";
import path from "path";

const POLICY_DIR = path.resolve(__dirname, "../../Public Policies");
const API_URL = process.env.API_URL || "http://localhost:3000";

async function seedViaApi() {
  console.log(`Calling bulk ingest API at ${API_URL}/api/ingest/bulk`);
  console.log(`Policy directory: ${POLICY_DIR}`);

  const response = await fetch(`${API_URL}/api/ingest/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ policyDir: POLICY_DIR }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`API error (${response.status}): ${error}`);
    process.exit(1);
  }

  const result = await response.json();
  console.log("\n=== Bulk Ingestion Complete ===");
  console.log(`Total: ${result.summary.total}`);
  console.log(`Ingested: ${result.summary.ingested}`);
  console.log(`Skipped: ${result.summary.skipped}`);
  console.log(`Errors: ${result.summary.errors}`);

  if (result.summary.errors > 0) {
    console.log("\n--- Errors ---");
    for (const r of result.results) {
      if (r.status === "error") {
        console.log(`  ${r.folderId}/${r.fileName}: ${r.error}`);
      }
    }
  }
}

async function countFiles() {
  const folders = await readdir(POLICY_DIR, { withFileTypes: true });
  let total = 0;
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const files = await readdir(path.join(POLICY_DIR, folder.name));
    const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));
    console.log(`  ${folder.name}: ${pdfs.length} PDFs`);
    total += pdfs.length;
  }
  console.log(`  Total: ${total} PDFs`);
  return total;
}

async function main() {
  console.log("=== AndreasGPT Policy Seed Script ===\n");
  console.log("Policy folders:");
  await countFiles();
  console.log();
  await seedViaApi();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
