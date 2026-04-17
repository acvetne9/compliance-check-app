"use client";

import { useState, useCallback } from "react";
import { Header } from "./header";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "@/components/sidebar/sidebar";

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
        <main className="min-w-0 flex-1" />
      </div>



      {/* Bottom bar — fixed, centered on full page */}
      <div className="fixed bottom-0 left-0 right-0 z-10">
        <BottomBar
          selectedPolicyCount={selectedPolicies.length}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
