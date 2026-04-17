import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile } from "fs/promises";
import path from "path";

// Mock AI SDK
vi.mock("ai", () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: { embedding: vi.fn(() => "mocked-embedding-model") },
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mocked-sonnet-model"),
}));

import { generateObject } from "ai";
import { extractRequirements } from "../extract-requirements";
import {
  extractedRequirementsSchema,
  hashRequirementText,
  type ExtractedRequirements,
} from "@/types";

const mockGenerateObject = vi.mocked(generateObject);

const COMPLIANCE_DIR = path.resolve(__dirname, "../../../../../compliance");

describe("extractRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateObject with correct schema and Sonnet model", async () => {
    const mockResult: ExtractedRequirements = {
      requirements: [
        {
          id: "REQ-001",
          section: "Section 1",
          page: 1,
          text: "MCPs must provide hospice services.",
          category: "hospice services",
          keywords: ["hospice", "MCP", "services"],
        },
      ],
      totalFound: 1,
      documentTitle: "Test Document",
    };

    mockGenerateObject.mockResolvedValueOnce({
      object: mockResult,
    } as any);

    const result = await extractRequirements(
      "I. PURPOSE\nMCPs must provide hospice services.",
      "test.pdf"
    );

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateObject.mock.calls[0][0] as any;
    expect(callArgs.schema).toBe(extractedRequirementsSchema);
    expect(callArgs.prompt).toContain("test.pdf");
    expect(callArgs.prompt).toContain("MCPs must provide");

    expect(result.requirements).toHaveLength(1);
    expect(result.requirements[0].text).toContain("hospice services");
    expect(result.totalFound).toBe(1);
  });

  it("uses single-pass for documents under 80K tokens", async () => {
    // ~20K chars = ~5K tokens — well under 80K threshold
    const shortText = "A".repeat(20000);

    mockGenerateObject.mockResolvedValueOnce({
      object: {
        requirements: [],
        totalFound: 0,
        documentTitle: "Short Doc",
      },
    } as any);

    await extractRequirements(shortText, "short.pdf");
    // Should call generateObject exactly once (single pass)
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("uses multi-pass for documents over 80K tokens", async () => {
    // ~400K chars = ~100K tokens — over 80K threshold
    const longText = "Requirement. ".repeat(30000);

    // First 3 sections return requirements, rest return empty
    mockGenerateObject
      .mockResolvedValueOnce({
        object: {
          requirements: [
            { id: "REQ-001", section: "1", page: 1, text: "Req A", category: "general", keywords: [] },
          ],
          totalFound: 1,
          documentTitle: "Long Doc",
        },
      } as any)
      .mockResolvedValueOnce({
        object: {
          requirements: [
            { id: "REQ-001", section: "2", page: 50, text: "Req B", category: "general", keywords: [] },
          ],
          totalFound: 1,
          documentTitle: "Long Doc",
        },
      } as any)
      .mockResolvedValueOnce({
        object: {
          requirements: [
            { id: "REQ-001", section: "3", page: 100, text: "Req C", category: "general", keywords: [] },
          ],
          totalFound: 1,
          documentTitle: "Long Doc",
        },
      } as any)
      // All remaining sections return empty
      .mockResolvedValue({
        object: {
          requirements: [],
          totalFound: 0,
          documentTitle: "Long Doc",
        },
      } as any);

    const result = await extractRequirements(longText, "long.pdf");

    // Should call generateObject multiple times (multi-pass)
    expect(mockGenerateObject.mock.calls.length).toBeGreaterThan(1);
    // Requirements should be renumbered sequentially
    expect(result.requirements[0].id).toBe("REQ-001");
    expect(result.requirements[1].id).toBe("REQ-002");
    expect(result.requirements[2].id).toBe("REQ-003");
  });

  it("deduplicates requirements from overlapping sections", async () => {
    const longText = "A".repeat(400000);

    // Two sections return the same requirement
    const sharedReq = {
      id: "REQ-001",
      section: "1",
      page: 25,
      text: "Organizations must maintain documentation of all compliance activities.",
      category: "documentation",
      keywords: ["documentation", "compliance"],
    };

    mockGenerateObject
      .mockResolvedValueOnce({
        object: {
          requirements: [sharedReq, { ...sharedReq, id: "REQ-002", text: "Unique req from section 1." }],
          totalFound: 2,
          documentTitle: "Test",
        },
      } as any)
      .mockResolvedValueOnce({
        object: {
          requirements: [
            sharedReq, // duplicate from overlap
            { ...sharedReq, id: "REQ-002", text: "Unique req from section 2." },
          ],
          totalFound: 2,
          documentTitle: "Test",
        },
      } as any)
      .mockResolvedValue({
        object: { requirements: [], totalFound: 0, documentTitle: "Test" },
      } as any);

    const result = await extractRequirements(longText, "overlap.pdf");

    // The shared requirement should appear only once
    const texts = result.requirements.map((r) => r.text);
    const duplicates = texts.filter(
      (t) => t === "Organizations must maintain documentation of all compliance activities."
    );
    expect(duplicates).toHaveLength(1);
  });

  it("handles Easy compliance doc text correctly", async () => {
    const buffer = await readFile(
      path.join(COMPLIANCE_DIR, "Example Input Doc - Easy.pdf")
    );

    // Read the PDF to get text (using the real pdf-parse)
    const { extractPdfText } = await import("@/lib/pdf");
    const { text } = await extractPdfText(buffer);

    // Verify text is under 80K tokens (should use single pass)
    const estimatedTokens = Math.ceil(text.length / 4);
    expect(estimatedTokens).toBeLessThan(80000);

    // Mock the extraction response with realistic data
    const mockRequirements = Array.from({ length: 64 }, (_, i) => ({
      id: `REQ-${String(i + 1).padStart(3, "0")}`,
      section: `Item ${i + 1}`,
      page: Math.floor(i / 5) + 1,
      text: `Does the P&P state requirement ${i + 1}`,
      category: "hospice services",
      keywords: ["hospice", "P&P"],
    }));

    mockGenerateObject.mockResolvedValueOnce({
      object: {
        requirements: mockRequirements,
        totalFound: 64,
        documentTitle: "APL 25-008 Hospice Services Review",
      },
    } as any);

    const result = await extractRequirements(text, "Easy.pdf");

    expect(result.totalFound).toBe(64);
    expect(result.requirements).toHaveLength(64);
    // Single pass for this size doc
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it("handles Hard compliance doc text correctly", async () => {
    const buffer = await readFile(
      path.join(COMPLIANCE_DIR, "Example Input Doc - Hard.pdf")
    );

    const { extractPdfText } = await import("@/lib/pdf");
    const { text } = await extractPdfText(buffer);

    // Hard doc is ~70K tokens — should still fit in single pass
    const estimatedTokens = Math.ceil(text.length / 4);
    expect(estimatedTokens).toBeLessThan(80000);

    mockGenerateObject.mockResolvedValueOnce({
      object: {
        requirements: Array.from({ length: 150 }, (_, i) => ({
          id: `REQ-${String(i + 1).padStart(3, "0")}`,
          section: `Section ${Math.floor(i / 10) + 1}`,
          page: Math.floor(i / 2) + 1,
          text: `Requirement ${i + 1} about ECM compliance`,
          category: "enhanced care management",
          keywords: ["ECM", "CalAIM"],
        })),
        totalFound: 150,
        documentTitle: "CalAIM ECM Policy Guide",
      },
    } as any);

    const result = await extractRequirements(text, "Hard.pdf");

    expect(result.totalFound).toBe(150);
    expect(result.requirements).toHaveLength(150);
  });
});

describe("hashRequirementText", () => {
  it("produces consistent hashes for identical text", () => {
    const hash1 = hashRequirementText("MCPs must provide hospice services.");
    const hash2 = hashRequirementText("MCPs must provide hospice services.");
    expect(hash1).toBe(hash2);
  });

  it("produces same hash regardless of whitespace", () => {
    const hash1 = hashRequirementText("MCPs must provide hospice services.");
    const hash2 = hashRequirementText("MCPs  must  provide  hospice  services.");
    expect(hash1).toBe(hash2);
  });

  it("produces same hash regardless of case", () => {
    const hash1 = hashRequirementText("MCPs must provide hospice services.");
    const hash2 = hashRequirementText("mcps must provide hospice services.");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different text", () => {
    const hash1 = hashRequirementText("MCPs must provide hospice services.");
    const hash2 = hashRequirementText("MCPs must provide dental services.");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a non-empty string", () => {
    const hash = hashRequirementText("Any requirement text.");
    expect(hash.length).toBeGreaterThan(0);
    expect(typeof hash).toBe("string");
  });
});
