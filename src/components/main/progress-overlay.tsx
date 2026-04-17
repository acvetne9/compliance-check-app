"use client";

import { useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import type { ProgressEvent } from "@/types";

interface ProgressOverlayProps {
  events: ProgressEvent[];
  isRunning: boolean;
}

interface LiveRequirement {
  index: number;
  id: string;
  text: string;
  status: "pending" | "checking" | "met" | "not_met" | "unclear";
  policyCount?: number;
}

const STATUS_CONFIG: Record<string, { emoji: string; bg: string; text: string; border: string }> = {
  met: { emoji: "\u2705", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  not_met: { emoji: "\u274C", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  unclear: { emoji: "\u26A0\uFE0F", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export function ProgressOverlay({ events, isRunning }: ProgressOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const extractedEvent = events.find((e) => e.type === "requirements_extracted");
  const completedEvent = events.find((e) => e.type === "completed");
  const errorEvent = events.find((e) => e.type === "error");
  const extractingEvents = events.filter((e) => e.type === "extracting");
  const lastExtracting = extractingEvents[extractingEvents.length - 1];

  const totalRequirements =
    extractedEvent?.type === "requirements_extracted" ? extractedEvent.count : 0;

  // Build live requirement list from events
  const liveRequirements: LiveRequirement[] = [];
  const checkingEvents = events.filter((e) => e.type === "checking");
  const completeEvents = events.filter((e) => e.type === "check_complete");

  for (const e of checkingEvents) {
    if (e.type !== "checking") continue;
    if (!liveRequirements.find((r) => r.index === e.requirementIndex)) {
      liveRequirements.push({
        index: e.requirementIndex,
        id: `req-${e.requirementIndex}`,
        text: e.requirementText,
        status: "checking",
      });
    }
  }

  for (const e of completeEvents) {
    if (e.type !== "check_complete") continue;
    const req = liveRequirements.find((r) => r.index === e.requirementIndex);
    if (req) {
      req.status = e.status;
      req.id = e.requirementId;
      req.policyCount = e.policyCount;
    }
  }

  if (totalRequirements > 0) {
    for (let i = 0; i < totalRequirements; i++) {
      if (!liveRequirements.find((r) => r.index === i)) {
        liveRequirements.push({ index: i, id: `pending-${i}`, text: "", status: "pending" });
      }
    }
    liveRequirements.sort((a, b) => a.index - b.index);
  }

  const checkedCount = completeEvents.length;
  const metCount = completeEvents.filter((e) => e.type === "check_complete" && e.status === "met").length;
  const notMetCount = completeEvents.filter((e) => e.type === "check_complete" && e.status === "not_met").length;
  const unclearCount = completeEvents.filter((e) => e.type === "check_complete" && e.status === "unclear").length;

  useEffect(() => {
    if (scrollRef.current) {
      const lastChecked = scrollRef.current.querySelector("[data-active]");
      lastChecked?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [checkedCount]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 bg-card px-8 py-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {errorEvent ? (
              <AlertCircle className="size-5 text-destructive" />
            ) : completedEvent ? (
              <CheckCircle2 className="size-5 text-green-600" />
            ) : (
              <Loader2 className="size-5 animate-spin text-primary" />
            )}
            <h3 className="text-base font-semibold text-foreground">
              {errorEvent
                ? "Compliance Check Failed"
                : completedEvent
                  ? "Compliance Check Complete"
                  : !extractedEvent
                    ? lastExtracting?.type === "extracting"
                      ? lastExtracting.message
                      : "Starting compliance check..."
                    : `Checking requirements`}
            </h3>
          </div>

          {checkedCount > 0 && (
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-green-600">
                <span className="inline-block size-2 rounded-full bg-green-500" />
                {metCount}
              </span>
              <span className="flex items-center gap-1.5 text-red-600">
                <span className="inline-block size-2 rounded-full bg-red-500" />
                {notMetCount}
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="inline-block size-2 rounded-full bg-amber-400" />
                {unclearCount}
              </span>
            </div>
          )}
        </div>

        {totalRequirements > 0 && (
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>{checkedCount} of {totalRequirements} checked</span>
              <span>{Math.round((checkedCount / totalRequirements) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${Math.round((checkedCount / totalRequirements) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {errorEvent?.type === "error" && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errorEvent.message}</p>
        )}
      </div>

      {/* Live checklist */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        {liveRequirements.length === 0 && !extractedEvent && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="size-10 animate-spin text-primary/25" />
              <p className="text-sm text-muted-foreground">
                {lastExtracting?.type === "extracting"
                  ? lastExtracting.message
                  : "Analyzing document..."}
              </p>
            </div>
          </div>
        )}

        {liveRequirements.map((req) => {
          const config = req.status !== "pending" && req.status !== "checking"
            ? STATUS_CONFIG[req.status]
            : null;

          return (
            <div
              key={req.id}
              data-active={req.status === "checking" ? "" : undefined}
              className={`mx-6 my-1.5 flex items-start gap-3 rounded-lg px-4 py-3 transition-all ${
                req.status === "checking"
                  ? "bg-primary/5 ring-1 ring-primary/10"
                  : req.status === "pending"
                    ? "opacity-30"
                    : config
                      ? `${config.bg}/30 border-l-2 ${config.border}`
                      : ""
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {req.status === "checking" ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : req.status === "pending" ? (
                  <Circle className="size-4 text-muted-foreground/20" />
                ) : (
                  <span className="text-sm">{config?.emoji}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {req.index + 1}
                  </span>
                  {req.policyCount !== undefined && req.status !== "pending" && req.status !== "checking" && (
                    <span className="text-[10px] text-muted-foreground/60">
                      {req.policyCount} {req.policyCount === 1 ? "policy" : "policies"}
                    </span>
                  )}
                </div>
                {req.text ? (
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {req.text.length > 180 ? req.text.slice(0, 180) + "..." : req.text}
                  </p>
                ) : (
                  <div className="mt-1.5 h-3 w-3/4 rounded bg-muted/40" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
