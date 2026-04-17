"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "./header";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { PdfPreview } from "@/components/main/pdf-preview";
import { ProgressOverlay } from "@/components/main/progress-overlay";
import { ComplianceResults } from "@/components/results/compliance-results";
import { useComplianceRun } from "@/hooks/use-compliance-run";

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

interface ResultsState {
  documentTitle: string;
  requirements: any[];
  metCount: number;
  notMetCount: number;
  unclearCount: number;
  viewMode: "full" | "gaps";
}

type MainView = "empty" | "preview" | "running" | "results";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
  const [activeComplianceDocId, setActiveComplianceDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [resultsData, setResultsData] = useState<ResultsState | null>(null);
  const [policyFolders, setPolicyFolders] = useState<PolicyFolderData[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocData[]>([]);
  const [pastRuns, setPastRuns] = useState<any[]>([]);
  const [checkedPolicyIds, setCheckedPolicyIds] = useState<Set<string>>(new Set());

  const { status: runStatus, events, startRun, reset: resetRun } = useComplianceRun();

  // Determine what the main area shows
  const mainView: MainView =
    runStatus === "running" || runStatus === "starting"
      ? "running"
      : resultsData
        ? "results"
        : preview
          ? "preview"
          : "empty";

  // Fetch data from API
  const refreshData = useCallback(() => {
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

    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => {
        if (data.runs) setPastRuns(data.runs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // When a run completes, fetch results and refresh sidebar data
  useEffect(() => {
    if (runStatus === "completed" && activeComplianceDocId) {
      fetch(`/api/compliance/${activeComplianceDocId}?view=full`)
        .then((r) => r.json())
        .then((data) => {
          if (data.run && data.requirements) {
            setResultsData({
              documentTitle: data.doc?.fileName?.replace(/\.pdf$/i, "") ?? "Results",
              requirements: data.requirements,
              metCount: data.run.metCount ?? 0,
              notMetCount: data.run.notMetCount ?? 0,
              unclearCount: data.run.unclearCount ?? 0,
              viewMode: "full",
            });
            // Track which policies have compliance results
            const pIds = new Set<string>();
            for (const req of data.requirements) {
              for (const r of req.results ?? []) {
                if (r.policyId) pIds.add(r.policyId);
              }
            }
            setCheckedPolicyIds(pIds);
          }
        })
        .catch(() => {});
      refreshData();
    }
  }, [runStatus, activeComplianceDocId, refreshData]);

  // When selecting a compliance doc, load which policies were checked
  useEffect(() => {
    if (!activeComplianceDocId) {
      setCheckedPolicyIds(new Set());
      return;
    }
    fetch(`/api/compliance/${activeComplianceDocId}?view=full`)
      .then((r) => r.json())
      .then((data) => {
        if (data.requirements) {
          const pIds = new Set<string>();
          for (const req of data.requirements) {
            for (const r of req.results ?? []) {
              if (r.policyId) pIds.add(r.policyId);
            }
          }
          setCheckedPolicyIds(pIds);
        }
      })
      .catch(() => setCheckedPolicyIds(new Set()));
  }, [activeComplianceDocId]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleNewRun = useCallback(() => {
    setSelectedPolicies(new Set());
    setActiveComplianceDocId(null);
    setPreview(null);
    setResultsData(null);
    resetRun();
  }, [resetRun]);

  // Upload compliance doc via bottom bar, then start run
  const handleSubmit = useCallback(
    async (file: File) => {
      if (!activeComplianceDocId) return;

      const policyIds = selectedPolicies.size > 0
        ? Array.from(selectedPolicies)
        : undefined;

      setPreview(null);
      setResultsData(null);
      await startRun(activeComplianceDocId, policyIds);
    },
    [activeComplianceDocId, selectedPolicies, startRun]
  );

  // Upload a new compliance doc from the bottom bar
  const handleUploadAndRun = useCallback(
    async (file: File) => {
      // Upload the file first
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "compliance");

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { doc } = await res.json();

        // Set as active and refresh
        setActiveComplianceDocId(doc.id);
        refreshData();

        // Start compliance run
        const policyIds = selectedPolicies.size > 0
          ? Array.from(selectedPolicies)
          : undefined;

        setPreview(null);
        setResultsData(null);
        await startRun(doc.id, policyIds);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    },
    [selectedPolicies, startRun, refreshData]
  );

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
          for (const id of folderDocIds) next.delete(id);
        } else {
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

      setResultsData(null);
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
      setActiveComplianceDocId((prev) => (prev === id ? null : id));
      openPreview(id, "compliance");
    },
    [openPreview]
  );

  // View cached results for a policy
  const handleViewPolicyResults = useCallback(async (policyId: string) => {
    try {
      const res = await fetch(`/api/policies/${policyId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.complianceResults?.length > 0) {
        setPreview(null);
        setResultsData({
          documentTitle: data.policy?.fileName?.replace(/\.pdf$/i, "") ?? "Policy Results",
          requirements: data.complianceResults.map((r: any) => ({
            id: r.requirementId,
            externalId: r.requirementExternalId,
            section: r.requirementSection,
            text: r.requirementText,
            category: r.requirementCategory,
            aggregatedStatus: r.status,
            results: [{
              policyFileName: data.policy.fileName,
              status: r.status,
              evidence: r.evidence ?? "",
              reasoning: r.reasoning ?? "",
              confidence: r.confidence ?? 0,
            }],
          })),
          metCount: data.complianceResults.filter((r: any) => r.status === "met").length,
          notMetCount: data.complianceResults.filter((r: any) => r.status === "not_met").length,
          unclearCount: data.complianceResults.filter((r: any) => r.status === "unclear").length,
          viewMode: "full",
        });
      }
    } catch {}
  }, []);

  const handleViewRun = useCallback(async (runId: string, docFileName: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.run && data.requirements) {
        setPreview(null);
        setResultsData({
          documentTitle: docFileName.replace(/\.pdf$/i, ""),
          requirements: data.requirements,
          metCount: data.run.metCount ?? 0,
          notMetCount: data.run.notMetCount ?? 0,
          unclearCount: data.run.unclearCount ?? 0,
          viewMode: "full",
        });
      }
    } catch {}
  }, []);

  const handleViewPolicyCompliance = useCallback(
    async (policyId: string) => {
      // Open PDF preview
      let fileName = "";
      for (const folder of policyFolders) {
        const doc = folder.docs.find((d) => d.id === policyId);
        if (doc) { fileName = doc.fileName; break; }
      }

      let pdfUrl: string | null = null;
      try {
        const res = await fetch(`/api/preview/${policyId}`);
        if (res.ok) pdfUrl = (await res.json()).url;
      } catch {}

      setPreview({ id: policyId, fileName, docType: "policy", pdfUrl });

      // Load compliance results for this policy
      try {
        const res = await fetch(`/api/policies/${policyId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.complianceResults?.length > 0) {
          setResultsData({
            documentTitle: fileName.replace(/\.pdf$/i, ""),
            requirements: data.complianceResults.map((r: any) => ({
              id: r.requirementId,
              externalId: r.requirementExternalId,
              section: r.requirementSection,
              text: r.requirementText,
              category: r.requirementCategory,
              aggregatedStatus: r.status,
              results: [{
                policyFileName: fileName,
                policyId,
                status: r.status,
                evidence: r.evidence ?? "",
                reasoning: r.reasoning ?? "",
                confidence: r.confidence ?? 0,
              }],
            })),
            metCount: data.complianceResults.filter((r: any) => r.status === "met").length,
            notMetCount: data.complianceResults.filter((r: any) => r.status === "not_met").length,
            unclearCount: data.complianceResults.filter((r: any) => r.status === "unclear").length,
            viewMode: "full",
          });
        }
      } catch {}
    },
    [policyFolders]
  );

  const handleRemovePolicy = useCallback(
    async (id: string) => {
      await fetch(`/api/policies/${id}`, { method: "DELETE" });
      refreshData();
    },
    [refreshData]
  );

  const handleRemoveComplianceDoc = useCallback(
    async (id: string) => {
      await fetch(`/api/compliance/${id}`, { method: "DELETE" }).catch(() => {});
      if (activeComplianceDocId === id) {
        setActiveComplianceDocId(null);
        setPreview(null);
      }
      refreshData();
    },
    [activeComplianceDocId, refreshData]
  );

  const handleAddPolicyToFolder = useCallback((folderId: string) => {
    // TODO: open file picker, upload, ingest to folder
    console.log("Add policy to folder:", folderId);
  }, []);

  const handleAddFolder = useCallback(() => {
    // TODO: prompt for folder name, create folder
    console.log("Add folder");
  }, []);

  const handleAddComplianceDoc = useCallback(() => {
    // TODO: open file picker, upload compliance doc
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
          pastRuns={pastRuns}
          selectedPolicyIds={selectedPolicies}
          activeComplianceDocId={activeComplianceDocId}
          onSelectPolicy={handleSelectPolicy}
          onSelectFolder={handleSelectFolder}
          onClickPolicy={handleClickPolicy}
          onRemovePolicy={handleRemovePolicy}
          checkedPolicyIds={checkedPolicyIds}
          onAddPolicyToFolder={handleAddPolicyToFolder}
          onAddFolder={handleAddFolder}
          onClickComplianceDoc={handleClickComplianceDoc}
          onRemoveComplianceDoc={handleRemoveComplianceDoc}
          onAddComplianceDoc={handleAddComplianceDoc}
          onViewRun={handleViewRun}
        />

        <main className="min-w-0 flex-1 overflow-y-auto pb-24">
          {mainView === "running" && (
            <ProgressOverlay events={events} isRunning={runStatus === "running"} />
          )}

          {mainView === "results" && resultsData && (
            <ComplianceResults
              documentTitle={resultsData.documentTitle}
              requirements={resultsData.requirements}
              metCount={resultsData.metCount}
              notMetCount={resultsData.notMetCount}
              unclearCount={resultsData.unclearCount}
              viewMode={resultsData.viewMode}
            />
          )}

          {mainView === "preview" && preview && (
            <PdfPreview
              fileName={preview.fileName}
              pdfUrl={preview.pdfUrl}
              docType={preview.docType}
              onClose={() => setPreview(null)}
              onRunCompliance={
                preview.docType === "compliance"
                  ? () => {
                      setPreview(null);
                      if (activeComplianceDocId) {
                        const policyIds = selectedPolicies.size > 0
                          ? Array.from(selectedPolicies)
                          : undefined;
                        startRun(activeComplianceDocId, policyIds);
                      }
                    }
                  : preview.docType === "policy"
                    ? () => handleViewPolicyResults(preview.id)
                    : undefined
              }
            />
          )}
        </main>
      </div>

      <div
        className="fixed bottom-0 right-0 z-10 transition-all"
        style={{ left: sidebarOpen ? "208px" : "0px" }}
      >
        <BottomBar
          selectedPolicyCount={selectedPolicies.size}
          hasComplianceDoc={activeComplianceDocId !== null}
          isRunning={runStatus === "running" || runStatus === "starting"}
          onSubmit={handleUploadAndRun}
          onRunActive={
            activeComplianceDocId
              ? () => {
                  const policyIds = selectedPolicies.size > 0
                    ? Array.from(selectedPolicies)
                    : undefined;
                  setPreview(null);
                  setResultsData(null);
                  startRun(activeComplianceDocId, policyIds);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
