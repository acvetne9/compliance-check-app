import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI SDK
vi.mock("ai", () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
}));

// Mock the OpenAI provider
vi.mock("@ai-sdk/openai", () => ({
  openai: {
    embedding: vi.fn(() => "mocked-embedding-model"),
  },
}));

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  },
}));

import { embed, embedMany } from "ai";
import {
  generateEmbedding,
  generateEmbeddings,
  searchSimilarChunks,
} from "../embeddings";

const mockEmbed = vi.mocked(embed);
const mockEmbedMany = vi.mocked(embedMany);

describe("generateEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls embed with the correct model and value", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, () => Math.random());
    mockEmbed.mockResolvedValueOnce({
      embedding: fakeEmbedding,
      value: "test text",
      usage: { tokens: 5 },
      rawResponse: undefined,
      providerMetadata: undefined,
      response: { id: "test", modelId: "test", timestamp: new Date(), headers: {} },
    } as any);

    const result = await generateEmbedding("test text");

    expect(mockEmbed).toHaveBeenCalledWith({
      model: "mocked-embedding-model",
      value: "test text",
    });
    expect(result).toEqual(fakeEmbedding);
    expect(result).toHaveLength(1536);
  });

  it("returns a 1536-dimensional vector", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, () => Math.random());
    mockEmbed.mockResolvedValueOnce({
      embedding: fakeEmbedding,
      value: "compliance requirement about grievance procedures",
      usage: { tokens: 8 },
    } as any);

    const result = await generateEmbedding(
      "compliance requirement about grievance procedures"
    );
    expect(result).toHaveLength(1536);
    expect(result.every((v) => typeof v === "number")).toBe(true);
  });
});

describe("generateEmbeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls embedMany with correct parameters and concurrency limit", async () => {
    const texts = [
      "requirement about staffing ratios",
      "requirement about grievance procedures",
      "requirement about data privacy",
    ];
    const fakeEmbeddings = texts.map(() =>
      Array.from({ length: 1536 }, () => Math.random())
    );

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: fakeEmbeddings,
      values: texts,
      usage: { tokens: 30 },
    } as any);

    const result = await generateEmbeddings(texts);

    expect(mockEmbedMany).toHaveBeenCalledWith({
      model: "mocked-embedding-model",
      values: texts,
      maxParallelCalls: 10,
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1536);
  });

  it("handles empty input array", async () => {
    mockEmbedMany.mockResolvedValueOnce({
      embeddings: [],
      values: [],
      usage: { tokens: 0 },
    } as any);

    const result = await generateEmbeddings([]);
    expect(result).toEqual([]);
  });

  it("handles large batch of texts", async () => {
    const texts = Array.from(
      { length: 100 },
      (_, i) => `Requirement ${i}: The organization must comply with regulation ${i}.`
    );
    const fakeEmbeddings = texts.map(() =>
      Array.from({ length: 1536 }, () => Math.random())
    );

    mockEmbedMany.mockResolvedValueOnce({
      embeddings: fakeEmbeddings,
      values: texts,
      usage: { tokens: 1500 },
    } as any);

    const result = await generateEmbeddings(texts);
    expect(result).toHaveLength(100);
    // Verify concurrency limit is set
    expect(mockEmbedMany).toHaveBeenCalledWith(
      expect.objectContaining({ maxParallelCalls: 10 })
    );
  });
});

describe("searchSimilarChunks", () => {
  it("accepts a query embedding and returns results", async () => {
    const queryEmbedding = Array.from({ length: 1536 }, () => Math.random());
    const results = await searchSimilarChunks(queryEmbedding);
    // With mocked DB returning [], should return empty
    expect(results).toEqual([]);
  });

  it("accepts custom limit and minSimilarity options", async () => {
    const queryEmbedding = Array.from({ length: 1536 }, () => Math.random());
    const results = await searchSimilarChunks(queryEmbedding, {
      limit: 5,
      minSimilarity: 0.5,
    });
    expect(results).toEqual([]);
  });
});
