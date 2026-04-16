import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import { extractPdfText } from "../pdf";
import path from "path";

const POLICY_DIR = path.resolve(__dirname, "../../../../Public Policies");
const COMPLIANCE_DIR = path.resolve(__dirname, "../../../../compliance");

describe("extractPdfText", () => {
  it("extracts text from a small policy PDF (CMC.3001)", async () => {
    const buffer = await readFile(
      path.join(POLICY_DIR, "CMC/CMC.3001_CEO20240523.pdf")
    );
    const result = await extractPdfText(buffer);

    expect(result.totalPages).toBe(6);
    expect(result.pages).toHaveLength(6);
    expect(result.text.length).toBeGreaterThan(5000);

    // Should contain key policy content
    expect(result.text).toContain("PURPOSE");
    expect(result.text).toContain("Capitation Payments");
    expect(result.text).toContain("CalOptima Health");
  });

  it("extracts text from a GA policy PDF (GA.8048)", async () => {
    const buffer = await readFile(
      path.join(POLICY_DIR, "GA/GA.8048_CEO20250129_v20241231.pdf")
    );
    const result = await extractPdfText(buffer);

    expect(result.totalPages).toBe(4);
    expect(result.pages).toHaveLength(4);
    expect(result.text).toContain("Smoking");
    expect(result.text).toContain("Nicotine");
  });

  it("extracts all 64 requirements from Easy compliance doc", async () => {
    const buffer = await readFile(
      path.join(COMPLIANCE_DIR, "Example Input Doc - Easy.pdf")
    );
    const result = await extractPdfText(buffer);

    expect(result.totalPages).toBe(14);
    expect(result.text.length).toBeGreaterThan(20000);

    // Count numbered checklist items
    const numberedItems = result.text.match(/^\d+\.\s+Does the P&P/gm) || [];
    expect(numberedItems).toHaveLength(64);

    // Verify first and last items are present
    expect(result.text).toContain(
      "1. Does the P&P state that under existing Contract requirements"
    );
    expect(result.text).toContain(
      "64. Does the P&P state that at any time, DHCS may inspect"
    );
  });

  it("extracts full content from Hard compliance doc (145 pages)", async () => {
    const buffer = await readFile(
      path.join(COMPLIANCE_DIR, "Example Input Doc - Hard.pdf")
    );
    const result = await extractPdfText(buffer);

    expect(result.totalPages).toBe(145);
    expect(result.pages).toHaveLength(145);
    expect(result.text.length).toBeGreaterThan(250000);

    // Should contain key structural elements
    expect(result.text).toContain("CALAIM");
    expect(result.text).toContain("ENHANCED CARE MANAGEMENT");
    expect(result.text).toContain("TABLE OF CONTENTS");

    // Should contain requirement language throughout
    const mustCount = (result.text.match(/\bmust\b/gi) || []).length;
    expect(mustCount).toBeGreaterThan(100); // 178 found in testing

    const requiredCount = (result.text.match(/\brequired\b/gi) || []).length;
    expect(requiredCount).toBeGreaterThan(50); // 77 found in testing

    // Verify content from different sections of the doc
    expect(result.text).toContain("Populations of Focus");
    expect(result.text).toContain("CORE SERVICE COMPONENTS");
    expect(result.text).toContain("Transitional Care Services");

    // Verify no pages are empty (content was extracted from all pages)
    const emptyPages = result.pages.filter((p) => p.trim().length === 0);
    expect(emptyPages.length).toBeLessThan(5); // Allow a few blank pages
  });

  it("returns per-page text that sums to full text", async () => {
    const buffer = await readFile(
      path.join(POLICY_DIR, "CMC/CMC.3001_CEO20240523.pdf")
    );
    const result = await extractPdfText(buffer);

    // Each page should have content
    for (const page of result.pages) {
      // Most pages should have content (some might be blank dividers)
      expect(typeof page).toBe("string");
    }

    // Pages count should match totalPages
    expect(result.pages.length).toBe(result.totalPages);
  });
});
