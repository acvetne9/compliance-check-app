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
  /** "full" shows all, "gaps" shows only not_met and unclear */
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

  const filtered =
    viewMode === "gaps"
      ? requirements.filter(
          (r) =>
            r.aggregatedStatus === "not_met" ||
            r.aggregatedStatus === "unclear"
        )
      : requirements;

  return (
    <div className="flex h-full flex-col">
      {/* Summary bar */}
      <div className="shrink-0 border-b border-border/60 bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            {documentTitle}
          </h3>
          <span className="text-xs text-muted-foreground">
            {viewMode === "gaps" ? "Showing gaps only" : "All requirements"}
          </span>
        </div>

        {/* Stats */}
        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Met</span>
              <span className="font-medium text-foreground">{metCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Not Met</span>
              <span className="font-medium text-foreground">{notMetCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Unclear</span>
              <span className="font-medium text-foreground">{unclearCount}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex-1">
            <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
              {metCount > 0 && (
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${metPct}%` }}
                />
              )}
              {unclearCount > 0 && (
                <div
                  className="bg-amber-500 transition-all"
                  style={{
                    width: `${total > 0 ? Math.round((unclearCount / total) * 100) : 0}%`,
                  }}
                />
              )}
              {notMetCount > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{
                    width: `${total > 0 ? Math.round((notMetCount / total) * 100) : 0}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Requirements list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12">
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
