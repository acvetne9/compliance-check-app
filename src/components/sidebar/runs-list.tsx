"use client";

import { ClipboardCheck, Download } from "lucide-react";

interface RunData {
  id: string;
  status: string;
  docFileName: string;
  requirementsCount: number | null;
  metCount: number | null;
  notMetCount: number | null;
  unclearCount: number | null;
  completedAt: string | null;
}

interface RunsListProps {
  runs: RunData[];
  activeRunId: string | null;
  onClickRun: (runId: string, docFileName: string) => void;
}

export function RunsList({ runs, activeRunId, onClickRun }: RunsListProps) {
  const completedRuns = runs.filter((r) => r.status === "completed");

  if (completedRuns.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 px-2 pt-5 pb-1.5">
          <ClipboardCheck className="size-3.5 text-primary/60" />
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Past Runs
          </span>
        </div>
        <div className="px-1">
          <p className="px-2 py-2 text-xs text-muted-foreground/50">
            No completed runs yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-2 pt-5 pb-1.5">
        <ClipboardCheck className="size-3.5 text-primary/60" />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Past Runs
        </span>
      </div>

      <div className="flex flex-col gap-0.5 px-1">
        {completedRuns.map((run) => {
          const total =
            (run.metCount ?? 0) +
            (run.notMetCount ?? 0) +
            (run.unclearCount ?? 0);
          const date = run.completedAt
            ? new Date(run.completedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "";
          const isActive = run.id === activeRunId;

          return (
            <div
              key={run.id}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-sidebar-accent"
              }`}
            >
              <button
                onClick={() => onClickRun(run.id, run.docFileName)}
                className="min-w-0 flex-1 text-left"
              >
                <p className={`truncate text-[11px] ${isActive ? "text-primary" : "text-sidebar-foreground/70"}`}>
                  {run.docFileName.replace(/\.pdf$/i, "")}
                </p>
                <div className={`flex items-center gap-2 text-[10px] ${isActive ? "text-primary/60" : "text-muted-foreground/50"}`}>
                  <span>{date}</span>
                  {total > 0 && (
                    <span>
                      {run.metCount ?? 0}/{total} met
                    </span>
                  )}
                </div>
              </button>

              <a
                href={`/api/runs/${run.id}/export?format=csv`}
                download
                className="shrink-0 rounded p-1 text-muted-foreground/30 opacity-0 transition-all hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                title="Download CSV"
              >
                <Download className="size-3" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
