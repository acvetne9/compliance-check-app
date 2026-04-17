"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, ArrowUp, X, FileText } from "lucide-react";

interface BottomBarProps {
  selectedPolicyCount: number;
  hasComplianceDoc: boolean;
  onSubmit: (file: File) => void;
}

export function BottomBar({ selectedPolicyCount, hasComplianceDoc, onSubmit }: BottomBarProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = useCallback(() => {
    if (file) {
      onSubmit(file);
      setFile(null);
    }
  }, [file, onSubmit]);

  const canRun = hasComplianceDoc;

  const helperText = !hasComplianceDoc
    ? "Select a compliance doc from the sidebar, then run against all or selected policies."
    : selectedPolicyCount > 0
      ? `Running against ${selectedPolicyCount} selected ${selectedPolicyCount === 1 ? "policy" : "policies"}`
      : "Running against all policies";

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
          />

          <button
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                <button
                  onClick={() => setFile(null)}
                  className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                Drop compliance PDF here or click{" "}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-primary/80 underline underline-offset-2 transition-colors hover:text-primary"
                >
                  browse
                </button>
              </span>
            )}
          </div>

          {canRun && (
            <button
              onClick={handleSubmit}
              disabled={!file}
              className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-all ${
                file
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "bg-secondary text-muted-foreground"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              aria-label="Run compliance check"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>

        <p className="mt-2 px-1 text-center text-xs text-muted-foreground/70">
          {helperText}
        </p>
      </div>
    </div>
  );
}
