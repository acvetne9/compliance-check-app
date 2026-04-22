"use client";

import { FileText, X, ShieldCheck } from "lucide-react";

interface PolicyItemProps {
  id: string;
  fileName: string;
  selected?: boolean;
  highlighted?: boolean;
  /** 0-100 progress during a run, null when not running */
  progress?: number | null;
  onSelect?: (id: string) => void;
  onClick?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function PolicyItem({
  id,
  fileName,
  selected = false,
  highlighted = false,
  progress = null,
  onSelect,
  onClick,
  onRemove,
}: PolicyItemProps) {
  const displayName = fileName
    .replace(/\.pdf$/i, "")
    .replace(/_/g, " ")
    .slice(0, 24);

  const isLoading = progress !== null && progress < 100;

  return (
    <div className={`group rounded-md px-1.5 py-1 transition-colors ${
      highlighted ? "bg-primary/8 text-primary"
      : isLoading ? "bg-amber-50/50"
      : "hover:bg-sidebar-accent"
    }`}>
      <div className="flex items-center gap-1">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(id)}
            className="size-3 shrink-0 rounded border-border accent-primary"
          />
        )}

        <button
          onClick={() => onClick?.(id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <FileText className={`size-3 shrink-0 ${
            highlighted ? "text-primary/60" : isLoading ? "text-amber-500/60" : "text-muted-foreground/40"
          }`} />
          <span className={`truncate text-[11px] ${
            highlighted ? "text-primary" : isLoading ? "text-amber-700" : "text-sidebar-foreground/70"
          }`}>
            {displayName}
          </span>
        </button>

        {!isLoading && highlighted && <ShieldCheck className="size-3 shrink-0 text-primary/50" />}

        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(id); }}
            className="shrink-0 rounded p-0.5 text-muted-foreground/30 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <X className="size-2.5" />
          </button>
        )}
      </div>

      {/* Progress bar under the name */}
      {isLoading && (
        <div className="mt-0.5 ml-5 h-1 overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full bg-amber-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
