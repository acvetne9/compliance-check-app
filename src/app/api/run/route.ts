export const runtime = "nodejs";
export const maxDuration = 300;

import "@/lib/polyfills";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  complianceDocs,
  complianceRuns,
  requirements as requirementsTable,
  complianceResults,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractPdfText } from "@/lib/pdf";
import { extractRequirements } from "@/lib/ai/extract-requirements";
import { checkRequirement } from "@/lib/ai/check-requirement";
import { hashRequirementText } from "@/types";

/**
 * POST /api/run
 * Start a compliance check. Streams progress as SSE.
 */
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { complianceDocId, policyIds } = body;

    if (!complianceDocId) {
      return NextResponse.json(
        { error: "Missing complianceDocId" },
        { status: 400 }
      );
    }

    // Verify doc exists
    const [doc] = await db
      .select()
      .from(complianceDocs)
      .where(eq(complianceDocs.id, complianceDocId));

    if (!doc) {
      return NextResponse.json(
        { error: "Compliance doc not found" },
        { status: 404 }
      );
    }

    // Create run record
    const [run] = await db
      .insert(complianceRuns)
      .values({ complianceDocId, status: "extracting" })
      .returning();

    // Stream SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          } catch {}
        };

        try {
          send({ type: "started", runId: run.id, complianceDocId });
          send({ type: "extracting", message: "Fetching compliance document..." });

          // Fetch PDF from blob
          const response = await fetch(doc.blobUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          const extraction = await extractPdfText(buffer);

          send({
            type: "extracting",
            message: "Extracting compliance requirements with Claude...",
          });

          // Extract requirements
          const extracted = await extractRequirements(
            extraction.text,
            doc.fileName
          );

          send({
            type: "requirements_extracted",
            count: extracted.totalFound,
            documentTitle: extracted.documentTitle,
          });

          // Save requirements to DB
          const savedReqs: Array<{ id: string; text: string; hash: string }> = [];
          for (const req of extracted.requirements) {
            const hash = hashRequirementText(req.text);
            const [saved] = await db
              .insert(requirementsTable)
              .values({
                complianceRunId: run.id,
                externalId: req.id,
                section: req.section,
                text: req.text,
                textHash: hash,
                category: req.category,
              })
              .returning({ id: requirementsTable.id });
            savedReqs.push({ id: saved.id, text: req.text, hash });
          }

          await db
            .update(complianceRuns)
            .set({ status: "checking", requirementsCount: savedReqs.length })
            .where(eq(complianceRuns.id, run.id));

          // Check each requirement
          let met = 0;
          let notMet = 0;
          let unclear = 0;

          for (let i = 0; i < savedReqs.length; i++) {
            const req = savedReqs[i];

            send({
              type: "checking",
              requirementIndex: i,
              totalRequirements: savedReqs.length,
              requirementText: req.text.slice(0, 120),
            });

            const checks = await checkRequirement(req.text, req.hash, {
              policyIds: policyIds ?? undefined,
            });

            let aggregatedStatus = "not_met";
            if (checks.some((c) => c.result.status === "met")) {
              aggregatedStatus = "met";
            } else if (checks.some((c) => c.result.status === "unclear")) {
              aggregatedStatus = "unclear";
            }

            if (aggregatedStatus === "met") met++;
            else if (aggregatedStatus === "not_met") notMet++;
            else unclear++;

            await db
              .update(requirementsTable)
              .set({ aggregatedStatus })
              .where(eq(requirementsTable.id, req.id));

            for (const check of checks) {
              await db.insert(complianceResults).values({
                requirementId: req.id,
                policyId: check.policyId,
                complianceRunId: run.id,
                status: check.result.status,
                evidence: check.result.evidence,
                confidence: check.result.confidence,
                reasoning: check.result.reasoning,
              });
            }

            send({
              type: "check_complete",
              requirementIndex: i,
              requirementId: req.id,
              status: aggregatedStatus,
              policyCount: checks.length,
            });
          }

          await db
            .update(complianceRuns)
            .set({
              status: "completed",
              metCount: met,
              notMetCount: notMet,
              unclearCount: unclear,
              completedAt: new Date(),
            })
            .where(eq(complianceRuns.id, run.id));

          send({ type: "completed", runId: run.id, met, notMet, unclear });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          send({ type: "error", message });

          await db
            .update(complianceRuns)
            .set({ status: "failed" })
            .where(eq(complianceRuns.id, run.id))
            .catch(() => {});
        } finally {
          try {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500 }
    );
  }
}
