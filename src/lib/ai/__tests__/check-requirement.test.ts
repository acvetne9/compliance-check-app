import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("ai", () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
  generateText: vi.fn(),
  generateObject: vi.fn(),
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
  getChunksForPolicy: vi.fn(() => Promise.resolve([])),
}));

// Mock triage module
vi.mock("../triage", () => ({
  triagePolicies: vi.fn(() => Promise.resolve([])),
}));

import { generateObject } from "ai";
import { triagePolicies } from "../triage";
import { checkRequirement } from "../check-requirement";

const mockGenerateObject = vi.mocked(generateObject);
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

  it("returns empty results when no policies match triage", async () => {
    // DB returns policies but triage finds none relevant
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Cache lookup: empty
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
          }),
        };
      }
      // Policy records
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(
            Promise.resolve([{ id: "p1", fileName: "test.pdf", summary: "Test" }])
          ),
        }),
      };
    });

    mockTriage.mockResolvedValueOnce([]);

    const results = await checkRequirement(
      "MCPs must provide hospice services.",
      "hash123"
    );

    expect(results).toEqual([]);
  });

  it("returns cached results when available", async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(
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
    });

    // Pass policyIds so it returns early when all are cached
    const results = await checkRequirement(
      "MCPs must provide hospice services.",
      "hash123",
      { policyIds: ["policy-1"] }
    );

    expect(results).toHaveLength(1);
    expect(results[0].fromCache).toBe(true);
    expect(results[0].result.status).toBe("met");
    expect(results[0].policyFileName).toBe("CMC.3001.pdf");
  });

  it("skips cache when skipCache option is true", async () => {
    // DB returns policies for triage
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(
          Promise.resolve([{ id: "p1", fileName: "test.pdf", summary: "Test" }])
        ),
      }),
    });

    mockTriage.mockResolvedValueOnce([]);

    await checkRequirement("Test requirement.", "hash123", {
      skipCache: true,
    });

    // Triage should be called (pipeline proceeded past cache)
    expect(mockTriage).toHaveBeenCalled();
  });

  it("runs full pipeline: triage → deep check → cache", async () => {
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
          }),
        };
      } else if (selectCallCount === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([
                { id: "policy-1", fileName: "CMC.3001.pdf", summary: "Payment policy" },
                { id: "policy-2", fileName: "GA.8048.pdf", summary: "Smoking policy" },
              ])
            ),
          }),
        };
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue(
                Promise.resolve([
                  { content: "Full policy text about hospice.", pageStart: 0, pageEnd: 1, sectionHeader: "I. PURPOSE", tokenCount: 100 },
                ])
              ),
            }),
          }),
        };
      }
    });

    // Triage returns only policy-1 as relevant
    mockTriage.mockResolvedValueOnce([
      { policyId: "policy-1", relevance: "yes" as const },
    ]);

    // Deep check returns "met"
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

    expect(mockTriage).toHaveBeenCalledTimes(1);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("uses prompt caching for policy text in deep check", async () => {
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
          }),
        };
      } else if (selectCallCount === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(
              Promise.resolve([{ id: "p1", fileName: "test.pdf", summary: "Test" }])
            ),
          }),
        };
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue(
                Promise.resolve([{ content: "Policy content.", pageStart: 0, pageEnd: 0, sectionHeader: null, tokenCount: 50 }])
              ),
            }),
          }),
        };
      }
    });

    mockTriage.mockResolvedValueOnce([{ policyId: "p1", relevance: "yes" as const }]);

    mockGenerateObject.mockResolvedValueOnce({
      object: { status: "met", confidence: 85, evidence: "Found.", reasoning: "Match." },
    } as any);

    await checkRequirement("Test requirement.", "hash-test");

    const callArgs = mockGenerateObject.mock.calls[0][0] as any;
    expect(callArgs.messages).toBeDefined();
    expect(Array.isArray(callArgs.messages)).toBe(true);
    const policyMessage = callArgs.messages[1];
    expect(policyMessage.role).toBe("system");
    expect(policyMessage.content).toContain("POLICY DOCUMENT");
    expect(policyMessage.providerOptions?.anthropic?.cacheControl?.type).toBe("ephemeral");
  });
});
