"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface RequirementRowProps {
  externalId: string | null;
  section: string | null;
  text: string;
  status: "met" | "not_met" | "unclear";
  category: string | null;
  results: Array<{
    policyFileName: string;
    status: string;
    evidence: string;
    reasoning: string;
    confidence: number;
  }>;
}

const STATUS_CONFIG = {
  met: { emoji: "\u2705", label: "Met", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  not_met: { emoji: "\u274C", label: "Not Met", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  unclear: { emoji: "\u26A0\uFE0F", label: "Unclear", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export function RequirementRow({
  externalId,
  section,
  text,
  status,
  category,
  results,
}: RequirementRowProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[status];

  return (
    <div className={`border-l-2 ${config.border} mx-6 my-2 rounded-lg bg-card shadow-sm ring-1 ring-border/30`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 rounded-lg px-5 py-4 text-left transition-colors hover:bg-secondary/20"
      >
        <span className="mt-0.5 shrink-0 text-base">{config.emoji}</span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {externalId && (
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                {externalId}
              </span>
            )}
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${config.bg} ${config.text}`}>
              {config.label}
            </span>
            {category && (
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {category}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {text.length > 250 ? text.slice(0, 250) + "..." : text}
          </p>
        </div>

        <ChevronDown
          className={`mt-1.5 size-4 shrink-0 text-muted-foreground/50 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && results.length > 0 && (
        <div className="border-t border-border/20 px-5 py-4">
          {results.map((r, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 text-xs mb-2">
                <span className="font-medium text-foreground">
                  {r.policyFileName.replace(/\.pdf$/i, "")}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]?.bg ?? "bg-secondary"
                } ${STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]?.text ?? "text-muted-foreground"}`}>
                  {STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]?.label ?? r.status}
                </span>
                {r.confidence > 0 && (
                  <span className="text-muted-foreground/60">
                    {r.confidence}% confidence
                  </span>
                )}
              </div>
              {r.evidence && (
                <blockquote className="rounded-lg bg-surface-sunken p-3 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/20 italic">
                  {r.evidence}
                </blockquote>
              )}
              {r.reasoning && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                  {r.reasoning}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && results.length === 0 && (
        <div className="border-t border-border/20 px-5 py-4">
          <p className="text-xs text-muted-foreground/60">
            No policy matches found for this requirement.
          </p>
        </div>
      )}
    </div>
  );
}
