"use client";

import { RequirementRow } from "./requirement-row";

interface RequirementData {
  id: string;
  externalId: string | null;
  section: string | null;
  text: string;
  category: string | null;
  aggregatedStatus: string | null;
  results: Array<{
    policyFileName: string;
    status: string;
    evidence: string;
    reasoning: string;
    confidence: number;
  }>;
}

interface ComplianceResultsProps {
  documentTitle: string;
  requirements: RequirementData[];
  metCount: number;
  notMetCount: number;
  unclearCount: number;
  viewMode: "full" | "gaps";
}

export function ComplianceResults({
  documentTitle,
  requirements,
  metCount,
  notMetCount,
  unclearCount,
  viewMode,
}: ComplianceResultsProps) {
  const total = metCount + notMetCount + unclearCount;
  const metPct = total > 0 ? Math.round((metCount / total) * 100) : 0;
  const notMetPct = total > 0 ? Math.round((notMetCount / total) * 100) : 0;
  const unclearPct = total > 0 ? Math.round((unclearCount / total) * 100) : 0;

  const filtered = (
    viewMode === "gaps"
      ? requirements.filter(
          (r) =>
            r.aggregatedStatus === "not_met" ||
            r.aggregatedStatus === "unclear"
        )
      : [...requirements]
  ).sort((a, b) => {
    const numA = parseInt(a.externalId?.replace(/\D/g, "") ?? "0", 10);
    const numB = parseInt(b.externalId?.replace(/\D/g, "") ?? "0", 10);
    return numA - numB;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Summary header */}
      <div className="shrink-0 border-b border-border/40 bg-card px-8 py-6">
        <h3 className="text-base font-semibold text-foreground mb-1">
          {documentTitle}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {total} requirements analyzed
          {viewMode === "gaps" ? " \u2022 showing gaps only" : ""}
        </p>

        {/* Score cards */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded-lg bg-green-50 px-4 py-3 ring-1 ring-green-200/50">
            <div className="text-2xl font-semibold text-green-700">{metCount}</div>
            <div className="text-[11px] text-green-600/80">Met ({metPct}%)</div>
          </div>
          <div className="flex-1 rounded-lg bg-red-50 px-4 py-3 ring-1 ring-red-200/50">
            <div className="text-2xl font-semibold text-red-700">{notMetCount}</div>
            <div className="text-[11px] text-red-600/80">Not Met ({notMetPct}%)</div>
          </div>
          <div className="flex-1 rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-200/50">
            <div className="text-2xl font-semibold text-amber-700">{unclearCount}</div>
            <div className="text-[11px] text-amber-600/80">Unclear ({unclearPct}%)</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
          {metCount > 0 && (
            <div className="bg-green-500 transition-all" style={{ width: `${metPct}%` }} />
          )}
          {unclearCount > 0 && (
            <div className="bg-amber-400 transition-all" style={{ width: `${unclearPct}%` }} />
          )}
          {notMetCount > 0 && (
            <div className="bg-red-500 transition-all" style={{ width: `${notMetPct}%` }} />
          )}
        </div>
      </div>

      {/* Requirements list */}
      <div className="flex-1 overflow-y-auto py-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              {viewMode === "gaps"
                ? "All requirements are met!"
                : "No requirements found."}
            </p>
          </div>
        ) : (
          filtered.map((req) => (
            <RequirementRow
              key={req.id}
              externalId={req.externalId}
              section={req.section}
              text={req.text}
              status={(req.aggregatedStatus as "met" | "not_met" | "unclear") ?? "unclear"}
              category={req.category}
              results={req.results}
            />
          ))
        )}
      </div>
    </div>
  );
}
