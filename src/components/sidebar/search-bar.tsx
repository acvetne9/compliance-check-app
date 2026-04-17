"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative px-3 py-2">
      <Search className="absolute left-5.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search documents..."
        className="h-8 w-full rounded-lg bg-sidebar-accent/60 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 transition-all focus:bg-sidebar-accent focus:outline-none focus:ring-1 focus:ring-primary/20"
      />
    </div>
  );
}
