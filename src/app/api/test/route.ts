export const runtime = "nodejs";

import "@/lib/polyfills";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Test 1: basic response
    const step1 = "basic works";

    // Test 2: database
    const { db } = await import("@/lib/db");
    const { complianceDocs } = await import("@/lib/db/schema");
    const docs = await db.select().from(complianceDocs).limit(1);
    const step2 = `db works, found ${docs.length} docs`;

    // Test 3: pdf-parse
    let step3 = "skipped";
    try {
      const { extractPdfText } = await import("@/lib/pdf");
      step3 = "pdf-parse imported ok";
    } catch (e) {
      step3 = `pdf-parse FAILED: ${e instanceof Error ? e.message : e}`;
    }

    // Test 4: AI SDK
    let step4 = "skipped";
    try {
      const { generateObject } = await import("ai");
      const { anthropic } = await import("@ai-sdk/anthropic");
      step4 = "ai sdk imported ok";
    } catch (e) {
      step4 = `ai sdk FAILED: ${e instanceof Error ? e.message : e}`;
    }

    return NextResponse.json({ step1, step2, step3, step4 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
