"use client";

import { X, Play, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfPreviewProps {
  fileName: string;
  pdfUrl: string | null;
  docType: "policy" | "compliance";
  onClose: () => void;
  onRunCompliance?: () => void;
}

export function PdfPreview({
  fileName,
  pdfUrl,
  docType,
  onClose,
  onRunCompliance,
}: PdfPreviewProps) {
  const displayName = fileName.replace(/\.pdf$/i, "");

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {displayName}
          </span>
          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {docType === "policy" ? "Policy" : "Compliance"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRunCompliance && (
            <Button
              size="sm"
              onClick={onRunCompliance}
              className="gap-1.5 text-xs"
            >
              <Play className="size-3" />
              {docType === "compliance" ? "Run Compliance" : "View Results"}
            </Button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* PDF viewer */}
      <div className="flex-1 bg-surface-sunken">
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0`}
            className="h-full w-full border-0"
            title={`Preview: ${fileName}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <FileText className="size-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                PDF preview unavailable
              </p>
              <p className="text-xs text-muted-foreground/60">
                Connect a database and ingest policies to enable previews
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
