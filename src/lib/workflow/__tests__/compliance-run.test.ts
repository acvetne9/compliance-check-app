import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared state for capturing workflow events (must use vi.hoisted for vi.mock)
const { capturedEvents, mockReleaseLock, mockSleep } = vi.hoisted(() => ({
  capturedEvents: [] as string[],
  mockReleaseLock: vi.fn(),
  mockSleep: vi.fn(() => Promise.resolve()),
}));

// Mock workflow primitives
vi.mock("workflow", () => ({
  getWritable: vi.fn(() => ({
    getWriter: () => ({
      write: vi.fn((data: string) => {
        capturedEvents.push(data);
        return Promise.resolve();
      }),
      releaseLock: mockReleaseLock,
    }),
  })),
  sleep: mockSleep,
}));

// Mock AI modules
vi.mock("ai", () => ({
  embed: vi.fn(),
  embedMany: vi.fn(),
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));


vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mocked-model"),
}));

// Mock Vercel Blob
vi.mock("@vercel/blob", () => ({
  put: vi.fn(() => Promise.resolve({ url: "https://blob.test/file.pdf" })),
  del: vi.fn(() => Promise.resolve()),
  list: vi.fn(() => Promise.resolve({ blobs: [] })),
}));

// Mock pdf extraction
vi.mock("@/lib/pdf", () => ({
  extractPdfText: vi.fn(() =>
    Promise.resolve({
      text: "Test compliance document content.\n\n1. Does the P&P state requirement one?\n2. Does the P&P state requirement two?",
      pages: ["Page 1 content", "Page 2 content"],
      totalPages: 2,
    })
  ),
}));

// Mock requirement extraction
vi.mock("@/lib/ai/extract-requirements", () => ({
  extractRequirements: vi.fn(() =>
    Promise.resolve({
      requirements: [
        {
          id: "REQ-001",
          section: "1",
          page: 1,
          text: "Does the P&P state requirement one?",
          category: "compliance",
          keywords: ["P&P", "requirement"],
        },
        {
          id: "REQ-002",
          section: "2",
          page: 1,
          text: "Does the P&P state requirement two?",
          category: "compliance",
          keywords: ["P&P", "requirement"],
        },
      ],
      totalFound: 2,
      documentTitle: "Test Compliance Doc",
    })
  ),
}));

// Mock compliance checker
vi.mock("@/lib/ai/check-requirement", () => ({
  checkRequirement: vi.fn(() =>
    Promise.resolve([
      {
        policyId: "policy-1",
        policyFileName: "CMC.3001.pdf",
        result: {
          status: "met",
          confidence: 90,
          evidence: "Section 3 states this requirement is met.",
          reasoning: "Directly addressed.",
        },
        fromCache: false,
      },
    ])
  ),
}));

// Mock DB
const insertReturningFn = vi.fn();
const insertValuesFn = vi.fn();
const updateSetFn = vi.fn();
const updateWhereFn = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() =>
          Promise.resolve([
            {
              id: "doc-1",
              fileName: "Easy.pdf",
              blobUrl: "https://blob.test/Easy.pdf",
              pageCount: 14,
              uploadedAt: new Date(),
            },
          ])
        ),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() =>
          Promise.resolve([{ id: "req-" + Math.random().toString(36).slice(2, 8) }])
        ),
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

// Mock fetch for blob URL
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
  })
) as any;

import { complianceCheckWorkflow, type ProgressEvent } from "../compliance-run";

describe("complianceCheckWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.length = 0;
  });

  function getEvents(): ProgressEvent[] {
    return capturedEvents.map((e) => JSON.parse(e));
  }

  it("emits started event with runId", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    const events = getEvents();
    expect(events[0]).toEqual({
      type: "started",
      runId: "run-123",
      complianceDocId: "doc-1",
    });
  });

  it("emits extracting events", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    const events = getEvents();
    const extractingEvents = events.filter((e) => e.type === "extracting");
    expect(extractingEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("emits requirements_extracted with count", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    const events = getEvents();
    const extracted = events.find((e) => e.type === "requirements_extracted");
    expect(extracted).toBeDefined();
    expect(extracted!.type === "requirements_extracted" && extracted!.count).toBe(2);
  });

  it("emits checking and check_complete for each requirement", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    const events = getEvents();
    const checkingEvents = events.filter((e) => e.type === "checking");
    const completeEvents = events.filter((e) => e.type === "check_complete");
    expect(checkingEvents).toHaveLength(2);
    expect(completeEvents).toHaveLength(2);
  });

  it("emits completed event with totals", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    const events = getEvents();
    const completed = events.find((e) => e.type === "completed");
    expect(completed).toBeDefined();
    if (completed?.type === "completed") {
      expect(completed.runId).toBe("run-123");
      expect(completed.met).toBe(2);
      expect(completed.notMet).toBe(0);
      expect(completed.unclear).toBe(0);
    }
  });

  it("does not sleep between batches when under batch size", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    expect(mockSleep).not.toHaveBeenCalled();
  });

  it("streams progress events in correct order", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    const types = getEvents().map((e) => e.type);
    expect(types[0]).toBe("started");
    expect(types.indexOf("requirements_extracted")).toBeGreaterThan(
      types.indexOf("extracting")
    );
    expect(types.indexOf("completed")).toBe(types.length - 1);
  });

  it("releases writer lock on completion", async () => {
    await complianceCheckWorkflow("doc-1", null, "run-123");
    expect(mockReleaseLock).toHaveBeenCalled();
  });
});
