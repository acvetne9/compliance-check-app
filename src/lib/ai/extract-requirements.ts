import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  extractedRequirementsSchema,
  type ExtractedRequirements,
} from "@/types";

const SYSTEM_PROMPT = `You are a healthcare compliance analyst. Your task is to parse a compliance document and extract every individual, discrete requirement.

A "requirement" is any statement that mandates, prohibits, or sets standards for specific behavior, process, documentation, staffing, timing, or reporting.

For checklist-style documents (e.g. "Does the P&P state..."), each numbered item is a separate requirement. Extract the full text of each item.

For policy guide documents (unstructured), extract every "must", "shall", "required to", and mandatory obligation as a separate requirement. Be thorough — do not miss requirements buried in subsections, footnotes, or appendices.

Rules:
- Each requirement must be independently verifiable against organizational policies
- Include the exact page number and section reference
- Do not summarize — preserve the full requirement language
- If a single paragraph contains multiple requirements, split them into separate entries
- Assign a category to each requirement (e.g. "hospice services", "grievance procedures", "staffing", "data privacy", "billing", "quality improvement")
- Include 2-5 keywords per requirement for search purposes`;

/**
 * Extract all compliance requirements from a document's full text.
 * Uses Claude Sonnet 4.6 with structured output.
 *
 * For documents up to ~60K tokens (150 pages), sends the full text in one call.
 * For larger documents, splits into overlapping sections and deduplicates.
 */
export async function extractRequirements(
  fullText: string,
  fileName: string
): Promise<ExtractedRequirements> {
  const estimatedTokens = Math.ceil(fullText.length / 4);

  if (estimatedTokens <= 80000) {
    // Single-pass extraction for docs that fit in context
    return extractRequirementsSinglePass(fullText, fileName);
  }

  // Multi-pass for very large documents
  return extractRequirementsMultiPass(fullText, fileName);
}

/**
 * Extract requirements by sending raw PDF bytes to Claude's native PDF support.
 * This bypasses pdf-parse entirely — useful in serverless where pdfjs-dist fails.
 */
export async function extractRequirementsFromPdf(
  pdfBuffer: Buffer | Uint8Array,
  fileName: string
): Promise<ExtractedRequirements> {
  const base64 = Buffer.from(pdfBuffer).toString("base64");

  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: extractedRequirementsSchema,
    maxOutputTokens: 64000,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: [
          {
            type: "file" as const,
            data: base64,
            mediaType: "application/pdf" as const,
          },
          {
            type: "text" as const,
            text: `Extract all compliance requirements from this document: ${fileName}`,
          },
        ],
      },
    ],
  });

  return object;
}

async function extractRequirementsSinglePass(
  fullText: string,
  fileName: string
): Promise<ExtractedRequirements> {
  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: extractedRequirementsSchema,
    system: SYSTEM_PROMPT,
    prompt: `Document: ${fileName}\n\n${fullText}`,
    maxOutputTokens: 64000,
  });

  return object;
}

async function extractRequirementsMultiPass(
  fullText: string,
  fileName: string
): Promise<ExtractedRequirements> {
  // Split into overlapping sections (~50K chars each with 5K overlap)
  const sectionSize = 50000;
  const overlap = 5000;
  const sections: string[] = [];

  for (let i = 0; i < fullText.length; i += sectionSize - overlap) {
    sections.push(fullText.slice(i, i + sectionSize));
  }

  // Extract from each section
  const allRequirements: ExtractedRequirements["requirements"] = [];
  let documentTitle = "";

  for (let i = 0; i < sections.length; i++) {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: extractedRequirementsSchema,
      system: SYSTEM_PROMPT,
      prompt: `Document: ${fileName} (Section ${i + 1} of ${sections.length})\n\n${sections[i]}`,
      maxOutputTokens: 32000,
    });

    if (i === 0) documentTitle = object.documentTitle;

    // Re-number requirements to be globally unique
    for (const req of object.requirements) {
      req.id = `REQ-${String(allRequirements.length + 1).padStart(3, "0")}`;
      allRequirements.push(req);
    }
  }

  // Deduplicate by comparing requirement text similarity
  const deduped = deduplicateRequirements(allRequirements);

  return {
    requirements: deduped,
    totalFound: deduped.length,
    documentTitle,
  };
}

/**
 * Remove near-duplicate requirements that appear in overlapping sections.
 * Uses normalized text comparison.
 */
function deduplicateRequirements(
  requirements: ExtractedRequirements["requirements"]
): ExtractedRequirements["requirements"] {
  const seen = new Set<string>();
  const result: ExtractedRequirements["requirements"] = [];

  for (const req of requirements) {
    const normalized = req.text
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200); // Compare first 200 chars

    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(req);
    }
  }

  // Re-number after deduplication
  return result.map((req, i) => ({
    ...req,
    id: `REQ-${String(i + 1).padStart(3, "0")}`,
  }));
}
