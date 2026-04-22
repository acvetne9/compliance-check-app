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
  const allKeywords = new Set<string>();
  if (doc.requirementsJson) {
    try {
      const extracted = JSON.parse(doc.requirementsJson);
      for (const req of extracted.requirements ?? []) {
        for (const kw of req.keywords ?? []) {
          const lower = kw.toLowerCase().trim();
          if (lower.length >= 3 && !STOP_WORDS.has(lower)) allKeywords.add(lower);
        }
        // Extract key terms from requirement text
        const text = (req.text ?? "").toLowerCase();
        const terms = text.match(/\b[a-z]{4,}\b/g) ?? [];
        for (const t of terms) {
          if (!STOP_WORDS.has(t)) allKeywords.add(t);
        }
      }
    } catch {}
  }

  // Fallback: extract terms from doc text or filename
  if (allKeywords.size === 0) {
    const fallbackText = (doc.textContent ?? doc.fileName ?? "")
      .toLowerCase()
      .replace(/[._-]/g, " ");
    const fallbackTerms = fallbackText.match(/\b[a-z]{4,}\b/g) ?? [];
    for (const t of fallbackTerms) {
      if (!STOP_WORDS.has(t)) allKeywords.add(t);
    }
  }

  const keywords = [...allKeywords];

  if (keywords.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // Build word-boundary regex for each keyword to avoid substring false positives
  const keywordPatterns = keywords.map((kw) => ({
    kw,
    re: new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  }));

  // Count how many policies each keyword appears in (for IDF-like weighting)
  const allPolicies = await db
    .select({
      id: policies.id,
      fileName: policies.fileName,
      folderId: policies.folderId,
      summary: policies.summary,
    })
    .from(policies);

  const docFreq = new Map<string, number>();
  for (const { kw, re } of keywordPatterns) {
    let count = 0;
    for (const p of allPolicies) {
      const text = `${p.summary ?? ""} ${p.fileName}`.toLowerCase();
      if (re.test(text)) count++;
    }
    docFreq.set(kw, count);
  }

  const totalPolicies = allPolicies.length || 1;

  const scored = allPolicies
    .map((p) => {
      const summary = (p.summary ?? "").toLowerCase();
      const fileName = p.fileName.toLowerCase();
      let score = 0;

      for (const { kw, re } of keywordPatterns) {
        const df = docFreq.get(kw) ?? 0;
        // Rare keywords (appearing in fewer policies) get higher weight
        const idf = df > 0 ? Math.log(totalPolicies / df) + 1 : 0;

        if (re.test(summary)) score += idf;
        if (re.test(fileName)) score += idf * 2; // Filename match is stronger
      }

      return { ...p, score: Math.round(score * 10) / 10 };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

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
  "organization", "organizations", "plan", "plans", "program",
  "programs", "based", "related", "applicable", "appropriate",
  "specific", "identify", "identified", "document", "documented",
  "maintain", "maintained", "written", "implement", "implemented",
]);
