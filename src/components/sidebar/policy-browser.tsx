"use client";

import { FolderClosed, Plus } from "lucide-react";
import { PolicyFolder } from "./policy-folder";
import { PolicyItem } from "./policy-item";

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

interface PolicyBrowserProps {
  folders: PolicyFolderData[];
  selectedIds: Set<string>;
  searchFilter: string;
  onSelectPolicy: (id: string) => void;
  onClickPolicy: (id: string) => void;
  onRemovePolicy: (id: string) => void;
  onAddPolicy: () => void;
}

export function PolicyBrowser({
  folders,
  selectedIds,
  searchFilter,
  onSelectPolicy,
  onClickPolicy,
  onRemovePolicy,
  onAddPolicy,
}: PolicyBrowserProps) {
  const filteredFolders = folders
    .map((folder) => ({
      ...folder,
      docs: searchFilter
        ? folder.docs.filter((d) =>
            d.fileName.toLowerCase().includes(searchFilter.toLowerCase())
          )
        : folder.docs,
    }))
    .filter((folder) => !searchFilter || folder.docs.length > 0);

  return (
    <div>
      <div className="flex items-center gap-2 px-2 pt-3 pb-1.5">
        <FolderClosed className="size-3.5 text-primary/60" />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Policies
        </span>
      </div>

      <div className="flex flex-col gap-0.5 px-1">
        {filteredFolders.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground/50">
            {searchFilter ? "No matching policies" : "No policies ingested yet"}
          </p>
        ) : (
          filteredFolders.map((folder) => (
            <PolicyFolder
              key={folder.folderId}
              folderId={folder.folderId}
              docCount={folder.docs.length}
            >
              {folder.docs.map((doc) => (
                <PolicyItem
                  key={doc.id}
                  id={doc.id}
                  fileName={doc.fileName}
                  selected={selectedIds.has(doc.id)}
                  hasResults={doc.status != null}
                  status={doc.status}
                  onSelect={onSelectPolicy}
                  onClick={onClickPolicy}
                  onRemove={onRemovePolicy}
                />
              ))}
            </PolicyFolder>
          ))
        )}
      </div>

      <button
        onClick={onAddPolicy}
        className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-muted-foreground"
      >
        <Plus className="size-3" />
        Add Policy
      </button>
    </div>
  );
}
