"use client";

import { useMemo } from "react";
import { detectPatterns, PATTERN_CATALOG, type PatternHit } from "./patterns";
import type { LabBar } from "./KlineLab";

/** 02 K 线形态识别：经典形态检测 + 命中列表（标注已在 01 实验台联动显示） */
export default function PatternCard({ bars }: { bars: LabBar[] }) {
  const hits = useMemo(() => (bars.length > 30 ? detectPatterns(bars) : []), [bars]);
  const recent = useMemo(() => hits.slice(-14).reverse(), [hits]);

  const stats = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hits) m.set(h.name, (m.get(h.name) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [hits]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium text-muted mb-2">近期形态命中（最新 14 条，买卖点已同步至 01 实验台）</p>
        {recent.length ? (
          <div className="rounded-md border border-border divide-y divide-border/50 max-h-[300px] overflow-y-auto">
            {recent.map((h: PatternHit, i) => (
              <div key={`${h.index}-${h.name}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <span className="font-mono text-muted shrink-0 w-20">{h.date}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                    h.signal === "buy" ? "bg-down/10 text-down" : "bg-primary-soft text-primary"
                  }`}
                >
                  {h.signal === "buy" ? "看涨" : "看跌"}
                </span>
                <span className="font-medium shrink-0">{h.name}</span>
                <span className="text-muted truncate" title={h.note}>{h.note}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted py-6 text-center">样本内未检测到经典形态</p>
        )}

        <p className="text-xs font-medium text-muted mt-4 mb-2">形态统计（全部 {bars.length} 根 K 线）</p>
        <div className="flex flex-wrap gap-2">
          {stats.length ? (
            stats.map(([name, n]) => (
              <span key={name} className="text-[11px] px-2 py-0.5 rounded bg-border/50 text-muted">
                {name} ×{n}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted mb-2">判定标准（《日本蜡烛图技术》通用定义 · 工程化简化）</p>
        <div className="rounded-md border border-border divide-y divide-border/50 max-h-[380px] overflow-y-auto">
          {PATTERN_CATALOG.map((c) => (
            <div key={c.name} className="flex items-start gap-2 px-3 py-2 text-xs">
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 mt-0.5 ${
                  c.signal === "buy" ? "bg-down/10 text-down" : "bg-primary-soft text-primary"
                }`}
              >
                {c.signal === "buy" ? "看涨" : "看跌"}
              </span>
              <span className="font-medium shrink-0 mt-0.5">{c.name}</span>
              <span className="text-muted leading-relaxed">{c.rule}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
