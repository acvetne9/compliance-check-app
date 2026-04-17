import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mocked-haiku-model"),
}));


import { generateObject } from "ai";
import { triagePolicies } from "../triage";

const mockGenerateObject = vi.mocked(generateObject);

describe("triagePolicies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty policy list", async () => {
    const result = await triagePolicies("MCPs must provide hospice.", []);
    expect(result).toEqual([]);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("filters out 'no' results and returns only yes/maybe", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        relevant: [
          { policyId: "p1", relevance: "yes" },
          { policyId: "p2", relevance: "no" },
          { policyId: "p3", relevance: "maybe" },
        ],
      },
    } as any);

    const result = await triagePolicies("MCPs must provide hospice.", [
      { policyId: "p1", fileName: "CMC.3001.pdf", summary: "Capitation payments" },
      { policyId: "p2", fileName: "GA.8048.pdf", summary: "Smoking restrictions" },
      { policyId: "p3", fileName: "MA.4015.pdf", summary: "Hospice services" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ policyId: "p1", relevance: "yes" });
    expect(result[1]).toEqual({ policyId: "p3", relevance: "maybe" });
  });

  it("sends requirement and policy summaries in prompt", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { relevant: [] },
    } as any);

    await triagePolicies("Staffing ratios must meet state requirements.", [
      { policyId: "p1", fileName: "HR.001.pdf", summary: "HR staffing policy" },
    ]);

    const callArgs = mockGenerateObject.mock.calls[0][0] as any;
    expect(callArgs.prompt).toContain("Staffing ratios");
    expect(callArgs.prompt).toContain("[p1] HR.001.pdf: HR staffing policy");
  });

  it("uses Haiku model for cost efficiency", async () => {
    const { anthropic } = await import("@ai-sdk/anthropic");
    mockGenerateObject.mockResolvedValueOnce({
      object: { relevant: [] },
    } as any);

    await triagePolicies("Test requirement.", [
      { policyId: "p1", fileName: "test.pdf", summary: "test" },
    ]);

    expect(anthropic).toHaveBeenCalledWith("claude-haiku-4-5-20251001");
  });
});
