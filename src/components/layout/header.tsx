"use client";

import { ShieldCheck, PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewRun: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar, onNewRun }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background px-3">
      <div className="flex items-center gap-2">
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

        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            AndreasGPT
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onNewRun}
        className="gap-1.5 text-xs"
      >
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">New Run</span>
      </Button>
    </header>
  );
}
