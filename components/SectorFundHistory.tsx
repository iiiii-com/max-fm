"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { History } from "lucide-react";

interface Sector { code: string; name: string; mainFlow: number }
interface TrendPoint { date: string; main: number | null }

/** 板块主力资金近 10 日历史（东财 fflow，可切换板块） */
export default function SectorFundHistory({ sectors }: { sectors: Sector[] }) {
  const [sel, setSel] = useState<Sector | null>(sectors[0] ?? null);
  const [d, setD] = useState<{ name: string; trend: TrendPoint[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sel) return;
    let cancelled = false;
    setErr("");
    setD(null);
    fetch(`/api/market/sector-fund-history?secid=90.${sel.code}&days=10`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (cancelled ? null : j?.ok ? setD(j) : setErr(j?.error ?? "加载失败")))
      .catch((e) => !cancelled && setErr(e?.message ?? "加载失败"));
    return () => { cancelled = true; };
  }, [sel]);

  if (!sectors.length) return null;

  const opt: EChartsOption = {
    animation: false,
    tooltip: { trigger: "axis", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 }, formatter: (p: any) => { const i = Array.isArray(p) ? p[0]?.dataIndex ?? 0 : 0; const pt = d?.trend[i]; return pt ? `<b>${pt.date}</b><br/>主力净流入 ${(pt.main ?? 0) >= 0 ? "+" : ""}${((pt.main ?? 0) / 1e8).toFixed(2)}亿` : ""; } },
    grid: { left: 52, right: 14, top: 14, bottom: 22 },
    xAxis: { type: "category", data: d?.trend.map((p) => p.date.slice(5)) ?? [], axisLabel: { fontSize: 9 } },
    yAxis: { type: "value", axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 1e8).toFixed(0)}亿` }, splitLine: { lineStyle: { color: "#292929", type: "dashed" } } },
    series: [
      {
        type: "bar", data: d?.trend.map((p) => p.main) ?? [], barWidth: "55%",
        itemStyle: { color: (p: any) => (p.value >= 0 ? "rgba(215,0,11,0.75)" : "rgba(10,160,110,0.75)"), borderRadius: 2 },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
          <History className="w-3.5 h-3.5" /> 板块主力资金近 10 日
        </span>
        <select
          aria-label="选择板块"
          value={sel?.code ?? ""}
          onChange={(e) => {
            const s = sectors.find((x) => x.code === e.target.value);
            if (s) setSel(s);
          }}
          className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-card"
        >
          {sectors.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </div>
      {err ? <p className="text-xs text-muted py-3">{err}</p> : !d ? (
        <div className="h-32 animate-pulse bg-muted/10 rounded-lg" />
      ) : (
        <>
          <EChart option={opt} height={150} />
          <p className="text-[10px] text-muted mt-1">数据源：东财板块资金 fflow · 5 分钟缓存 · 红流入/绿流出</p>
        </>
      )}
    </div>
  );
}
