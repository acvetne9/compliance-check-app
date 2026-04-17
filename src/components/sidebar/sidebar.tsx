"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "./search-bar";
import { PolicyBrowser } from "./policy-browser";
import { ComplianceList } from "./compliance-list";
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

interface SidebarProps {
  open: boolean;
  policyFolders: PolicyFolderData[];
  complianceDocs: ComplianceDoc[];
  selectedPolicyIds: Set<string>;
  onSelectPolicy: (id: string) => void;
  onSelectFolder: (folderId: string) => void;
  onClickPolicy: (id: string) => void;
  onRemovePolicy: (id: string) => void;
  onAddPolicy: () => void;
  activeComplianceDocId: string | null;
  onClickComplianceDoc: (id: string) => void;
  onAddComplianceDoc: () => void;
}

export function Sidebar({
  open,
  policyFolders,
  complianceDocs,
  selectedPolicyIds,
  onSelectPolicy,
  onSelectFolder,
  onClickPolicy,
  onRemovePolicy,
  onAddPolicy,
  activeComplianceDocId,
  onClickComplianceDoc,
  onAddComplianceDoc,
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

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col pb-4">
            <PolicyBrowser
              folders={policyFolders}
              selectedIds={selectedPolicyIds}
              searchFilter={search}
              onSelectPolicy={onSelectPolicy}
              onSelectFolder={onSelectFolder}
              onClickPolicy={onClickPolicy}
              onRemovePolicy={onRemovePolicy}
              onAddPolicy={onAddPolicy}
            />

            <ComplianceList
              docs={complianceDocs}
              activeDocId={activeComplianceDocId}
              searchFilter={search}
              onClickDoc={onClickComplianceDoc}
              onAddDoc={onAddComplianceDoc}
            />
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
