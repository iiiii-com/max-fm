"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { HISTORY_EVENTS, slugOf, REGION_LABEL } from "@/lib/data/history";

/** 历史事件搜索：关键词 → 结果列表 → 点击进入详情 */
export default function TimelineSearch() {
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);

  const results = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (key.length < 1) return [];
    return HISTORY_EVENTS.filter(
      (e) =>
        (e.title || "").toLowerCase().includes(key) ||
        (e.summary || "").toLowerCase().includes(key) ||
        (e.lesson || "").toLowerCase().includes(key)
    ).slice(0, 8);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setShow(true); }}
            onFocus={() => setShow(true)}
            onBlur={() => setTimeout(() => setShow(false), 200)}
            placeholder="搜索历史事件（如：安史之乱、大萧条、互联网泡沫）"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {show && q.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">未找到匹配事件</p>
          ) : (
            results.map((e) => (
              <Link
                key={slugOf(e)}
                href={`/history/${slugOf(e)}`}
                className="flex items-baseline gap-2 px-3 py-2 hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0"
              >
                <span className="text-xs font-bold shrink-0">{e.year}</span>
                <span className="text-sm truncate">{e.title}</span>
                <span className="text-[10px] text-muted ml-auto shrink-0">{REGION_LABEL[e.region] ?? e.region}</span>
              </Link>
            ))
          )}
        </div>
      )}
      <p className="text-[10px] text-muted mt-1">支持标题/简介/启示关键词检索，点击结果进入事件详情</p>
    </div>
  );
}
