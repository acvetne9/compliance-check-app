"use client";

import { useState } from "react";
import { ChevronRight, FolderClosed, FolderOpen } from "lucide-react";

interface PolicyFolderProps {
  folderId: string;
  docCount: number;
  selected: "all" | "some" | "none";
  highlighted?: boolean;
  /** 0-100 aggregate progress, null when not running */
  progress?: number | null;
  onSelectFolder: (folderId: string) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function PolicyFolder({
  folderId,
  docCount,
  selected,
  highlighted = false,
  progress = null,
  onSelectFolder,
  children,
  defaultOpen = false,
}: PolicyFolderProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isLoading = progress !== null && progress < 100;

  return (
    <div>
      <div className={`rounded-lg px-1.5 py-1 transition-colors ${
        highlighted ? "bg-primary/8" : isLoading ? "bg-amber-50/50" : "hover:bg-sidebar-accent"
      }`}>
        <div className="flex w-full items-center gap-1">
          <input
            type="checkbox"
            checked={selected === "all"}
            ref={(el) => { if (el) el.indeterminate = selected === "some"; }}
            onChange={() => onSelectFolder(folderId)}
            className="size-3 shrink-0 rounded border-border accent-primary"
          />
          <button
            onClick={() => setOpen(!open)}
            className="flex flex-1 items-center gap-1.5 text-left"
          >
            <ChevronRight
              className={`size-3 text-muted-foreground/50 transition-transform ${open ? "rotate-90" : ""}`}
            />
            {open ? (
              <FolderOpen className={`size-3.5 ${highlighted ? "text-primary/60" : isLoading ? "text-amber-500/60" : "text-primary/60"}`} />
            ) : (
              <FolderClosed className={`size-3.5 ${highlighted ? "text-primary/60" : isLoading ? "text-amber-500/60" : "text-muted-foreground/50"}`} />
            )}
            <span className={`flex-1 truncate font-mono text-xs ${
              highlighted ? "text-primary" : isLoading ? "text-amber-700" : "text-sidebar-foreground/80"
            }`}>
              {folderId}
            </span>
            <span className={`text-[10px] tabular-nums ${
              highlighted ? "text-primary/60" : isLoading ? "text-amber-500" : "text-muted-foreground/50"
            }`}>
              {docCount}
            </span>
          </button>
        </div>

        {isLoading && (
          <div className="mt-0.5 ml-5 h-1 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full bg-amber-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {open && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-2 pt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
