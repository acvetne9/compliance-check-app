"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, ArrowUp, X, FileText } from "lucide-react";

interface BottomBarProps {
  selectedPolicyCount: number;
  onSubmit: (file: File) => void;
}

export function BottomBar({ selectedPolicyCount, onSubmit }: BottomBarProps) {
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

  const helperText =
    selectedPolicyCount > 0
      ? `Running against ${selectedPolicyCount} selected ${selectedPolicyCount === 1 ? "policy" : "policies"}`
      : "Upload a compliance doc and run against all policies, or select specific docs from the sidebar first.";

  return (
    <div className="shrink-0 border-t border-border/50 bg-surface-elevated/30 px-4 pb-4 pt-3">
      <div
        className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
          isDragging
            ? "border-teal bg-teal/5 teal-glow"
            : file
              ? "border-border/60 bg-surface-elevated"
              : "border-border/40 bg-surface-elevated/80 hover:border-border/60"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* File input (hidden) */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Paperclip / browse button */}
        <button
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-teal"
          aria-label="Attach compliance PDF"
        >
          <Paperclip className="size-4" />
        </button>

        {/* File display or placeholder */}
        <div className="flex min-w-0 flex-1 items-center">
          {file ? (
            <div className="flex items-center gap-2 rounded-lg bg-teal/8 px-2.5 py-1.5">
              <FileText className="size-3.5 shrink-0 text-teal" />
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
                className="text-teal-dim underline underline-offset-2 transition-colors hover:text-teal"
              >
                browse
              </button>
            </span>
          )}
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!file}
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-all ${
            file
              ? "bg-teal text-white shadow-md shadow-teal/20 hover:bg-teal/90"
              : "bg-muted text-muted-foreground"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label="Run compliance check"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>

      {/* Helper text */}
      <p className="mt-2 px-1 text-center text-xs text-muted-foreground/70">
        {helperText}
      </p>
    </div>
  );
}
