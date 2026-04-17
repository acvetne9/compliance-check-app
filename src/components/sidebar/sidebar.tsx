"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "./search-bar";
import { PolicyBrowser } from "./policy-browser";
import { ComplianceList } from "./compliance-list";
import { RunsList } from "./runs-list";
import { useState } from "react";

interface PolicyDoc {
  id: string;
  fileName: string;
  status?: "met" | "not_met" | "unclear" | null;
}

interface PolicyFolderData {
  folderId: string;
  docCount: number;
  docs: PolicyDoc[];
}

interface ComplianceDoc {
  id: string;
  fileName: string;
  hasResults?: boolean;
  metCount?: number;
  notMetCount?: number;
  unclearCount?: number;
}

interface RunData {
  id: string;
  status: string;
  docFileName: string;
  requirementsCount: number | null;
  metCount: number | null;
  notMetCount: number | null;
  unclearCount: number | null;
  completedAt: string | null;
}

interface SidebarProps {
  open: boolean;
  policyFolders: PolicyFolderData[];
  complianceDocs: ComplianceDoc[];
  pastRuns: RunData[];
  selectedPolicyIds: Set<string>;
  onSelectPolicy: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onClickPolicy: (id: string) => void;
  onRemovePolicy: (id: string) => void;
  onAddPolicyToFolder: (folderId: string) => void;
  onAddFolder: () => void;
  checkedPolicyIds: Set<string>;
  activeComplianceDocId: string | null;
  onClickComplianceDoc: (id: string) => void;
  onRemoveComplianceDoc: (id: string) => void;
  onAddComplianceDoc: () => void;
  activeRunId: string | null;
  onClickRun: (runId: string, docFileName: string) => void;
}

export function Sidebar({
  open,
  policyFolders,
  complianceDocs,
  pastRuns,
  selectedPolicyIds,
  onSelectPolicy,
  onSelectFolder,
  onClickPolicy,
  onRemovePolicy,
  onAddPolicyToFolder,
  onAddFolder,
  checkedPolicyIds,
  activeComplianceDocId,
  onClickComplianceDoc,
  onRemoveComplianceDoc,
  onAddComplianceDoc,
  activeRunId,
  onClickRun,
}: SidebarProps) {
  const [search, setSearch] = useState("");

  return (
    <aside
      className={`sidebar-transition shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar ${
        open ? "w-52" : "w-0"
      }`}
    >
      <div className="flex h-full w-52 flex-col">
        <SearchBar value={search} onChange={setSearch} />

        <ScrollArea className="flex-1 overflow-y-auto [&_[data-slot=scroll-area-scrollbar]]:data-[state=hidden]:opacity-0">
          <div className="flex flex-col pb-4">
            <PolicyBrowser
              folders={policyFolders}
              selectedIds={selectedPolicyIds}
              searchFilter={search}
              onSelectPolicy={onSelectPolicy}
              onSelectFolder={onSelectFolder}
              onClickPolicy={onClickPolicy}
              checkedPolicyIds={checkedPolicyIds}
              onRemovePolicy={onRemovePolicy}
              onAddPolicyToFolder={onAddPolicyToFolder}
              onAddFolder={onAddFolder}
            />

            <ComplianceList
              docs={complianceDocs}
              activeDocId={activeComplianceDocId}
              searchFilter={search}
              onClickDoc={onClickComplianceDoc}
              onRemoveDoc={onRemoveComplianceDoc}
              onAddDoc={onAddComplianceDoc}
            />

            <RunsList runs={pastRuns} activeRunId={activeRunId} onClickRun={onClickRun} />
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
