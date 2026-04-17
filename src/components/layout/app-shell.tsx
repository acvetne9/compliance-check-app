"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "./header";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { PdfPreview } from "@/components/main/pdf-preview";

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

interface ComplianceDocData {
  id: string;
  fileName: string;
  hasResults?: boolean;
  metCount?: number;
  notMetCount?: number;
  unclearCount?: number;
}

interface PreviewState {
  id: string;
  fileName: string;
  docType: "policy" | "compliance";
  pdfUrl: string | null;
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
  const [activeComplianceDocId, setActiveComplianceDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [policyFolders, setPolicyFolders] = useState<PolicyFolderData[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocData[]>([]);

  // Fetch policies and compliance docs from API
  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((data) => {
        if (data.folders) setPolicyFolders(data.folders);
      })
      .catch(() => {});

    fetch("/api/compliance")
      .then((r) => r.json())
      .then((data) => {
        if (data.docs) {
          setComplianceDocs(
            data.docs.map((d: any) => ({
              id: d.id,
              fileName: d.fileName,
              hasResults: !!d.latestRun?.completedAt,
              metCount: d.latestRun?.metCount ?? 0,
              notMetCount: d.latestRun?.notMetCount ?? 0,
              unclearCount: d.latestRun?.unclearCount ?? 0,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleNewRun = useCallback(() => {
    setSelectedPolicies(new Set());
    setActiveComplianceDocId(null);
    setPreview(null);
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

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      const folder = policyFolders.find((f) => f.folderId === folderId);
      if (!folder) return;
      const folderDocIds = folder.docs.map((d) => d.id);
      setSelectedPolicies((prev) => {
        const next = new Set(prev);
        const allSelected = folderDocIds.every((id) => next.has(id));
        if (allSelected) {
          // Deselect all in folder
          for (const id of folderDocIds) next.delete(id);
        } else {
          // Select all in folder
          for (const id of folderDocIds) next.add(id);
        }
        return next;
      });
    },
    [policyFolders]
  );

  const openPreview = useCallback(
    async (id: string, docType: "policy" | "compliance") => {
      let fileName = "";
      if (docType === "policy") {
        for (const folder of policyFolders) {
          const doc = folder.docs.find((d) => d.id === id);
          if (doc) { fileName = doc.fileName; break; }
        }
      } else {
        const doc = complianceDocs.find((d) => d.id === id);
        if (doc) fileName = doc.fileName;
      }

      let pdfUrl: string | null = null;
      try {
        const res = await fetch(`/api/preview/${id}`);
        if (res.ok) {
          const data = await res.json();
          pdfUrl = data.url;
        }
      } catch {}

      setPreview({ id, fileName, docType, pdfUrl });
    },
    [policyFolders, complianceDocs]
  );

  const handleClickPolicy = useCallback(
    (id: string) => openPreview(id, "policy"),
    [openPreview]
  );

  const handleClickComplianceDoc = useCallback(
    (id: string) => {
      // Toggle: click again to deselect
      setActiveComplianceDocId((prev) => (prev === id ? null : id));
      openPreview(id, "compliance");
    },
    [openPreview]
  );

  const handleRemovePolicy = useCallback((id: string) => {
    console.log("Remove policy:", id);
  }, []);

  const handleAddPolicy = useCallback(() => {
    console.log("Add policy");
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
          policyFolders={policyFolders}
          complianceDocs={complianceDocs}
          selectedPolicyIds={selectedPolicies}
          onSelectPolicy={handleSelectPolicy}
          onSelectFolder={handleSelectFolder}
          onClickPolicy={handleClickPolicy}
          onRemovePolicy={handleRemovePolicy}
          onAddPolicy={handleAddPolicy}
          activeComplianceDocId={activeComplianceDocId}
          onClickComplianceDoc={handleClickComplianceDoc}
          onAddComplianceDoc={handleAddComplianceDoc}
        />

        <main className="min-w-0 flex-1 pb-24">
          {preview ? (
            <PdfPreview
              fileName={preview.fileName}
              pdfUrl={preview.pdfUrl}
              docType={preview.docType}
              onClose={() => setPreview(null)}
              onRunCompliance={() => {
                console.log("Run compliance on:", preview.id);
              }}
            />
          ) : null}
        </main>
      </div>

      <div
        className="fixed bottom-0 right-0 z-10 transition-all"
        style={{ left: sidebarOpen ? "208px" : "0px" }}
      >
        <BottomBar
          selectedPolicyCount={selectedPolicies.size}
          hasComplianceDoc={activeComplianceDocId !== null}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
