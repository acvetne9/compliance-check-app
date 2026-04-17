import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { complianceDocs, complianceRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/compliance
 * List all compliance documents with their latest run status.
 */
export async function GET() {
  const docs = await db.select().from(complianceDocs).orderBy(desc(complianceDocs.uploadedAt));

  // Get latest run for each doc
  const docsWithRuns = await Promise.all(
    docs.map(async (doc) => {
      const [latestRun] = await db
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
        .where(eq(complianceRuns.complianceDocId, doc.id))
        .orderBy(desc(complianceRuns.startedAt))
        .limit(1);

      return { ...doc, latestRun: latestRun ?? null };
    })
  );

  return NextResponse.json({ docs: docsWithRuns });
}
