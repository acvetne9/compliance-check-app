import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceDocs, complianceRuns } from "@/lib/db/schema";
import { eq, desc, or, isNull, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

/**
 * GET /api/compliance
 * List compliance docs: shared (seed) + user's own uploads.
 */
export async function GET() {
  const userId = await getUserId();

  // Show shared docs (userId=null) and user's own docs
  const docs = await db
    .select()
    .from(complianceDocs)
    .where(or(isNull(complianceDocs.userId), eq(complianceDocs.userId, userId ?? "")))
    .orderBy(desc(complianceDocs.uploadedAt));

  const docsWithRuns = await Promise.all(
    docs.map(async (doc) => {
      // Only show this user's runs
      const [latestRun] = userId
        ? await db
            .select({
              id: complianceRuns.id,
              status: complianceRuns.status,
              requirementsCount: complianceRuns.requirementsCount,
              metCount: complianceRuns.metCount,
              notMetCount: complianceRuns.notMetCount,
              unclearCount: complianceRuns.unclearCount,
              completedAt: complianceRuns.completedAt,
            })
            .from(complianceRuns)
            .where(and(eq(complianceRuns.complianceDocId, doc.id), eq(complianceRuns.userId, userId)))
            .orderBy(desc(complianceRuns.startedAt))
            .limit(1)
        : [];

      return { ...doc, latestRun: latestRun ?? null };
    })
  );

  return NextResponse.json({ docs: docsWithRuns });
}
