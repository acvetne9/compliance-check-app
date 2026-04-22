import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceDocs, policies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/compliance/[id]/recommend
 * Returns policies ranked by relevance to the compliance doc's requirements.
 * Uses keyword matching against policy summaries — no API calls needed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(complianceDocs)
    .where(eq(complianceDocs.id, id));

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get requirement keywords from the pre-extracted requirements
  let keywords: string[] = [];
  if (doc.requirementsJson) {
    try {
      const extracted = JSON.parse(doc.requirementsJson);
      // Collect all keywords from requirements
      const allKeywords = new Set<string>();
      for (const req of extracted.requirements ?? []) {
        for (const kw of req.keywords ?? []) {
          allKeywords.add(kw.toLowerCase());
        }
        // Also extract key terms from requirement text
        const text = (req.text ?? "").toLowerCase();
        const terms = text.match(/\b[a-z]{4,}\b/g) ?? [];
        for (const t of terms) {
          if (!STOP_WORDS.has(t)) allKeywords.add(t);
        }
      }
      keywords = [...allKeywords];
    } catch {}
  }

  // Also extract terms from the doc text (or re-fetch if extracting)
  let docText = (doc.textContent ?? "").toLowerCase();
  if (!docText && doc.extractionStatus === "extracting") {
    // Extraction in progress — use filename terms for now
    docText = doc.fileName.toLowerCase().replace(/[._-]/g, " ");
  }
  if (docText) {
    const docTerms = docText.match(/\b[a-z]{5,}\b/g) ?? [];
    for (const t of docTerms.slice(0, 200)) {
      if (!STOP_WORDS.has(t)) keywords.push(t);
    }
  }

  // Deduplicate
  keywords = [...new Set(keywords)];

  if (keywords.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // Score each policy by how many keywords its summary contains
  const allPolicies = await db
    .select({
      id: policies.id,
      fileName: policies.fileName,
      folderId: policies.folderId,
      summary: policies.summary,
    })
    .from(policies);

  const scored = allPolicies
    .map((p) => {
      const summary = (p.summary ?? "").toLowerCase();
      const fileName = p.fileName.toLowerCase();
      let score = 0;

      for (const kw of keywords) {
        if (summary.includes(kw)) score++;
        if (fileName.includes(kw)) score += 2; // Filename match is stronger
      }

      return { ...p, score };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30); // Top 30 recommendations

  return NextResponse.json({
    recommendations: scored.map((p) => ({
      id: p.id,
      fileName: p.fileName,
      folderId: p.folderId,
      summary: p.summary?.slice(0, 150) ?? "",
      relevanceScore: p.score,
    })),
    totalKeywords: keywords.length,
  });
}

const STOP_WORDS = new Set([
  "that", "this", "with", "from", "have", "been", "will", "shall", "must",
  "should", "would", "could", "does", "their", "there", "these", "those",
  "which", "when", "where", "what", "about", "into", "upon", "such",
  "other", "each", "than", "more", "also", "only", "under", "after",
  "before", "between", "through", "during", "within", "without",
  "state", "states", "including", "includes", "include", "required",
  "requirements", "requires", "accordance", "pursuant", "provided",
  "providing", "provides", "ensure", "ensures", "establish",
  "established", "establishes", "policy", "procedure", "process",
  "services", "service", "member", "members", "health", "care",
  "provider", "providers", "coverage", "covered", "medical",
]);
