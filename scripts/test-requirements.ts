import { readFile } from "fs/promises";
import { extractPdfText } from "../src/lib/pdf";

async function countRequirements(path: string, label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${label}`);
  console.log("=".repeat(60));

  const buffer = await readFile(path);
  const extraction = await extractPdfText(buffer);

  console.log(`Pages: ${extraction.totalPages}`);
  console.log(`Total chars: ${extraction.text.length}`);

  // Look for numbered requirement patterns in the Easy doc
  // Easy doc uses "1.", "2.", etc. or "Does the P&P state..." patterns
  const numberedItems = extraction.text.match(/^\d+\.\s/gm) || [];
  console.log(`\nNumbered items (N. pattern): ${numberedItems.length}`);

  // Look for "Does the P&P" pattern (Easy doc format)
  const doesPP = extraction.text.match(/Does the P&P/g) || [];
  console.log(`"Does the P&P" occurrences: ${doesPP.length}`);

  // Look for Yes/No checkbox patterns
  const yesNo = extraction.text.match(/Yes\s*☐|☐\s*Yes|Yes\s+No|Yes\s*\t/gi) || [];
  console.log(`Yes/No checkbox rows: ${yesNo.length}`);

  // Print all lines that start with a number followed by a period
  console.log(`\n--- All numbered items ---`);
  const lines = extraction.text.split("\n");
  let itemCount = 0;
  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s+(.{0,120})/);
    if (match) {
      itemCount++;
      const num = match[1];
      const preview = match[2].replace(/\t/g, " ").trim();
      console.log(`  #${num}: ${preview}`);
    }
  }
  console.log(`\nTotal numbered items found: ${itemCount}`);

  // For the Hard doc, look for section/requirement patterns
  const shallStatements = extraction.text.match(/\bshall\b/gi) || [];
  const mustStatements = extraction.text.match(/\bmust\b/gi) || [];
  const requiredStatements = extraction.text.match(/\brequired\b/gi) || [];
  console.log(`\n"shall" occurrences: ${shallStatements.length}`);
  console.log(`"must" occurrences: ${mustStatements.length}`);
  console.log(`"required" occurrences: ${requiredStatements.length}`);
}

async function main() {
  await countRequirements(
    "../compliance/Example Input Doc - Easy.pdf",
    "Compliance Doc - Easy (expected: 64 items)"
  );

  await countRequirements(
    "../compliance/Example Input Doc - Hard.pdf",
    "Compliance Doc - Hard"
  );
}

main().catch(console.error);
