"use client";

import { ShieldCheck, X } from "lucide-react";

interface ComplianceItemProps {
  id: string;
  fileName: string;
  active?: boolean;
  hasResults?: boolean;
  metCount?: number;
  notMetCount?: number;
  unclearCount?: number;
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
  onClick,
  onRemove,
}: ComplianceItemProps) {
  const displayName = fileName.replace(/\.pdf$/i, "");

  return (
    <div
      className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors ${
        active ? "bg-primary/10 text-primary" : "hover:bg-sidebar-accent"
      }`}
    >
      <button
        onClick={() => onClick?.(id)}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <ShieldCheck className="size-3.5 shrink-0 text-primary/50" />
        <span className="flex-1 truncate text-[11px] text-sidebar-foreground/70">
          {displayName}
        </span>
        {hasResults && (
          <div className="flex items-center gap-1 text-[10px]">
            {notMetCount > 0 && <span>{"\u274C"}{notMetCount}</span>}
            {unclearCount > 0 && <span>{"\u26A0\uFE0F"}{unclearCount}</span>}
            {notMetCount === 0 && unclearCount === 0 && <span>{"\u2705"}</span>}
          </div>
        )}
      </button>

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
