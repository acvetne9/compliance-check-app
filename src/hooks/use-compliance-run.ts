"use client";

import { useState, useCallback, useRef } from "react";
import type { ProgressEvent } from "@/types";

export type RunStatus = "idle" | "starting" | "running" | "completed" | "error";

interface UseComplianceRunReturn {
  status: RunStatus;
  events: ProgressEvent[];
  runId: string | null;
  error: string | null;
  startRun: (complianceDocId: string, policyIds?: string[]) => Promise<void>;
  resumeRun: (runId: string) => Promise<void>;
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

  const executeRun = useCallback(
    async (body: Record<string, unknown>) => {
      reset();
      setStatus("starting");

      try {
        const abort = new AbortController();
        abortRef.current = abort;

        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          let errorMsg = `Failed to start run (${res.status})`;
          try {
            const data = await res.json();
            errorMsg = data.error ?? errorMsg;
          } catch {}
          throw new Error(errorMsg);
        }

        setStatus("running");

        const reader = res.body.getReader();
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
              setStatus((prev) =>
                prev === "running" ? "completed" : prev
              );
              return;
            }

            try {
              const event: ProgressEvent = JSON.parse(data);
              setEvents((prev) => [...prev, event]);

              if (event.type === "started" && "runId" in event) {
                setRunId(event.runId);
              } else if (event.type === "completed") {
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

  const startRun = useCallback(
    async (complianceDocId: string, policyIds?: string[]) => {
      await executeRun({
        complianceDocId,
        policyIds: policyIds?.length ? policyIds : undefined,
      });
    },
    [executeRun]
  );

  const resumeRun = useCallback(
    async (resumeRunId: string) => {
      await executeRun({ resumeRunId });
    },
    [executeRun]
  );

  return { status, events, runId, error, startRun, resumeRun, reset };
}
