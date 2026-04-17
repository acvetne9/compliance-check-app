"use client";

import { Download, X } from "lucide-react";

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
  onRemoveRun: (runId: string) => void;
}

export function RunsList({ runs, activeRunId, onClickRun, onRemoveRun }: RunsListProps) {
  const completedRuns = runs.filter((r) => r.status === "completed");

  if (completedRuns.length === 0) {
    return (
      <div className="px-1">
        <p className="px-2 py-2 text-xs text-muted-foreground/50">
          No completed runs yet
        </p>
      </div>
    );
  }

  return (
    <div>
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

              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <a
                  href={`/api/runs/${run.id}/export?format=csv`}
                  download
                  className="rounded p-1 text-muted-foreground/30 hover:bg-secondary hover:text-foreground"
                  title="Download CSV"
                >
                  <Download className="size-2.5" />
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRun(run.id);
                  }}
                  className="rounded p-0.5 text-muted-foreground/30 hover:bg-destructive/10 hover:text-destructive"
                  title="Delete run"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
