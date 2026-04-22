"use client";

import { FolderClosed, ShieldCheck, ClipboardCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchBar } from "./search-bar";
import { PolicyBrowser } from "./policy-browser";
import { ComplianceList } from "./compliance-list";
import { RunsList } from "./runs-list";
import { CollapsibleSection } from "./section-header";
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
  policyProgress: Map<string, number>;
  activeComplianceDocId: string | null;
  runningDocId: string | null;
  runProgress: number | null;
  runPolicyCount: number;
  onClickComplianceDoc: (id: string) => void;
  onRemoveComplianceDoc: (id: string) => void;
  onAddComplianceDoc: () => void;
  activeRunId: string | null;
  onClickRun: (runId: string, docFileName: string) => void;
  onRemoveRun: (runId: string) => void;
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
  policyProgress,
  activeComplianceDocId,
  runningDocId,
  runProgress,
  runPolicyCount,
  onClickComplianceDoc,
  onRemoveComplianceDoc,
  onAddComplianceDoc,
  activeRunId,
  onClickRun,
  onRemoveRun,
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
            <CollapsibleSection
              icon={<FolderClosed className="size-3.5 text-primary/60" />}
              label="Policies"
            >
              <PolicyBrowser
                folders={policyFolders}
                selectedIds={selectedPolicyIds}
                checkedPolicyIds={checkedPolicyIds}
                policyProgress={policyProgress}
                searchFilter={search}
                onSelectPolicy={onSelectPolicy}
                onSelectFolder={onSelectFolder}
                onClickPolicy={onClickPolicy}
                onRemovePolicy={onRemovePolicy}
                onAddPolicyToFolder={onAddPolicyToFolder}
                onAddFolder={onAddFolder}
              />
            </CollapsibleSection>

            <CollapsibleSection
              icon={<ShieldCheck className="size-3.5 text-primary" />}
              label="Compliance"
            >
              <ComplianceList
                docs={complianceDocs}
                activeDocId={activeComplianceDocId}
                searchFilter={search}
                runningDocId={runningDocId}
                runProgress={runProgress}
                runPolicyCount={runPolicyCount}
                onClickDoc={onClickComplianceDoc}
                onRemoveDoc={onRemoveComplianceDoc}
                onAddDoc={onAddComplianceDoc}
              />
            </CollapsibleSection>

            <CollapsibleSection
              icon={<ClipboardCheck className="size-3.5 text-primary/60" />}
              label="Past Runs"
            >
              <RunsList
                runs={pastRuns}
                activeRunId={activeRunId}
                onClickRun={onClickRun}
                onRemoveRun={onRemoveRun}
              />
            </CollapsibleSection>
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
