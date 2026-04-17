"use client";

import { useState, useCallback, useRef } from "react";
import type { ProgressEvent } from "@/lib/workflow/compliance-run";

export type RunStatus = "idle" | "starting" | "running" | "completed" | "error";

interface UseComplianceRunReturn {
  status: RunStatus;
  events: ProgressEvent[];
  runId: string | null;
  error: string | null;
  startRun: (complianceDocId: string, policyIds?: string[]) => Promise<void>;
  reset: () => void;
}

export function useComplianceRun(): UseComplianceRunReturn {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setEvents([]);
    setRunId(null);
    setError(null);
  }, []);

  const startRun = useCallback(
    async (complianceDocId: string, policyIds?: string[]) => {
      reset();
      setStatus("starting");

      try {
        // Start the workflow
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            complianceDocId,
            policyIds: policyIds?.length ? policyIds : undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Failed to start run (${res.status})`);
        }

        const { runId: newRunId } = await res.json();
        setRunId(newRunId);
        setStatus("running");

        // Connect to SSE stream
        const abort = new AbortController();
        abortRef.current = abort;

        const stream = await fetch(`/api/run/${newRunId}/stream`, {
          signal: abort.signal,
        });

        if (!stream.ok || !stream.body) {
          throw new Error("Failed to connect to progress stream");
        }

        const reader = stream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              setStatus("completed");
              return;
            }

            try {
              const event: ProgressEvent = JSON.parse(data);
              setEvents((prev) => [...prev, event]);

              if (event.type === "completed") {
                setStatus("completed");
              } else if (event.type === "error") {
                setError(event.message);
                setStatus("error");
              }
            } catch {
              // Skip malformed events
            }
          }
        }

        // Stream ended without explicit completion
        setStatus((prev) => (prev === "running" ? "completed" : prev));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setStatus("error");
      }
    },
    [reset]
  );

  return { status, events, runId, error, startRun, reset };
}
