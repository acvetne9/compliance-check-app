"use client";

import { useState, useCallback } from "react";
import { Header } from "./header";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "@/components/sidebar/sidebar";

// Placeholder data until hooks are wired in commit 13
const PLACEHOLDER_FOLDERS = [
  { folderId: "AA", docCount: 19, docs: Array.from({ length: 3 }, (_, i) => ({ id: `aa-${i}`, fileName: `AA.${1000 + i}_CEO20240523.pdf`, status: null as null })) },
  { folderId: "CMC", docCount: 4, docs: Array.from({ length: 4 }, (_, i) => ({ id: `cmc-${i}`, fileName: `CMC.${3001 + i}_CEO20240523.pdf`, status: null as null })) },
  { folderId: "DD", docCount: 11, docs: [] },
  { folderId: "EE", docCount: 12, docs: [] },
  { folderId: "FF", docCount: 24, docs: [] },
  { folderId: "GA", docCount: 5, docs: [] },
  { folderId: "GG", docCount: 144, docs: [] },
  { folderId: "HH", docCount: 47, docs: [] },
  { folderId: "MA", docCount: 69, docs: [] },
  { folderId: "PA", docCount: 38, docs: [] },
];

const PLACEHOLDER_COMPLIANCE: Array<{
  id: string;
  fileName: string;
  hasResults?: boolean;
  metCount?: number;
  notMetCount?: number;
  unclearCount?: number;
}> = [
  { id: "easy", fileName: "Example Input Doc - Easy.pdf" },
  { id: "hard", fileName: "Example Input Doc - Hard.pdf" },
];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleNewRun = useCallback(() => {
    setSelectedPolicies(new Set());
  }, []);

  const handleSubmit = useCallback((file: File) => {
    console.log("Starting compliance check:", file.name);
  }, []);

  const handleSelectPolicy = useCallback((id: string) => {
    setSelectedPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClickPolicy = useCallback((id: string) => {
    console.log("Preview policy:", id);
  }, []);

  const handleRemovePolicy = useCallback((id: string) => {
    console.log("Remove policy:", id);
  }, []);

  const handleAddPolicy = useCallback(() => {
    console.log("Add policy");
  }, []);

  const handleClickComplianceDoc = useCallback((id: string) => {
    console.log("Preview compliance doc:", id);
  }, []);

  const handleAddComplianceDoc = useCallback(() => {
    console.log("Add compliance doc");
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onNewRun={handleNewRun}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          policyFolders={PLACEHOLDER_FOLDERS}
          complianceDocs={PLACEHOLDER_COMPLIANCE}
          selectedPolicyIds={selectedPolicies}
          onSelectPolicy={handleSelectPolicy}
          onClickPolicy={handleClickPolicy}
          onRemovePolicy={handleRemovePolicy}
          onAddPolicy={handleAddPolicy}
          onClickComplianceDoc={handleClickComplianceDoc}
          onAddComplianceDoc={handleAddComplianceDoc}
        />
        <main className="min-w-0 flex-1" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10">
        <BottomBar
          selectedPolicyCount={selectedPolicies.size}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
