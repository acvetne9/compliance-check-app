"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import type { ProgressEvent } from "@/types";

interface ProgressOverlayProps {
  events: ProgressEvent[];
  isRunning: boolean;
  /** When set, only show checklist for this policy */
  filterPolicyId?: string | null;
}

const STATUS_CONFIG: Record<string, { emoji: string; label: string; bg: string; text: string; border: string }> = {
  met: { emoji: "\u2705", label: "Met", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  not_met: { emoji: "\u274C", label: "Not Met", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  not_applicable: { emoji: "\u2796", label: "N/A", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
  unclear: { emoji: "\u26A0\uFE0F", label: "Unclear", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

function ExpandableCheckItem({ event: e }: { event: Extract<ProgressEvent, { type: "check_complete" }> }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[e.status];

  return (
    <div className={`mx-3 my-0.5 rounded-md border-l-2 ${config.border} ${config.bg}/30`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left"
      >
        <span className="mt-0.5 shrink-0 text-xs">{config.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-secondary px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
              {e.externalId}
            </span>
            <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${config.bg} ${config.text}`}>
              {config.label}
            </span>
          </div>
          <p className={`mt-0.5 text-[11px] leading-snug text-foreground/80 ${expanded ? "" : "line-clamp-2"}`}>
            {e.requirementText}
          </p>
        </div>
        <ChevronDown className={`mt-0.5 size-3 shrink-0 text-muted-foreground/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-border/20 px-3 py-2 pl-8">
          {e.evidence && (
            <blockquote className="rounded bg-card p-1.5 text-[10px] leading-relaxed text-muted-foreground border-l-2 border-primary/20 italic">
              {e.evidence}
            </blockquote>
          )}
          {e.reasoning && (
            <p className="mt-1 text-[10px] text-muted-foreground/80">{e.reasoning}</p>
          )}
          {!e.evidence && !e.reasoning && (
            <p className="text-[10px] text-muted-foreground/50">No details available.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProgressOverlay({ events, isRunning, filterPolicyId }: ProgressOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const extractedEvent = events.find((e) => e.type === "requirements_extracted");
  const completedEvent = events.find((e) => e.type === "completed");
  const errorEvent = events.find((e) => e.type === "error");
  const extractingEvents = events.filter((e) => e.type === "extracting");
  const lastExtracting = extractingEvents[extractingEvents.length - 1];

  const policyStarts = events.filter((e) => e.type === "policy_start");
  const policyDones = events.filter((e) => e.type === "policy_done");
  const checkCompletes = events.filter((e) => e.type === "check_complete");

  // When filtering to a specific policy, show that policy's checklist
  // Otherwise show the currently-being-checked policy
  const targetPolicyId = filterPolicyId
    ?? (policyStarts.length > 0 && policyStarts[policyStarts.length - 1].type === "policy_start"
      ? policyStarts[policyStarts.length - 1].policyId
      : null);

  const targetPolicyStart = policyStarts.find(
    (e) => e.type === "policy_start" && e.policyId === targetPolicyId
  );
  const targetPolicyChecks = checkCompletes
    .filter((e) => e.type === "check_complete" && e.policyId === targetPolicyId)
    .sort((a, b) => {
      if (a.type !== "check_complete" || b.type !== "check_complete") return 0;
      return a.requirementIndex - b.requirementIndex;
    });
  const totalReqs = targetPolicyStart?.type === "policy_start" ? targetPolicyStart.requirementCount : 0;
  const checkedCount = targetPolicyChecks.length;

  const targetPolicyName = targetPolicyStart?.type === "policy_start"
    ? targetPolicyStart.policyFileName.replace(/\.pdf$/i, "") : "";

  // Overall progress
  const totalPolicies = policyStarts.length > 0 && policyStarts[0].type === "policy_start"
    ? policyStarts[0].totalPolicies : 0;
  const donePolicies = policyDones.length;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [checkedCount, donePolicies]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
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
                    ? lastExtracting?.type === "extracting" ? lastExtracting.message : "Starting..."
                    : targetPolicyName
                      ? `Checking: ${targetPolicyName}`
                      : "Preparing checks..."}
            </h3>
          </div>

          {totalPolicies > 0 && (
            <span className="text-xs text-muted-foreground">
              Policy {Math.min(donePolicies + 1, totalPolicies)} of {totalPolicies}
            </span>
          )}
        </div>

        {/* Overall policy progress */}
        {totalPolicies > 0 && (
          <div className="mb-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary/60 transition-all duration-500"
                style={{ width: `${Math.round((donePolicies / totalPolicies) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Per-policy requirement progress */}
        {totalReqs > 0 && !completedEvent && (
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Requirements: {checkedCount} / {totalReqs}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round((checkedCount / totalReqs) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {errorEvent?.type === "error" && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errorEvent.message}</p>
        )}
      </div>

      {/* Live checklist for current policy */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        {/* Completed policies summary (only when not filtering to a specific policy) */}
        {!filterPolicyId && policyDones.map((e) => {
          if (e.type !== "policy_done") return null;
          const total = e.met + e.notMet + e.unclear;
          return (
            <div key={e.policyId} className="mx-3 mb-1.5 rounded-md bg-card px-3 py-2 ring-1 ring-border/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {e.policyFileName.replace(/\.pdf$/i, "")}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  {e.met > 0 && <span className="text-green-600">{e.met} met</span>}
                  {e.notMet > 0 && <span className="text-red-600">{e.notMet} not met</span>}
                  {e.unclear > 0 && <span className="text-amber-600">{e.unclear} unclear</span>}
                </div>
              </div>
              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-secondary">
                {e.met > 0 && <div className="bg-green-500" style={{ width: `${(e.met / total) * 100}%` }} />}
                {e.unclear > 0 && <div className="bg-amber-400" style={{ width: `${(e.unclear / total) * 100}%` }} />}
                {e.notMet > 0 && <div className="bg-red-500" style={{ width: `${(e.notMet / total) * 100}%` }} />}
              </div>
            </div>
          );
        })}

        {/* Waiting state when viewing a policy that hasn't started yet */}
        {filterPolicyId && !targetPolicyStart && !completedEvent && !errorEvent && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-primary/30" />
              <p className="text-sm text-muted-foreground">Waiting to check this policy...</p>
            </div>
          </div>
        )}

        {/* Target policy checks */}
        {targetPolicyId && (
          <>
            {targetPolicyChecks.map((e) => {
              if (e.type !== "check_complete") return null;
              return <ExpandableCheckItem key={`${e.policyId}-${e.requirementIndex}`} event={e} />;
            })}

            {/* Pending indicator */}
            {checkedCount < totalReqs && (
              <div className="mx-3 my-0.5 flex items-center gap-2 rounded-md px-3 py-1.5 opacity-40">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  Checking requirement {checkedCount + 1}...
                </span>
              </div>
            )}
          </>
        )}

        {/* Pre-extraction state — only show in overview, not per-policy view */}
        {!filterPolicyId && !extractedEvent && !errorEvent && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="size-10 animate-spin text-primary/25" />
              <p className="text-sm text-muted-foreground">
                {lastExtracting?.type === "extracting" ? lastExtracting.message : "Analyzing document..."}
              </p>
            </div>
          </div>
        )}

        {/* Post-extraction, pre-policy state */}
        {!filterPolicyId && extractedEvent && policyStarts.length === 0 && !completedEvent && !errorEvent && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-primary/30" />
              <p className="text-sm text-muted-foreground">
                Found {extractedEvent.type === "requirements_extracted" ? extractedEvent.count : 0} requirements. Starting policy checks...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
