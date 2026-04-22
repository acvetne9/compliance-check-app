"use client";

import { useEffect, useState } from "react";
import { FileText, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";

interface Recommendation {
  id: string;
  fileName: string;
  folderId: string;
  summary: string;
  relevanceScore: number;
}

interface RecommendationsPanelProps {
  complianceDocId: string;
  checkedPolicyIds: Set<string>;
  selectedPolicyIds: Set<string>;
  onSelectPolicy: (id: string) => void;
}

export function RecommendationsPanel({
  complianceDocId,
  checkedPolicyIds,
  selectedPolicyIds,
  onSelectPolicy,
}: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/compliance/${complianceDocId}/recommend`)
      .then((r) => r.json())
      .then((data) => {
        setRecommendations(data.recommendations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [complianceDocId]);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border/40 bg-card px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">Recommended Policies</h3>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary/30" />
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border/40 bg-card px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">Recommended Policies</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            No policy recommendations available. Upload requirements first.
          </p>
        </div>
      </div>
    );
  }

  const selectedCount = recommendations.filter((r) => selectedPolicyIds.has(r.id)).length;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border/40 bg-card px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Recommended Policies</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {recommendations.length} policies matched by topic.
          {selectedCount > 0 && ` ${selectedCount} selected.`}
          {" "}Check the ones to run against.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {recommendations.map((rec) => {
          const isChecked = checkedPolicyIds.has(rec.id);
          const isSelected = selectedPolicyIds.has(rec.id);
          const displayName = rec.fileName.replace(/\.pdf$/i, "").replace(/_/g, " ");

          return (
            <div
              key={rec.id}
              className={`mx-3 my-0.5 flex items-start gap-2 rounded-md px-3 py-2 transition-colors ${
                isChecked ? "bg-primary/5" : "hover:bg-secondary/50"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelectPolicy(rec.id)}
                className="mt-0.5 size-3 shrink-0 rounded border-border accent-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3 shrink-0 text-muted-foreground/40" />
                  <span className="truncate text-[11px] font-medium text-foreground/80">
                    {displayName}
                  </span>
                  {isChecked && <ShieldCheck className="size-3 shrink-0 text-primary/50" />}
                  {isChecked && <CheckCircle2 className="size-3 shrink-0 text-green-500/50" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="rounded bg-secondary px-1 py-0.5 text-[9px] text-muted-foreground">
                    {rec.folderId}
                  </span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(5, Math.ceil(rec.relevanceScore / 3)) }).map((_, i) => (
                      <div key={i} className="size-1 rounded-full bg-primary/40" />
                    ))}
                  </div>
                </div>
                {rec.summary && (
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/60 line-clamp-2">
                    {rec.summary}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
