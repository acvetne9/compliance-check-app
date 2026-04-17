"use client";

import { useState } from "react";
import { ChevronRight, FolderClosed, FolderOpen } from "lucide-react";

interface PolicyFolderProps {
  folderId: string;
  docCount: number;
  selected: "all" | "some" | "none";
  highlighted?: boolean;
  onSelectFolder: (folderId: string) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function PolicyFolder({
  folderId,
  docCount,
  selected,
  highlighted = false,
  onSelectFolder,
  children,
  defaultOpen = false,
}: PolicyFolderProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className={`flex w-full items-center gap-1 rounded-lg px-1.5 py-1 transition-colors ${
        highlighted ? "bg-primary/8" : "hover:bg-sidebar-accent"
      }`}>
        <input
          type="checkbox"
          checked={selected === "all"}
          ref={(el) => {
            if (el) el.indeterminate = selected === "some";
          }}
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
            <FolderOpen className="size-3.5 text-primary/60" />
          ) : (
            <FolderClosed className="size-3.5 text-muted-foreground/50" />
          )}
          <span className={`flex-1 truncate font-mono text-xs ${highlighted ? "text-primary" : "text-sidebar-foreground/80"}`}>
            {folderId}
          </span>
          <span className={`text-[10px] tabular-nums ${highlighted ? "text-primary/60" : "text-muted-foreground/50"}`}>
            {docCount}
          </span>
        </button>
      </div>

      {open && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-2 pt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
