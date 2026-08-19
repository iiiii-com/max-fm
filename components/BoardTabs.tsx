"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface TabItem {
  key: string;
  label: string;
}

export default function BoardTabs({ tabs, active, children }: { tabs: TabItem[]; active: string; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setTab = useCallback(
    (key: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (key === tabs[0]?.key) p.delete("tab");
      else p.set("tab", key);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, tabs]
  );
  return (
    <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
            active === t.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
      {children}
    </div>
  );
}