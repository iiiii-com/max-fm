"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size = "md",
  className,
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border bg-subtle p-0.5",
        className
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[6px] font-medium whitespace-nowrap transition-all duration-150",
              size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
              active
                ? "bg-card text-foreground shadow-hairline ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={cn(
                  "tabular text-[10px]",
                  active ? "text-muted-foreground" : "text-subtle-foreground/70"
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
