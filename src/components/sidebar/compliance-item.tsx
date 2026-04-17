"use client";

import { ShieldCheck } from "lucide-react";

interface ComplianceItemProps {
  id: string;
  fileName: string;
  active?: boolean;
  hasResults?: boolean;
  metCount?: number;
  notMetCount?: number;
  unclearCount?: number;
  onClick?: (id: string) => void;
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
}: ComplianceItemProps) {
  const displayName = fileName.replace(/\.pdf$/i, "");

  return (
    <button
      onClick={() => onClick?.(id)}
      className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "hover:bg-sidebar-accent"
      }`}
    >
      <ShieldCheck className="size-3.5 shrink-0 text-primary/50" />
      <span className="flex-1 truncate text-[11px] text-sidebar-foreground/70">
        {displayName}
      </span>
      {hasResults && (
        <div className="flex items-center gap-1 text-[10px]">
          {notMetCount > 0 && <span>❌{notMetCount}</span>}
          {unclearCount > 0 && <span>⚠️{unclearCount}</span>}
          {notMetCount === 0 && unclearCount === 0 && <span>✅</span>}
        </div>
      )}
    </button>
  );
}
