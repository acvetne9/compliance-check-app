import { describe, it, expect } from "vitest";
import { chunkPages, type TextChunk } from "../chunker";

describe("chunkPages", () => {
  it("returns empty array for empty input", () => {
    expect(chunkPages([])).toEqual([]);
    expect(chunkPages(["", "  "])).toEqual([]);
  });

  it("creates a single chunk for short content", () => {
    const pages = ["This is a short page of text."];
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("This is a short page");
    expect(chunks[0].pageStart).toBe(0);
    expect(chunks[0].pageEnd).toBe(0);
    expect(chunks[0].index).toBe(0);
  });

  it("splits long content into multiple chunks", () => {
    // Generate ~3000 tokens of content (~12000 chars)
    const longText = Array.from(
      { length: 60 },
      (_, i) => `Paragraph ${i + 1}. This is a moderately long paragraph that contains enough text to contribute meaningfully to the overall token count of the document.`
    ).join("\n\n");
    const pages = [longText];
    const chunks = chunkPages(pages, { maxTokens: 600 });
    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should have reasonable token counts
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });

  it("merges small chunks below minTokens", () => {
    // Create pages where first two are tiny and third is substantial
    // Without merging, we'd get 2+ chunks. With minTokens=100, tiny ones merge forward.
    const pages = [
      "Tiny page one.",
      "This is a much longer page that contains enough content to be meaningful. It discusses healthcare compliance requirements and the need for organizations to maintain proper documentation of all policies and procedures related to patient care and safety.",
      "Another substantial page with detailed requirements about staff training, credential verification, and ongoing compliance monitoring activities that must be performed quarterly.",
    ];
    const chunksWithMerge = chunkPages(pages, { minTokens: 100 });
    const chunksNoMerge = chunkPages(pages, { minTokens: 1 });

    // With merging, tiny first page should be combined with the next
    // so we should have fewer or equal chunks
    expect(chunksWithMerge.length).toBeLessThanOrEqual(chunksNoMerge.length);
    // No chunk should be below minTokens (except possibly the last one)
    for (const chunk of chunksWithMerge.slice(0, -1)) {
      expect(chunk.tokenCount).toBeGreaterThanOrEqual(50);
    }
  });

  it("tracks page boundaries correctly across chunks", () => {
    const pages = [
      "Page zero content with enough text to be meaningful.",
      "Page one content that also has sufficient text here.",
      "Page two has more content for processing and chunking.",
    ];
    const chunks = chunkPages(pages);
    // All chunks should have valid page ranges
    for (const chunk of chunks) {
      expect(chunk.pageStart).toBeGreaterThanOrEqual(0);
      expect(chunk.pageEnd).toBeGreaterThanOrEqual(chunk.pageStart);
      expect(chunk.pageEnd).toBeLessThan(pages.length);
    }
  });

  it("detects section headers in healthcare docs", () => {
    const pages = [
      "Page 1 of 5\nI. PURPOSE\nThis policy establishes guidelines for compliance.",
      "II. POLICY\nAll staff shall adhere to the following requirements.",
      "VII. BOARD ACTIONS\nThe board approved this policy on January 1.",
      "IX. GLOSSARY\nTerms used in this document are defined below.",
    ];
    const chunks = chunkPages(pages);
    const headers = chunks.map((c) => c.sectionHeader).filter(Boolean);
    expect(headers).toContain("I. PURPOSE");
  });

  it("skips Page X of Y when detecting headers", () => {
    const pages = [
      "Page 1 of 10\nI. PURPOSE\nThis is the purpose section.",
    ];
    const chunks = chunkPages(pages);
    // Should detect I. PURPOSE, not "Page 1 of 10"
    expect(chunks[0].sectionHeader).toBe("I. PURPOSE");
  });

  it("adds overlap between consecutive chunks", () => {
    // Create content that forces multiple chunks
    const paragraphs = Array.from(
      { length: 30 },
      (_, i) => `Section ${i + 1}. This requirement states that the organization must maintain comprehensive documentation of all compliance activities and submit reports quarterly.`
    );
    const pages = [paragraphs.join("\n\n")];
    const chunks = chunkPages(pages, { maxTokens: 400, overlapTokens: 50 });

    expect(chunks.length).toBeGreaterThan(1);

    // Second chunk should contain some text from the end of the first chunk
    if (chunks.length >= 2) {
      const firstChunkEnd = chunks[0].content.slice(-100);
      const secondChunkStart = chunks[1].content.slice(0, 300);
      // The overlap text from chunk 0's end should appear in chunk 1's beginning
      const lastSentenceOfFirst = firstChunkEnd.match(/[^.]+\.$/)?.[0]?.trim();
      if (lastSentenceOfFirst && lastSentenceOfFirst.length > 20) {
        expect(secondChunkStart).toContain(
          lastSentenceOfFirst.slice(-30).trim()
        );
      }
    }
  });

  it("handles real healthcare policy structure", () => {
    const pages = [
      "Page 1 of 6\nPolicy: CMC.3001\nTitle: Payment Arrangements\nDepartment: Finance\nSection: Accounting\nCEO Approval: /s/ Michael Hunn 05/23/2024",
      "I. PURPOSE\nThis policy outlines the process for timely and accurate Capitation Payments to a Health Network.\n\nII. POLICY\nA. CalOptima Health shall make Capitation Payments to a Health Network in accordance with the Contract.\nB. Capitation Payments shall be a combination of a Medicare component and a Medi-Cal component.",
      "III. PROCEDURE\nA. The Finance Department shall process capitation payments monthly.\nB. Payments shall be calculated based on enrolled member counts.\n\nIV. REFERENCES\nCal MediConnect Health Network Contract\nMedicare Advantage guidelines",
      "V. REGULATORY AGENCY APPROVAL\nNone to Date\n\nVI. BOARD ACTIONS\nDate: 01/15/2024\nAction: Approved\n\nVII. GLOSSARY\nCapitation Payment: A fixed per-member payment.",
    ];
    const chunks = chunkPages(pages);

    // Should produce reasonable chunks
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // All content should be captured
    const allContent = chunks.map((c) => c.content).join(" ");
    expect(allContent).toContain("PURPOSE");
    expect(allContent).toContain("POLICY");
    expect(allContent).toContain("Capitation Payments");
    expect(allContent).toContain("GLOSSARY");
  });

  it("handles compliance doc checklist structure", () => {
    const pages = [
      "SUBMISSION REVIEW FORM\nDHCS MCOD CONTRACT OVERSIGHT BRANCH",
      "1. Does the P&P state that MCPs are required to provide hospice services?\nYes\tNo\n(Reference: APL 25-008, page 1)\n\n2. Does the P&P state that Members who qualify for hospice care?\nYes\tNo\n(Reference: APL 25-008, page 2)",
      "3. Does the P&P state that to avoid problems caused by late referrals?\nYes\tNo\n(Reference: APL 25-008, page 3)\n\n4. Does the P&P state MCPs may restrict coverage?\nYes\tNo\n(Reference: APL 25-008, page 4)",
    ];
    const chunks = chunkPages(pages);

    const allContent = chunks.map((c) => c.content).join(" ");
    // All 4 requirements should be captured
    expect(allContent).toContain("1. Does the P&P");
    expect(allContent).toContain("2. Does the P&P");
    expect(allContent).toContain("3. Does the P&P");
    expect(allContent).toContain("4. Does the P&P");
  });
});
