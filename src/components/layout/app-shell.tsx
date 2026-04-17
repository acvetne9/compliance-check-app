"use client";

import { useState, useCallback } from "react";
import { Header } from "./header";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ShieldCheck, FileSearch } from "lucide-react";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleNewRun = useCallback(() => {
    setSelectedPolicies([]);
  }, []);

  const handleSubmit = useCallback((file: File) => {
    // Will wire to /api/run in commit 13
    console.log("Starting compliance check:", file.name);
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onNewRun={handleNewRun}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar open={sidebarOpen} />

        {/* Main content area */}
        <main className="flex min-w-0 flex-1 flex-col justify-end">
          {/* Bottom bar */}
          <BottomBar
            selectedPolicyCount={selectedPolicies.length}
            onSubmit={handleSubmit}
          />
        </main>
      </div>

      {/* Welcome state — centered on full page */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-8">
        <div className="pointer-events-auto flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/8 ring-1 ring-primary/10">
            <ShieldCheck className="size-7 text-primary" strokeWidth={1.5} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Healthcare Compliance Checker
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Upload a compliance document below to check against your
              policies, or select a document from the sidebar to preview and
              review results.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
            <div className="flex items-center gap-1.5">
              <FileSearch className="size-3.5" />
              <span>373 policies indexed</span>
            </div>
            <div className="size-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              <span>2-tier AI analysis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
