"use client";

import { useState } from "react";
import { ChevronRight, FolderClosed, FolderOpen } from "lucide-react";

interface PolicyFolderProps {
  folderId: string;
  docCount: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function PolicyFolder({
  folderId,
  docCount,
  children,
  defaultOpen = false,
}: PolicyFolderProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
      >
        <ChevronRight
          className={`size-3 text-muted-foreground/50 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {open ? (
          <FolderOpen className="size-3.5 text-primary/60" />
        ) : (
          <FolderClosed className="size-3.5 text-muted-foreground/50" />
        )}
        <span className="flex-1 truncate font-mono text-xs text-sidebar-foreground/80">
          {folderId}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground/50">
          {docCount}
        </span>
      </button>

      {open && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-2 pt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
