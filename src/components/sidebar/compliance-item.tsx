"use client";

import { ShieldCheck, X, Loader2 } from "lucide-react";

interface ComplianceItemProps {
  id: string;
  fileName: string;
  active?: boolean;
  hasResults?: boolean;
  metCount?: number;
  notMetCount?: number;
  unclearCount?: number;
  isRunning?: boolean;
  progress?: number | null;
  policyCount?: number;
  onClick?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function ComplianceItem({
  id,
  fileName,
  active = false,
  hasResults = false,
  metCount = 0,
  notMetCount = 0,
  unclearCount = 0,
  isRunning = false,
  progress = null,
  policyCount = 0,
  onClick,
  onRemove,
}: ComplianceItemProps) {
  const displayName = fileName.replace(/\.pdf$/i, "");

  return (
    <div
      className={`group flex w-full flex-col rounded-md px-2 py-1.5 transition-colors ${
        isRunning ? "bg-primary/10 text-primary"
        : active ? "bg-primary/10 text-primary"
        : "hover:bg-sidebar-accent"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onClick?.(id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {isRunning ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          ) : (
            <ShieldCheck className="size-3.5 shrink-0 text-primary/50" />
          )}
          <span className="flex-1 truncate text-[11px] text-sidebar-foreground/70">
            {displayName}
          </span>
        </button>

        {isRunning && policyCount > 0 && (
          <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
            {policyCount} {policyCount === 1 ? "policy" : "policies"}
          </span>
        )}

        {onRemove && !isRunning && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(id);
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground/30 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <X className="size-2.5" />
          </button>
        )}
      </div>

      {isRunning && progress !== null && (
        <div className="mt-1 ml-5 h-1 overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full bg-primary/60 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
