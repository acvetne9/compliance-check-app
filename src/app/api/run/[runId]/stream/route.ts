import { NextRequest } from "next/server";
import { getRun } from "workflow/api";
import { db } from "@/lib/db";
import { complianceRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/run/[runId]/stream
 * SSE stream of compliance check progress.
 * Connects to the Vercel Workflow readable stream.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  // Get the workflow run ID from our DB
  const [run] = await db
    .select({ workflowRunId: complianceRuns.workflowRunId })
    .from(complianceRuns)
    .where(eq(complianceRuns.id, runId));

  if (!run?.workflowRunId) {
    return new Response(JSON.stringify({ error: "Run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get the workflow run and its readable stream
  const workflowRun = getRun(run.workflowRunId);
  const readable = workflowRun.getReadable();

  // Transform to SSE format
  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = readable.getReader();
      const encoder = new TextEncoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            break;
          }
          // Each value is already a JSON string from the workflow
          const sseMessage = `data: ${value}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
