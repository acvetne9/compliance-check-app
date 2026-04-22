"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "./header";
import { BottomBar } from "./bottom-bar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { PdfPreview } from "@/components/main/pdf-preview";
import { ProgressOverlay } from "@/components/main/progress-overlay";
import { ComplianceResults } from "@/components/results/compliance-results";
import { RecommendationsPanel } from "@/components/main/recommendations-panel";
import { useComplianceRun } from "@/hooks/use-compliance-run";
import { useUserId } from "@/hooks/use-user-id";

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

type MainView = "empty" | "preview" | "running" | "results" | "preview+results";

export function AppShell() {
  const userId = useUserId();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
  const [activeComplianceDocId, setActiveComplianceDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [resultsData, setResultsData] = useState<ResultsState | null>(null);
  const [policyFolders, setPolicyFolders] = useState<PolicyFolderData[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocData[]>([]);
  const [pastRuns, setPastRuns] = useState<any[]>([]);
  const [checkedPolicyIds, setCheckedPolicyIds] = useState<Set<string>>(new Set());
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastOpenedPolicyId, setLastOpenedPolicyId] = useState<string | null>(null);
  const [runningDocId, setRunningDocId] = useState<string | null>(null);
  const [runPolicyCount, setRunPolicyCount] = useState(0);

  const { status: runStatus, events, startRun, reset: resetRun } = useComplianceRun();

  const isRunning = runStatus === "running" || runStatus === "starting";
  const hasRunEvents = events.length > 0;

  // Derive per-policy progress from SSE events
  const policyProgress = new Map<string, number>();
  const liveCheckedPolicyIds = new Set<string>();
  const totalReqCount = events.find((e) => e.type === "requirements_extracted");
  const totalReqs = totalReqCount?.type === "requirements_extracted" ? totalReqCount.count : 0;

  // Once run has started (even before requirements extracted), show 0% on all selected
  if (isRunning || (runStatus === "completed" && hasRunEvents)) {
    // All selected policies start at 0%
    for (const id of selectedPolicies) {
      policyProgress.set(id, 0);
    }

    // Update progress per policy from check_complete events
    if (totalReqs > 0) {
      const checksByPolicy = new Map<string, number>();
      for (const e of events) {
        if (e.type === "check_complete") {
          checksByPolicy.set(e.policyId, (checksByPolicy.get(e.policyId) ?? 0) + 1);
        }
      }
      for (const [pid, count] of checksByPolicy) {
        policyProgress.set(pid, Math.round((count / totalReqs) * 100));
      }
    }

    // Completed policies: remove bar, show shield
    for (const e of events) {
      if (e.type === "policy_done") {
        policyProgress.delete(e.policyId);
        liveCheckedPolicyIds.add(e.policyId);
      }
    }
  }

  const allCheckedPolicyIds = new Set([...checkedPolicyIds, ...liveCheckedPolicyIds]);

  // Overall run progress for sidebar compliance item
  const overallRunProgress = (() => {
    if (!runningDocId) return null;
    if (runStatus === "completed") return 100;
    if (!isRunning) return null;
    const policyStartEvts = events.filter(e => e.type === "policy_start");
    const policyDoneEvts = events.filter(e => e.type === "policy_done");
    const total = policyStartEvts.length > 0 && policyStartEvts[0].type === "policy_start"
      ? policyStartEvts[0].totalPolicies : 0;
    return total > 0 ? Math.round((policyDoneEvts.length / total) * 100) : 0;
  })();

  // Auto-open each policy as it starts being checked
  useEffect(() => {
    const policyStarts = events.filter((e) => e.type === "policy_start");
    const latest = policyStarts[policyStarts.length - 1];
    if (!latest || latest.type !== "policy_start") return;
    if (latest.policyId === lastOpenedPolicyId) return;

    setLastOpenedPolicyId(latest.policyId);
    let fileName = latest.policyFileName;
    const pid = latest.policyId;

    (async () => {
      let pdfUrl: string | null = null;
      try {
        const res = await fetch(`/api/preview/${pid}`);
        if (res.ok) pdfUrl = (await res.json()).url;
      } catch {}
      setPreview({ id: pid, fileName, docType: "policy", pdfUrl });
    })();
  }, [events, lastOpenedPolicyId]);

  // Is the currently previewed policy part of the active run?
  const previewIsInRun = preview && hasRunEvents && (
    policyProgress.has(preview.id) || liveCheckedPolicyIds.has(preview.id)
  );

  const isRunOrJustCompleted = isRunning || (runStatus === "completed" && hasRunEvents);

  // Determine what the main area shows
  const mainView: MainView =
    // During run: policy PDF + its checklist
    (previewIsInRun && preview)
      ? "preview+results"
    // During run: compliance doc PDF on top + run progress below
    : isRunOrJustCompleted && preview?.docType === "compliance" && preview.id === runningDocId
      ? "preview+results"
    // During run: no preview open, show run progress
    : isRunOrJustCompleted && !preview
      ? "running"
    // Not running: policy/compliance with results
    : preview && resultsData
      ? "preview+results"
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

  // When run completes, uncheck policies and refresh
  useEffect(() => {
    if (runStatus === "completed") {
      setSelectedPolicies(new Set());
      refreshData();
    }
  }, [runStatus, refreshData]);

  // When a run completes, refresh highlights and sidebar
  useEffect(() => {
    if (runStatus === "completed" && activeComplianceDocId) {
      fetch(`/api/compliance/${activeComplianceDocId}/policies`)
        .then((r) => r.json())
        .then((data) => {
          if (data.policyIds) setCheckedPolicyIds(new Set(data.policyIds));
        })
        .catch(() => {});
      refreshData();
    }
  }, [runStatus, activeComplianceDocId, refreshData]);

  // When selecting a compliance doc, load ALL policies ever checked against it (across all runs)
  useEffect(() => {
    if (!activeComplianceDocId) {
      setCheckedPolicyIds(new Set());
      return;
    }
    fetch(`/api/compliance/${activeComplianceDocId}/policies`)
      .then((r) => r.json())
      .then((data) => {
        if (data.policyIds) {
          setCheckedPolicyIds(new Set(data.policyIds));
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
    setActiveRunId(null);
    setCheckedPolicyIds(new Set());
    setLastOpenedPolicyId(null);
    setRunningDocId(null);
    setRunPolicyCount(0);
    setPreview(null);
    setResultsData(null);
    resetRun();
  }, [resetRun]);

  // Start a run — requires policies to be selected
  const startRunWithPreview = useCallback(
    async (docId: string) => {
      if (selectedPolicies.size === 0) return; // Must select policies first

      const doc = complianceDocs.find((d) => d.id === docId);
      if (!doc) return;

      setResultsData(null);
      setLastOpenedPolicyId(null);
      setRunningDocId(docId);
      setRunPolicyCount(selectedPolicies.size);
      setPreview(null);

      await startRun(docId, Array.from(selectedPolicies));
    },
    [complianceDocs, selectedPolicies, startRun]
  );

  // Upload a new compliance doc from the bottom bar
  const handleUploadAndRun = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "compliance");

      try {
        // Upload returns instantly — extraction happens in background
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { doc } = await res.json();

        // Add to sidebar, select, show PDF immediately
        setActiveComplianceDocId(doc.id);
        setComplianceDocs((prev) => [
          { id: doc.id, fileName: doc.fileName },
          ...prev,
        ]);
        setResultsData(null);
        setLastOpenedPolicyId(null);
        refreshData();

        if (selectedPolicies.size > 0) {
          // Policies selected — show compliance doc PDF + start run below it
          setRunningDocId(doc.id);
          setRunPolicyCount(selectedPolicies.size);
          setPreview({ id: doc.id, fileName: doc.fileName, docType: "compliance", pdfUrl: doc.blobUrl });
          await startRun(doc.id, Array.from(selectedPolicies));
        } else {
          // No policies — show PDF + recommendations
          setPreview({ id: doc.id, fileName: doc.fileName, docType: "compliance", pdfUrl: doc.blobUrl });
        }
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
    async (id: string) => {
      // Toggle off if already previewing
      if (preview?.id === id) {
        setPreview(null);
        setResultsData(null);
        return;
      }

      // Open preview
      await openPreview(id, "policy");

      // If this policy has compliance results, load them too
      if (checkedPolicyIds.has(id)) {
        try {
          const res = await fetch(`/api/policies/${id}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.complianceResults?.length > 0) {
            const fileName = data.policy?.fileName ?? "";
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
                  policyId: id,
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
      }
    },
    [openPreview, preview, checkedPolicyIds]
  );

  const handleClickComplianceDoc = useCallback(
    (id: string) => {
      const deselecting = activeComplianceDocId === id;
      setActiveComplianceDocId(deselecting ? null : id);
      setActiveRunId(null); // deselect any active run
      if (deselecting) {
        setPreview(null);
        setResultsData(null);
        setCheckedPolicyIds(new Set());
      } else {
        openPreview(id, "compliance");
      }
    },
    [openPreview, activeComplianceDocId]
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
    const deselecting = activeRunId === runId;
    setActiveRunId(deselecting ? null : runId);
    setActiveComplianceDocId(null); // deselect any active compliance doc

    if (deselecting) {
      setPreview(null);
      setResultsData(null);
      setCheckedPolicyIds(new Set());
      return;
    }

    // Just highlight the checked policies — no results breakdown
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.requirements) {
        setPreview(null);
        setResultsData(null);
        const pIds = new Set<string>();
        for (const req of data.requirements) {
          for (const r of req.results ?? []) {
            if (r.policyId) pIds.add(r.policyId);
          }
        }
        setCheckedPolicyIds(pIds);
      }
    } catch {}
  }, [activeRunId]);

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

  const handleRemoveRun = useCallback(
    async (runId: string) => {
      await fetch(`/api/runs/${runId}`, { method: "DELETE" }).catch(() => {});
      if (activeRunId === runId) {
        setActiveRunId(null);
        setResultsData(null);
        setCheckedPolicyIds(new Set());
      }
      refreshData();
    },
    [activeRunId, refreshData]
  );

  const handleAddPolicyToFolder = useCallback((folderId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "policy");
      formData.append("folderId", folderId);
      await fetch("/api/upload", { method: "POST", body: formData });
      refreshData();
    };
    input.click();
  }, [refreshData]);

  const handleAddFolder = useCallback(() => {
    const name = window.prompt("Enter folder name:");
    if (!name?.trim()) return;
    // Folders are created implicitly when a policy is added to them
    // For now just show it in the UI
    setPolicyFolders((prev) => [
      ...prev,
      { folderId: name.trim().toUpperCase(), docCount: 0, docs: [] },
    ]);
  }, []);

  const handleAddComplianceDoc = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "compliance");
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const { doc } = await res.json();
          // Add to sidebar and select
          setComplianceDocs((prev) => [{ id: doc.id, fileName: doc.fileName }, ...prev]);
          setActiveComplianceDocId(doc.id);
          setActiveRunId(null);
          // Open preview
          setPreview({ id: doc.id, fileName: doc.fileName, docType: "compliance", pdfUrl: doc.blobUrl });
        }
      } catch {}
      refreshData();
    };
    input.click();
  }, [refreshData]);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          policyFolders={policyFolders}
          complianceDocs={complianceDocs}
          pastRuns={pastRuns}
          selectedPolicyIds={selectedPolicies}
          activeComplianceDocId={activeComplianceDocId}
          runningDocId={runningDocId}
          runProgress={overallRunProgress}
          runPolicyCount={runPolicyCount}
          onSelectPolicy={handleSelectPolicy}
          onSelectFolder={handleSelectFolder}
          onClickPolicy={handleClickPolicy}
          onRemovePolicy={handleRemovePolicy}
          checkedPolicyIds={allCheckedPolicyIds}
          policyProgress={policyProgress}
          onAddPolicyToFolder={handleAddPolicyToFolder}
          onAddFolder={handleAddFolder}
          onClickComplianceDoc={handleClickComplianceDoc}
          onRemoveComplianceDoc={handleRemoveComplianceDoc}
          onAddComplianceDoc={handleAddComplianceDoc}
          activeRunId={activeRunId}
          onClickRun={handleViewRun}
          onRemoveRun={handleRemoveRun}
        />

        <main className="min-w-0 flex-1 overflow-y-auto pb-24">
          {mainView === "running" && (
            <ProgressOverlay events={events} isRunning={isRunning} filterPolicyId={null} />
          )}

          {mainView === "preview+results" && preview && (
            <div className="flex h-full">
              <div className="w-[60%] shrink-0">
                <PdfPreview
                  fileName={preview.fileName}
                  pdfUrl={preview.pdfUrl}
                  docType={preview.docType}
                  onClose={() => { setPreview(null); setResultsData(null); resetRun(); }}
                />
              </div>
              <div className="w-[40%] border-l border-border/40 overflow-y-auto">
                {hasRunEvents && (preview.docType === "policy" || preview.id === runningDocId) ? (
                  <ProgressOverlay events={events} isRunning={isRunning} filterPolicyId={preview.docType === "policy" ? preview.id : null} />
                ) : resultsData ? (
                  <ComplianceResults
                    documentTitle={resultsData.documentTitle}
                    requirements={resultsData.requirements}
                    metCount={resultsData.metCount}
                    notMetCount={resultsData.notMetCount}
                    unclearCount={resultsData.unclearCount}
                    viewMode={resultsData.viewMode}
                  />
                ) : null}
              </div>
            </div>
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
            preview.docType === "compliance" && activeComplianceDocId ? (
              <div className="flex h-full">
                <div className="w-[60%] shrink-0">
                  <PdfPreview
                    fileName={preview.fileName}
                    pdfUrl={preview.pdfUrl}
                    docType={preview.docType}
                    onClose={() => setPreview(null)}
                  />
                </div>
                <div className="w-[40%] border-l border-border/40 overflow-y-auto">
                  <RecommendationsPanel
                    complianceDocId={activeComplianceDocId}
                    checkedPolicyIds={allCheckedPolicyIds}
                    selectedPolicyIds={selectedPolicies}
                    onSelectPolicy={handleSelectPolicy}
                  />
                </div>
              </div>
            ) : (
              <PdfPreview
                fileName={preview.fileName}
                pdfUrl={preview.pdfUrl}
                docType={preview.docType}
                onClose={() => setPreview(null)}
                onRunCompliance={
                  preview.docType === "policy"
                    ? () => handleViewPolicyResults(preview.id)
                    : undefined
                }
              />
            )
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
            activeComplianceDocId && selectedPolicies.size > 0
              ? () => startRunWithPreview(activeComplianceDocId)
              : undefined
          }
          onStopRun={resetRun}
        />
      </div>
    </div>
  );
}
