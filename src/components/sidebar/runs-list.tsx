"use client";

import { Download, X, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface RunData {
  id: string;
  status: string;
  docFileName: string;
  requirementsCount: number | null;
  metCount: number | null;
  notMetCount: number | null;
  unclearCount: number | null;
  completedAt: string | null;
  startedAt: string | null;
}

interface RunsListProps {
  runs: RunData[];
  activeRunId: string | null;
  onClickRun: (runId: string, docFileName: string) => void;
  onRemoveRun: (runId: string) => void;
  onResumeRun?: (runId: string) => void;
}

export function RunsList({ runs, activeRunId, onClickRun, onRemoveRun, onResumeRun }: RunsListProps) {
  if (runs.length === 0) {
    return (
      <div className="px-1">
        <p className="px-2 py-2 text-xs text-muted-foreground/50">
          No runs yet
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-0.5 px-1">
        {runs.map((run) => {
          const total =
            (run.metCount ?? 0) +
            (run.notMetCount ?? 0) +
            (run.unclearCount ?? 0);
          const date = (run.completedAt ?? run.startedAt)
            ? new Date(run.completedAt ?? run.startedAt!).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "";
          const isActive = run.id === activeRunId;
          const isIncomplete = run.status === "failed" || run.status === "checking";
          const isCompleted = run.status === "completed";

          return (
            <div
              key={run.id}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : isIncomplete
                    ? "bg-amber-50/50"
                    : "hover:bg-sidebar-accent"
              }`}
            >
              <button
                onClick={() => onClickRun(run.id, run.docFileName)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-1.5">
                  {isCompleted ? (
                    <CheckCircle2 className="size-3 shrink-0 text-green-500/60" />
                  ) : isIncomplete ? (
                    <AlertCircle className="size-3 shrink-0 text-amber-500/60" />
                  ) : (
                    <Loader2 className="size-3 shrink-0 animate-spin text-primary/40" />
                  )}
                  <p className={`truncate text-[11px] ${
                    isActive ? "text-primary"
                    : isIncomplete ? "text-amber-700"
                    : "text-sidebar-foreground/70"
                  }`}>
                    {run.docFileName.replace(/\.pdf$/i, "")}
                  </p>
                </div>
                <div className={`flex items-center gap-2 text-[10px] pl-4.5 ${
                  isActive ? "text-primary/60"
                  : isIncomplete ? "text-amber-600/50"
                  : "text-muted-foreground/50"
                }`}>
                  <span>{date}</span>
                  {isCompleted && total > 0 && (
                    <span>{run.metCount ?? 0}/{total} met</span>
                  )}
                  {isIncomplete && (
                    <span>incomplete</span>
                  )}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {isIncomplete && onResumeRun && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onResumeRun(run.id);
                    }}
                    className="rounded p-1 text-amber-500/50 hover:bg-amber-100 hover:text-amber-600"
                    title="Resume run"
                  >
                    <RotateCcw className="size-2.5" />
                  </button>
                )}
                {isCompleted && (
                  <a
                    href={`/api/runs/${run.id}/export?format=csv`}
                    download
                    className="rounded p-1 text-muted-foreground/30 hover:bg-secondary hover:text-foreground"
                    title="Download CSV"
                  >
                    <Download className="size-2.5" />
                  </a>
                )}
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
