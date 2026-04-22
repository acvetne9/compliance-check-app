"use client";

import { PanelLeftClose, PanelLeft } from "lucide-react";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
  const titleOffset = sidebarOpen ? "calc(50% + 104px)" : "50%";

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border/60 bg-background px-3">
      <button
        onClick={onToggleSidebar}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="size-4" />
        ) : (
          <PanelLeft className="size-4" />
        )}
      </button>

      <span
        className="absolute -translate-x-1/2 text-lg font-semibold tracking-tight text-foreground transition-all"
        style={{ left: titleOffset }}
      >
        AndreasGPT
      </span>
    </header>
  );
}
