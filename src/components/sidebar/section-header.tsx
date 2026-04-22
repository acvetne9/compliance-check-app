"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface SectionHeaderProps {
  icon: React.ReactNode;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  icon,
  label,
  defaultOpen = true,
  children,
}: SectionHeaderProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2 pt-4 pb-1.5 text-left"
      >
        {icon}
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <ChevronDown
          className={`size-3 text-muted-foreground/40 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && children}
    </div>
  );
}
