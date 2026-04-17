"use client";

import { ShieldCheck, PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewRun: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar, onNewRun }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-surface-elevated/50 px-3">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            onClick={onToggleSidebar}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeft className="size-4" />
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-teal/10">
            <ShieldCheck className="size-4 text-teal" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            AndreasGPT
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Compliance
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onNewRun}
        className="gap-1.5 border-border/60 text-xs"
      >
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">New Run</span>
      </Button>
    </header>
  );
}
