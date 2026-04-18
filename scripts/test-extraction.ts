import { readFile } from "fs/promises";
import { extractPdfText } from "../src/lib/pdf";
import { chunkPages } from "../src/lib/chunker";

async function testFile(path: string, label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${label}`);
  console.log(`File: ${path}`);
  console.log("=".repeat(60));

  const buffer = await readFile(path);
  const extraction = await extractPdfText(buffer);

  console.log(`\nPages: ${extraction.totalPages}`);
  console.log(`Total text length: ${extraction.text.length} chars`);
  console.log(`Approx tokens: ${Math.ceil(extraction.text.length / 4)}`);

  // Show first 500 chars of text
  console.log(`\n--- First 500 chars ---`);
  console.log(extraction.text.slice(0, 500));

  // Show per-page stats
  console.log(`\n--- Per-page char counts ---`);
  extraction.pages.forEach((page, i) => {
    console.log(`  Page ${i}: ${page.length} chars`);
  });

  // Test chunking
  const chunks = chunkPages(extraction.pages);
  console.log(`\n--- Chunking results ---`);
  console.log(`Total chunks: ${chunks.length}`);
  chunks.forEach((chunk) => {
    console.log(
      `  Chunk ${chunk.index}: ${chunk.tokenCount} tokens, pages ${chunk.pageStart}-${chunk.pageEnd}, section: ${chunk.sectionHeader ?? "(none)"}`
    );
    // Show first 150 chars of each chunk
    console.log(`    "${chunk.content.slice(0, 150).replace(/\n/g, "\\n")}..."`);
  });
}

async function main() {
  // Test a small policy
  await testFile(
    "../Public Policies/CMC/CMC.3001_CEO20240523.pdf",
    "Small Policy (CMC.3001)"
  );

  // Test a GA policy
  await testFile(
    "../Public Policies/GA/GA.8048_CEO20250129_v20241231.pdf",
    "GA Policy (GA.8048)"
  );

  // Test compliance doc - Easy
  await testFile(
    "../compliance/Example Input Doc - Easy.pdf",
    "Compliance Doc - Easy"
  );

  // Test compliance doc - Hard (truncate output)
  await testFile(
    "../compliance/Example Input Doc - Hard.pdf",
    "Compliance Doc - Hard"
  );
}

main().catch(console.error);
