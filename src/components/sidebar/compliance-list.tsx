"use client";

import { ShieldCheck, Plus } from "lucide-react";
import { ComplianceItem } from "./compliance-item";

interface ComplianceDoc {
  id: string;
  fileName: string;
  hasResults?: boolean;
  metCount?: number;
  notMetCount?: number;
  unclearCount?: number;
}

interface ComplianceListProps {
  docs: ComplianceDoc[];
  searchFilter: string;
  onClickDoc: (id: string) => void;
  onAddDoc: () => void;
}

export function ComplianceList({
  docs,
  searchFilter,
  onClickDoc,
  onAddDoc,
}: ComplianceListProps) {
  const filtered = searchFilter
    ? docs.filter((d) =>
        d.fileName.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : docs;

  return (
    <div>
      <div className="flex items-center gap-2 px-2 pt-5 pb-1.5">
        <ShieldCheck className="size-3.5 text-primary" />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Compliance
        </span>
      </div>

      <div className="flex flex-col gap-0.5 px-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground/50">
            {searchFilter
              ? "No matching docs"
              : "No compliance docs uploaded yet"}
          </p>
        ) : (
          filtered.map((doc) => (
            <ComplianceItem
              key={doc.id}
              id={doc.id}
              fileName={doc.fileName}
              hasResults={doc.hasResults}
              metCount={doc.metCount}
              notMetCount={doc.notMetCount}
              unclearCount={doc.unclearCount}
              onClick={onClickDoc}
            />
          ))
        )}
      </div>

      <button
        onClick={onAddDoc}
        className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-muted-foreground"
      >
        <Plus className="size-3" />
        Add Doc
      </button>
    </div>
  );
}
