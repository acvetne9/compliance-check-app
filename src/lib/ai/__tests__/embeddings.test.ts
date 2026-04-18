import { describe, it, expect, vi } from "vitest";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  policyChunks: { policyId: "policy_id", chunkIndex: "chunk_index" },
}));

import { getChunksForPolicy } from "../embeddings";

describe("getChunksForPolicy", () => {
  it("queries chunks for a given policy ID", async () => {
    const result = await getChunksForPolicy("test-policy-id");
    expect(result).toEqual([]);
  });
});
