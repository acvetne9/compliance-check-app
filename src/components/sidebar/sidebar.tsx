"use client";

import { FolderClosed, ShieldCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "./search-bar";
import { useState } from "react";

interface SidebarProps {
  open: boolean;
  children?: React.ReactNode;
}

export function Sidebar({ open, children }: SidebarProps) {
  const [search, setSearch] = useState("");

  return (
    <aside
      className={`sidebar-transition shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar ${
        open ? "w-64" : "w-0"
      }`}
    >
      <div className="flex h-full w-64 flex-col">
        <SearchBar value={search} onChange={setSearch} />

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1 px-2 pb-4">
            {/* Policies section header */}
            <div className="flex items-center gap-2 px-2 pt-3 pb-1.5">
              <FolderClosed className="size-3.5 text-primary/60" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Policies
              </span>
            </div>

            {/* Policy folder placeholders */}
            <div className="flex flex-col gap-0.5 px-1">
              {["AA", "CMC", "DD", "EE", "FF", "GA", "GG", "HH", "MA", "PA"].map(
                (folder) => (
                  <button
                    key={folder}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <FolderClosed className="size-3.5 text-muted-foreground/50" />
                    <span className="flex-1 truncate font-mono text-xs">
                      {folder}
                    </span>
                  </button>
                )
              )}
            </div>

            {/* Compliance section header */}
            <div className="flex items-center gap-2 px-2 pt-5 pb-1.5">
              <ShieldCheck className="size-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Compliance
              </span>
            </div>

            {/* Compliance doc placeholders */}
            <div className="flex flex-col gap-0.5 px-1">
              <p className="px-2.5 py-2 text-xs text-muted-foreground/50">
                No compliance docs uploaded yet
              </p>
            </div>
          </div>
        </ScrollArea>

        {children}
      </div>
    </aside>
  );
}
