"use client";

import { FileText, X, ShieldCheck } from "lucide-react";

interface PolicyItemProps {
  id: string;
  fileName: string;
  selected?: boolean;
  hasComplianceResults?: boolean;
  onSelect?: (id: string) => void;
  onClick?: (id: string) => void;
  onRemove?: (id: string) => void;
  onViewCompliance?: (id: string) => void;
}

export function PolicyItem({
  id,
  fileName,
  selected = false,
  hasComplianceResults = false,
  onSelect,
  onClick,
  onRemove,
  onViewCompliance,
}: PolicyItemProps) {
  const displayName = fileName
    .replace(/\.pdf$/i, "")
    .replace(/_/g, " ")
    .slice(0, 24);

  return (
    <div className="group flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-sidebar-accent">
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
        <FileText className="size-3 shrink-0 text-muted-foreground/40" />
        <span className="truncate text-[11px] text-sidebar-foreground/70">
          {displayName}
        </span>
      </button>

      {hasComplianceResults && onViewCompliance && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewCompliance(id);
          }}
          className="shrink-0 rounded p-0.5 text-primary/50 transition-colors hover:text-primary"
          title="View compliance results"
        >
          <ShieldCheck className="size-3" />
        </button>
      )}

      {onRemove && (
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
  );
}
