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

const STATUS_EMOJI: Record<string, string> = {
  met: "\u2705",
  not_met: "\u274C",
  unclear: "\u26A0\uFE0F",
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
    const existing = liveRequirements.find((r) => r.index === e.requirementIndex);
    if (!existing) {
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

  // Fill in pending slots
  if (totalRequirements > 0) {
    for (let i = 0; i < totalRequirements; i++) {
      if (!liveRequirements.find((r) => r.index === i)) {
        liveRequirements.push({
          index: i,
          id: `pending-${i}`,
          text: "",
          status: "pending",
        });
      }
    }
    liveRequirements.sort((a, b) => a.index - b.index);
  }

  const checkedCount = completeEvents.length;
  const metCount = completeEvents.filter(
    (e) => e.type === "check_complete" && e.status === "met"
  ).length;
  const notMetCount = completeEvents.filter(
    (e) => e.type === "check_complete" && e.status === "not_met"
  ).length;
  const unclearCount = completeEvents.filter(
    (e) => e.type === "check_complete" && e.status === "unclear"
  ).length;

  // Auto-scroll to the latest checked item
  useEffect(() => {
    if (scrollRef.current) {
      const lastChecked = scrollRef.current.querySelector("[data-active]");
      lastChecked?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [checkedCount]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {errorEvent ? (
              <AlertCircle className="size-4 text-destructive" />
            ) : completedEvent ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
            <h3 className="text-sm font-medium text-foreground">
              {errorEvent
                ? "Compliance Check Failed"
                : completedEvent
                  ? "Compliance Check Complete"
                  : !extractedEvent
                    ? lastExtracting?.type === "extracting"
                      ? lastExtracting.message
                      : "Starting compliance check..."
                    : `Checking requirements (${checkedCount}/${totalRequirements})`}
            </h3>
          </div>

          {checkedCount > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-green-500" />
                {metCount}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-red-500" />
                {notMetCount}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-amber-500" />
                {unclearCount}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalRequirements > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{
                width: `${Math.round((checkedCount / totalRequirements) * 100)}%`,
              }}
            />
          </div>
        )}

        {errorEvent?.type === "error" && (
          <p className="mt-2 text-xs text-destructive">{errorEvent.message}</p>
        )}
      </div>

      {/* Live checklist */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {liveRequirements.length === 0 && !extractedEvent && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="size-10 animate-spin text-primary/30" />
              <p className="text-sm text-muted-foreground">
                {lastExtracting?.type === "extracting"
                  ? lastExtracting.message
                  : "Analyzing document..."}
              </p>
            </div>
          </div>
        )}

        {liveRequirements.map((req) => (
          <div
            key={req.id}
            data-active={req.status === "checking" ? "" : undefined}
            className={`flex items-start gap-3 border-b border-border/20 px-6 py-3.5 transition-colors ${
              req.status === "checking"
                ? "bg-primary/5"
                : req.status === "pending"
                  ? "opacity-40"
                  : ""
            }`}
          >
            {/* Status indicator */}
            <div className="mt-0.5 shrink-0">
              {req.status === "checking" ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : req.status === "pending" ? (
                <Circle className="size-4 text-muted-foreground/30" />
              ) : (
                <span className="text-sm">{STATUS_EMOJI[req.status]}</span>
              )}
            </div>

            {/* Requirement text */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {req.index + 1}
                </span>
                {req.policyCount !== undefined && req.status !== "pending" && (
                  <span className="text-[10px] text-muted-foreground">
                    {req.policyCount} {req.policyCount === 1 ? "policy" : "policies"} checked
                  </span>
                )}
              </div>
              {req.text ? (
                <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
                  {req.text.length > 150
                    ? req.text.slice(0, 150) + "..."
                    : req.text}
                </p>
              ) : (
                <div className="mt-1 h-3 w-3/4 rounded bg-muted/50" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
