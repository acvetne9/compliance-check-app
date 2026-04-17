import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile } from "fs/promises";
import path from "path";

// Mock external dependencies
vi.mock("ai", () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: { embedding: vi.fn(() => "mocked-embedding-model") },
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mocked-haiku-model"),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(() =>
    Promise.resolve({ url: "https://blob.vercel-storage.com/test.pdf" })
  ),
  del: vi.fn(() => Promise.resolve()),
  list: vi.fn(() => Promise.resolve({ blobs: [] })),
}));

vi.mock("@/lib/db", () => {
  const insertReturning = vi.fn(() =>
    Promise.resolve([{ id: "test-policy-id" }])
  );
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insertFn = vi.fn(() => ({ values: insertValues }));

  // For chunk inserts (no returning)
  const chunkInsertValues = vi.fn(() => Promise.resolve());
  const chunkInsertFn = vi.fn(() => ({ values: chunkInsertValues }));

  let callCount = 0;
  return {
    db: {
      insert: vi.fn(() => {
        callCount++;
        // First call = policies table, second = chunks table
        if (callCount % 2 === 1) return insertFn();
        return chunkInsertFn();
      }),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    },
  };
});

import { embedMany, generateText } from "ai";
import { extractAndChunkAsync, generatePolicySummary } from "../ingest";

const mockEmbedMany = vi.mocked(embedMany);
const mockGenerateText = vi.mocked(generateText);

const POLICY_DIR = path.resolve(__dirname, "../../../../Public Policies");
const COMPLIANCE_DIR = path.resolve(__dirname, "../../../../compliance");

describe("extractAndChunkAsync", () => {
  it("extracts and chunks a small policy PDF", async () => {
    const buffer = await readFile(
      path.join(POLICY_DIR, "CMC/CMC.3001_CEO20240523.pdf")
    );
    const { extraction, chunks } = await extractAndChunkAsync(buffer);

    expect(extraction.totalPages).toBe(6);
    expect(extraction.text).toContain("PURPOSE");
    expect(extraction.text).toContain("Capitation Payments");

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(20);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.pageStart).toBeGreaterThanOrEqual(0);
      expect(chunk.pageEnd).toBeGreaterThanOrEqual(chunk.pageStart);
    }
  });

  it("extracts and chunks the Hard compliance doc (145 pages)", async () => {
    const buffer = await readFile(
      path.join(COMPLIANCE_DIR, "Example Input Doc - Hard.pdf")
    );
    const { extraction, chunks } = await extractAndChunkAsync(buffer);

    expect(extraction.totalPages).toBe(145);
    expect(chunks.length).toBeGreaterThan(50);
    expect(chunks.length).toBeLessThan(300);

    // All chunks should have valid page ranges
    for (const chunk of chunks) {
      expect(chunk.pageStart).toBeGreaterThanOrEqual(0);
      expect(chunk.pageEnd).toBeLessThan(extraction.totalPages);
    }

    // Chunks should cover the full document
    const firstChunkPage = Math.min(...chunks.map((c) => c.pageStart));
    const lastChunkPage = Math.max(...chunks.map((c) => c.pageEnd));
    expect(firstChunkPage).toBe(0);
    expect(lastChunkPage).toBe(extraction.totalPages - 1);
  });

  it("produces chunks with section headers for structured docs", async () => {
    const buffer = await readFile(
      path.join(POLICY_DIR, "GA/GA.8048_CEO20250129_v20241231.pdf")
    );
    const { chunks } = await extractAndChunkAsync(buffer);

    const headers = chunks
      .map((c) => c.sectionHeader)
      .filter(Boolean);
    expect(headers.length).toBeGreaterThan(0);
  });

  it("preserves all 64 requirements from Easy compliance doc", async () => {
    const buffer = await readFile(
      path.join(COMPLIANCE_DIR, "Example Input Doc - Easy.pdf")
    );
    const { extraction, chunks } = await extractAndChunkAsync(buffer);

    // Verify all 64 requirements are present in the extracted text
    const allChunkText = chunks.map((c) => c.content).join(" ");
    for (let i = 1; i <= 64; i++) {
      expect(allChunkText).toContain(`${i}. Does the P&P`);
    }
  });
});

describe("generatePolicySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Haiku twice for summary and structured summary", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: "This policy establishes capitation payment procedures.",
      } as any)
      .mockResolvedValueOnce({
        text: '{"provisions":["Establishes payment process"],"requirements":["Must pay monthly"],"prohibitions":[]}',
      } as any);

    const result = await generatePolicySummary(
      "I. PURPOSE\nThis policy outlines payment procedures.",
      "CMC.3001.pdf"
    );

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(result.summary).toContain("capitation payment");
    expect(result.structuredSummary).toContain("provisions");
  });

  it("truncates text longer than 30000 chars", async () => {
    mockGenerateText
      .mockResolvedValueOnce({ text: "Summary" } as any)
      .mockResolvedValueOnce({ text: "{}" } as any);

    const longText = "A".repeat(40000);
    await generatePolicySummary(longText, "test.pdf");

    // Check the prompt sent to generateText was truncated
    const firstCall = mockGenerateText.mock.calls[0][0] as any;
    expect(firstCall.prompt.length).toBeLessThan(35000);
    expect(firstCall.prompt).toContain("[truncated]");
  });
});

describe("ingestPolicy (full pipeline with mocks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the full pipeline for a small policy", async () => {
    // Mock embeddings
    const fakeEmbeddings = Array.from({ length: 10 }, () =>
      Array.from({ length: 1536 }, () => Math.random())
    );
    mockEmbedMany.mockResolvedValueOnce({
      embeddings: fakeEmbeddings,
      values: [],
      usage: { tokens: 100 },
    } as any);

    // Mock summaries
    mockGenerateText
      .mockResolvedValueOnce({
        text: "This policy covers capitation payments.",
      } as any)
      .mockResolvedValueOnce({
        text: '{"provisions":[],"requirements":[],"prohibitions":[]}',
      } as any);

    // Import after mocks are set up
    const { ingestPolicy } = await import("../ingest");

    const buffer = await readFile(
      path.join(POLICY_DIR, "CMC/CMC.3001_CEO20240523.pdf")
    );
    const result = await ingestPolicy(buffer, "CMC.3001.pdf", "CMC");

    expect(result.policyId).toBe("test-policy-id");
    expect(result.fileName).toBe("CMC.3001.pdf");
    expect(result.folderId).toBe("CMC");
    expect(result.pageCount).toBe(6);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(result.summary).toContain("capitation");

    // Verify embeddings were generated
    expect(mockEmbedMany).toHaveBeenCalledTimes(1);
    // Verify summaries were generated
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });
});
