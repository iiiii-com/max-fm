"use client";

import { useEffect, useMemo, useState } from "react";

interface ValResp {
  ok: boolean;
  error?: string;
  current?: { pe: number | null; pb: number | null };
  percentile?: { pe: number | null; pb: number | null };
  stats?: { pe: { p10: number; p25: number; p50: number; p75: number; p90: number } | null; pb: { p10: number; p25: number; p50: number; p75: number; p90: number } | null };
}

/** 分位带条：P10–P90 渐变带 + 当前位置指针 */
function Band({ label, cur, pct, stats }: { label: string; cur: number | null; pct: number | null; stats: { p10: number; p25: number; p50: number; p75: number; p90: number } | null }) {
  if (cur == null || pct == null || !stats) return null;
  const pos = Math.max(0, Math.min(100, pct));
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium">
          {label} <span className="font-mono font-bold text-base ml-1">{cur.toFixed(2)}</span>
        </span>
        <span className={`text-xs font-mono ${pct <= 25 ? "down" : pct >= 75 ? "up" : "text-muted"}`}>
          近5年分位 {pct.toFixed(1)}% · {pct <= 25 ? "低估区" : pct >= 75 ? "高估区" : pct <= 50 ? "中低区" : "中高区"}
        </span>
      </div>
      <div className="relative h-8 rounded-md bg-gradient-to-r from-down/15 via-border/40 to-up/20 border border-border overflow-visible">
        {/* 分位刻度线 */}
        {[
          { p: 10, v: stats.p10 },
          { p: 25, v: stats.p25 },
          { p: 50, v: stats.p50 },
          { p: 75, v: stats.p75 },
          { p: 90, v: stats.p90 },
        ].map(({ p, v }) => (
          <div key={p} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${p}%`, transform: "translateX(-50%)" }}>
            <div className="w-px h-full bg-border-strong/60" />
            <span className="text-[9px] text-muted font-mono absolute -bottom-4 whitespace-nowrap">P{p}</span>
          </div>
        ))}
        {/* 当前位置指针 */}
        <div className="absolute -top-1 -bottom-1 flex flex-col items-center transition-all" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
          <div className="w-0.5 h-[calc(100%+8px)] bg-primary rounded-full" />
          <span className="text-[10px] font-bold text-primary font-mono absolute -top-4 whitespace-nowrap">{cur.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

/** 04 估值区间测算：近 5 年 PE/PB 分位带 + 当前位置 + 测算依据 */
export default function ValuationCard({ secid, isIndex }: { secid: string; isIndex: boolean }) {
  const [data, setData] = useState<ValResp | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr("");
    fetch(`/api/stock/valuation-percentile?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setData(j);
        else setErr(j?.error ?? "估值数据暂不可用");
      })
      .catch(() => alive && setErr("估值数据暂不可用"));
    return () => {
      alive = false;
    };
  }, [secid]);

  const isUsOrHk = useMemo(() => {
    const mkt = secid.split(".")[0];
    return mkt !== "0" && mkt !== "1";
  }, [secid]);

  if (isUsOrHk) {
    return <p className="text-sm text-muted py-8 text-center">估值分位暂仅支持 A 股个股与主要指数（数据源：东方财富 5 年历史估值）。</p>;
  }
  if (err) return <p className="text-sm text-muted py-8 text-center">{err}</p>;
  if (!data) return <p className="text-sm text-muted py-8 text-center">估值数据加载中…</p>;

  return (
    <div className="pt-4">
      <Band label="PE-TTM" cur={data.current?.pe ?? null} pct={data.percentile?.pe ?? null} stats={data.stats?.pe ?? null} />
      <Band label="PB（MRQ）" cur={data.current?.pb ?? null} pct={data.percentile?.pb ?? null} stats={data.stats?.pb ?? null} />

      <div className="mt-8 rounded-md bg-surface/60 border border-border/60 p-3 text-xs leading-relaxed">
        <p className="font-medium mb-1">测算依据</p>
        <p className="text-muted">
          取该标的{isIndex ? "指数" : "个股"}近 5 年（约 1240 个交易日）每日 PE-TTM / PB-MRQ 序列，计算当前值在历史序列中的百分位（小于当前值的样本占比），
          并给出 P10/P25/P50/P75/P90 五档分位。分位越低代表当前估值相对自身历史越便宜；这是相对估值而非绝对结论 —— 高成长股长期处于高分区、周期股反之属正常现象。
        </p>
      </div>
    </div>
  );
}
