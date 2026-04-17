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
  met: { emoji: "\u2705", label: "Met", color: "text-green-700 bg-green-50" },
  not_met: { emoji: "\u274C", label: "Not Met", color: "text-red-700 bg-red-50" },
  unclear: { emoji: "\u26A0\uFE0F", label: "Unclear", color: "text-amber-700 bg-amber-50" },
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
    <div className="border-b border-border/20 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-secondary/30"
      >
        <span className="mt-0.5 shrink-0 text-sm">{config.emoji}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {externalId && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {externalId}
              </span>
            )}
            {category && (
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {category}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground">
            {text.length > 200 ? text.slice(0, 200) + "..." : text}
          </p>
        </div>

        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && results.length > 0 && (
        <div className="border-t border-border/20 bg-surface-sunken px-6 py-4">
          {results.map((r, i) => (
            <div key={i} className="mb-3 last:mb-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">
                  {r.policyFileName.replace(/\.pdf$/i, "")}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]?.color ?? ""
                  }`}
                >
                  {STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]?.label ?? r.status}
                </span>
                <span className="text-muted-foreground">
                  {r.confidence}% confidence
                </span>
              </div>
              {r.evidence && (
                <p className="mt-1.5 rounded bg-card p-2 text-xs leading-relaxed text-muted-foreground italic border border-border/30">
                  {r.evidence}
                </p>
              )}
              {r.reasoning && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.reasoning}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && results.length === 0 && (
        <div className="border-t border-border/20 bg-surface-sunken px-6 py-4">
          <p className="text-xs text-muted-foreground">
            No detailed results available.
          </p>
        </div>
      )}
    </div>
  );
}
