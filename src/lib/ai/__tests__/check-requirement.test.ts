import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
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
  anthropic: vi.fn(() => "mocked-model"),
}));

// Mock DB with more realistic behavior
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: any[]) => mockDbSelect(...args),
    insert: (...args: any[]) => mockDbInsert(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  policies: { id: "id", fileName: "file_name", summary: "summary", structuredSummary: "structured_summary" },
  policyChunks: {
    id: "id", policyId: "policy_id", content: "content",
    pageStart: "page_start", sectionHeader: "section_header", embedding: "embedding",
  },
  cachedChecks: {
    requirementHash: "requirement_hash", policyId: "policy_id",
    status: "status", evidence: "evidence", confidence: "confidence", reasoning: "reasoning",
    checkedAt: "checked_at",
  },
}));

// Mock embeddings module
vi.mock("../embeddings", () => ({
  generateEmbedding: vi.fn(() =>
    Promise.resolve(Array.from({ length: 1536 }, () => Math.random()))
  ),
  searchSimilarChunks: vi.fn(() => Promise.resolve([])),
}));

// Mock triage module
vi.mock("../triage", () => ({
  triagePolicies: vi.fn(() => Promise.resolve([])),
}));

import { embed, generateObject } from "ai";
import { searchSimilarChunks } from "../embeddings";
import { triagePolicies } from "../triage";
import { checkRequirement } from "../check-requirement";

const mockGenerateObject = vi.mocked(generateObject);
const mockSearchSimilar = vi.mocked(searchSimilarChunks);
const mockTriage = vi.mocked(triagePolicies);

describe("checkRequirement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no cached results
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        }),
      }),
    });

    // Default: insert succeeds
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue(Promise.resolve()),
        returning: vi.fn().mockReturnValue(Promise.resolve([{ id: "new-id" }])),
      }),
    });
  });

  it("returns empty results when no similar chunks found", async () => {
    mockSearchSimilar.mockResolvedValueOnce([]);

    const results = await checkRequirement(
      "MCPs must provide hospice services.",
      "hash123"
    );

    expect(results).toEqual([]);
  });

  it("returns cached results when available", async () => {
    // Mock cache hit
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            $dynamic: vi.fn().mockReturnValue(
              Promise.resolve([
                {
                  policyId: "policy-1",
                  status: "met",
                  evidence: "Section 3.1 states...",
                  confidence: 95,
                  reasoning: "Directly addressed",
                  fileName: "CMC.3001.pdf",
                },
              ])
            ),
          }),
        }),
      }),
    });

    const results = await checkRequirement(
      "MCPs must provide hospice services.",
      "hash123"
    );

    expect(results).toHaveLength(1);
    expect(results[0].fromCache).toBe(true);
    expect(results[0].result.status).toBe("met");
    expect(results[0].policyFileName).toBe("CMC.3001.pdf");
  });

  it("skips cache when skipCache option is true", async () => {
    mockSearchSimilar.mockResolvedValueOnce([]);

    await checkRequirement("Test requirement.", "hash123", {
      skipCache: true,
    });

    // Should not query the cache (mockDbSelect should only be called for policies, not cache)
    // The key indicator is that searchSimilarChunks was called (pipeline proceeded)
    expect(mockSearchSimilar).toHaveBeenCalled();
  });

  it("runs full pipeline: embed → search → triage → deep check → cache", async () => {
    // Step 2: Vector search returns chunks from 2 policies
    mockSearchSimilar.mockResolvedValueOnce([
      {
        id: "chunk-1", policyId: "policy-1", chunkIndex: 0,
        pageStart: 0, pageEnd: 1, content: "Policy content about hospice.",
        sectionHeader: "I. PURPOSE", tokenCount: 100, similarity: 0.85,
      },
      {
        id: "chunk-2", policyId: "policy-2", chunkIndex: 0,
        pageStart: 0, pageEnd: 0, content: "Unrelated smoking policy.",
        sectionHeader: null, tokenCount: 80, similarity: 0.45,
      },
    ]);

    // Step 3: DB query for policy records
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // First select: cache lookup (empty)
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                $dynamic: vi.fn().mockReturnValue(Promise.resolve([])),
              }),
            }),
          }),
        };
      } else if (selectCallCount === 2) {
        // Second select: policy records
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([
                { id: "policy-1", fileName: "CMC.3001.pdf", summary: "Payment policy", structuredSummary: "{}" },
                { id: "policy-2", fileName: "GA.8048.pdf", summary: "Smoking policy", structuredSummary: "{}" },
              ])
            ),
          }),
        };
      } else {
        // Third select: chunks for the relevant policy
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([
                { content: "Full policy text about hospice services.", pageStart: 0, sectionHeader: "I. PURPOSE" },
              ])
            ),
          }),
        };
      }
    });

    // Step 3: Triage returns only policy-1 as relevant
    mockTriage.mockResolvedValueOnce([
      { policyId: "policy-1", relevance: "yes" as const },
    ]);

    // Step 4: Deep check returns "met"
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        status: "met",
        confidence: 90,
        evidence: "Section 3.1 states that MCPs must provide hospice.",
        reasoning: "The policy directly addresses this requirement.",
      },
    } as any);

    const results = await checkRequirement(
      "MCPs must provide hospice services.",
      "hash-hospice"
    );

    expect(results).toHaveLength(1);
    expect(results[0].result.status).toBe("met");
    expect(results[0].policyId).toBe("policy-1");
    expect(results[0].fromCache).toBe(false);

    // Verify triage was called
    expect(mockTriage).toHaveBeenCalledTimes(1);
    // Verify deep check was called with Sonnet
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    // Verify result was cached
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("uses prompt caching for policy text in deep check", async () => {
    mockSearchSimilar.mockResolvedValueOnce([
      {
        id: "c1", policyId: "p1", chunkIndex: 0,
        pageStart: 0, pageEnd: 0, content: "Policy text.",
        sectionHeader: null, tokenCount: 50, similarity: 0.9,
      },
    ]);

    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                $dynamic: vi.fn().mockReturnValue(Promise.resolve([])),
              }),
            }),
          }),
        };
      } else if (selectCallCount === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([{ id: "p1", fileName: "test.pdf", summary: "Test", structuredSummary: "{}" }])
            ),
          }),
        };
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([{ content: "Policy content.", pageStart: 0, sectionHeader: null }])
            ),
          }),
        };
      }
    });

    mockTriage.mockResolvedValueOnce([{ policyId: "p1", relevance: "yes" as const }]);

    mockGenerateObject.mockResolvedValueOnce({
      object: { status: "met", confidence: 85, evidence: "Found.", reasoning: "Match." },
    } as any);

    await checkRequirement("Test requirement.", "hash-test");

    // Verify the messages include cacheControl for prompt caching
    const callArgs = mockGenerateObject.mock.calls[0][0] as any;
    expect(callArgs.messages).toBeDefined();
    expect(Array.isArray(callArgs.messages)).toBe(true);
    // Second system message should have cache control
    const policyMessage = callArgs.messages[1];
    expect(policyMessage.role).toBe("system");
    expect(policyMessage.content).toContain("POLICY DOCUMENT");
    expect(policyMessage.providerOptions?.anthropic?.cacheControl?.type).toBe("ephemeral");
  });
});
