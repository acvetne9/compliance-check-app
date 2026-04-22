"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, ArrowUp, X, FileText, Play, Loader2, Square } from "lucide-react";

interface BottomBarProps {
  selectedPolicyCount: number;
  hasComplianceDoc: boolean;
  isRunning: boolean;
  onSubmit: (file: File) => void | Promise<void>;
  onRunActive?: () => void;
  onStopRun?: () => void;
}

export function BottomBar({
  selectedPolicyCount,
  hasComplianceDoc,
  isRunning,
  onSubmit,
  onRunActive,
  onStopRun,
}: BottomBarProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = isRunning || isUploading;

  const handleFile = useCallback((f: File) => {
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      setFile(f);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
    },
    [handleFile]
  );

  const handleSubmitFile = useCallback(async () => {
    if (file) {
      setIsUploading(true);
      try {
        await onSubmit(file);
      } finally {
        setIsUploading(false);
      }
      setFile(null);
    }
  }, [file, onSubmit]);

  const helperText = busy
    ? isUploading ? "Uploading and extracting requirements..." : "Compliance check in progress..."
    : !hasComplianceDoc && !file
      ? "Select a compliance doc from the sidebar, or upload one here. Then select policies to run compliance against."
      : selectedPolicyCount > 0
        ? `Running against ${selectedPolicyCount} selected ${selectedPolicyCount === 1 ? "policy" : "policies"}`
        : "Select policies from the sidebar to check against, or run against all policies.";

  return (
    <div className="bg-background px-4 pb-5 pt-3">
      <div className="mx-auto max-w-2xl">
        <div
          className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-all ${
            isDragging
              ? "border-primary/40 bg-primary/5 shadow-md"
              : file
                ? "border-border bg-card"
                : "border-border/80 bg-card hover:border-border"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleInputChange}
            className="hidden"
            disabled={busy}
          />

          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            aria-label="Attach compliance PDF"
          >
            <Paperclip className="size-4" />
          </button>

          <div className="flex min-w-0 flex-1 items-center">
            {file ? (
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5">
                <FileText className="size-3.5 shrink-0 text-primary" />
                <span className="truncate text-sm text-foreground">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)}KB
                </span>
                {!busy && (
                  <button
                    onClick={() => setFile(null)}
                    className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                {busy ? (
                  "Processing..."
                ) : (
                  <>
                    Drop compliance PDF here or click{" "}
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="text-primary/80 underline underline-offset-2 transition-colors hover:text-primary"
                    >
                      browse
                    </button>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Stop button when running */}
          {busy && onStopRun && (
            <button
              onClick={onStopRun}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive shadow-sm transition-all hover:bg-destructive/20"
              aria-label="Stop compliance check"
            >
              <Square className="size-3 fill-current" />
              Stop
            </button>
          )}

          {/* Upload + run new file */}
          {!busy && file && (
            <button
              onClick={handleSubmitFile}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              aria-label="Upload and run compliance"
            >
              <ArrowUp className="size-4" />
            </button>
          )}

          {/* Run against already-selected compliance doc */}
          {!busy && !file && hasComplianceDoc && onRunActive && (
            <button
              onClick={onRunActive}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              aria-label="Run compliance check"
            >
              <Play className="size-3" />
              Run
            </button>
          )}
        </div>

        <p className="mt-2 px-1 text-center text-sm text-muted-foreground/70">
          {helperText}
        </p>
      </div>
    </div>
  );
}
