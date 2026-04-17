import { z } from "zod";

// ---------------------------------------------------------------------------
// Requirement extraction schema (output from Claude)
// ---------------------------------------------------------------------------

export const extractedRequirementSchema = z.object({
  id: z.string().describe("Sequential ID, e.g. 'REQ-001'"),
  section: z.string().describe("Section reference from the source document"),
  page: z.number().describe("Source page number (1-indexed)"),
  text: z.string().describe("The full requirement text"),
  category: z
    .string()
    .describe(
      "Category, e.g. 'hospice services', 'grievance', 'staffing', 'data privacy'"
    ),
  keywords: z
    .array(z.string())
    .describe("Key terms for search boosting"),
});

export const extractedRequirementsSchema = z.object({
  requirements: z.array(extractedRequirementSchema),
  totalFound: z.number().describe("Total number of requirements extracted"),
  documentTitle: z.string().describe("Title or identifier of the source document"),
});

export type ExtractedRequirement = z.infer<typeof extractedRequirementSchema>;
export type ExtractedRequirements = z.infer<typeof extractedRequirementsSchema>;

// ---------------------------------------------------------------------------
// Compliance check result schema (output from Claude)
// ---------------------------------------------------------------------------

export const complianceCheckSchema = z.object({
  status: z.enum(["met", "not_met", "unclear"]),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence score 0-100"),
  evidence: z
    .string()
    .describe("Quoted text from the policy demonstrating compliance, or explanation of gap"),
  reasoning: z
    .string()
    .describe("Brief explanation of the determination"),
});

export type ComplianceCheckResult = z.infer<typeof complianceCheckSchema>;

// ---------------------------------------------------------------------------
// Progress event types streamed during compliance runs
// ---------------------------------------------------------------------------

export type ProgressEvent =
  | { type: "started"; runId: string; complianceDocId: string }
  | { type: "extracting"; message: string }
  | {
      type: "requirements_extracted";
      count: number;
      documentTitle: string;
    }
  | {
      type: "checking";
      requirementIndex: number;
      totalRequirements: number;
      requirementText: string;
    }
  | {
      type: "check_complete";
      requirementIndex: number;
      requirementId: string;
      status: "met" | "not_met" | "unclear";
      policyCount: number;
    }
  | {
      type: "completed";
      runId: string;
      met: number;
      notMet: number;
      unclear: number;
    }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Requirement hash utility
// ---------------------------------------------------------------------------

/**
 * Normalize requirement text and produce a hash for cross-run caching.
 * Strips whitespace, lowercases, removes punctuation variations.
 */
export function hashRequirementText(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();

  // Simple hash using Web Crypto-compatible approach
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
