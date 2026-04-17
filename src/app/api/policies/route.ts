import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { policies } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/policies
 * Returns policy folders with document counts and individual docs.
 */
export async function GET() {
  const allPolicies = await db
    .select({
      id: policies.id,
      folderId: policies.folderId,
      fileName: policies.fileName,
      summary: policies.summary,
      pageCount: policies.pageCount,
      isIngested: policies.isIngested,
      createdAt: policies.createdAt,
    })
    .from(policies)
    .orderBy(policies.folderId, policies.fileName);

  // Group by folder
  const folders: Record<
    string,
    {
      folderId: string;
      docCount: number;
      docs: typeof allPolicies;
    }
  > = {};

  for (const policy of allPolicies) {
    if (!folders[policy.folderId]) {
      folders[policy.folderId] = {
        folderId: policy.folderId,
        docCount: 0,
        docs: [],
      };
    }
    folders[policy.folderId].docCount++;
    folders[policy.folderId].docs.push(policy);
  }

  return NextResponse.json({
    folders: Object.values(folders).sort((a, b) =>
      a.folderId.localeCompare(b.folderId)
    ),
    totalDocs: allPolicies.length,
  });
}
