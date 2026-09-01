"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { Activity } from "lucide-react";

interface TrendPoint { t: string; main: number | null }

/** 主力资金分时曲线（东财 fflow 分钟级；非交易时段显示提示） */
export default function FundTrendChart({ secid }: { secid: string }) {
  const [d, setD] = useState<{ trend: TrendPoint[]; inTrading: boolean } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/fund-trend?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (cancelled ? null : j?.ok ? setD(j) : setErr(j?.error ?? "加载失败")))
      .catch((e) => !cancelled && setErr(e?.message ?? "加载失败"));
    return () => { cancelled = true; };
  }, [secid]);

  if (err) return null;
  if (!d) return <div className="h-28 animate-pulse bg-muted/10 rounded-lg" />;
  if (!d.inTrading || !d.trend.length) {
    return (
      <p className="text-[11px] text-muted rounded-lg border border-border/60 px-3 py-2">
        <Activity className="w-3 h-3 inline mr-1" />
        主力资金分时曲线：当前非交易时段（交易日 09:30-11:30 / 13:00-15:00 可查看分钟级资金流向）。
      </p>
    );
  }

  const times = d.trend.map((p) => p.t);
  const mains = d.trend.map((p) => p.main);
  const last = d.trend[d.trend.length - 1]?.main ?? 0;

  const option: EChartsOption = {
    animation: false,
    tooltip: { trigger: "axis", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 }, formatter: (p: any) => { const i = Array.isArray(p) ? p[0]?.dataIndex ?? 0 : 0; const pt = d.trend[i]; return pt ? `<b>${pt.t}</b><br/>主力累计净流入 ${(pt.main ?? 0) >= 0 ? "+" : ""}${((pt.main ?? 0) / 1e8).toFixed(2)}亿` : ""; } },
    grid: { left: 52, right: 14, top: 14, bottom: 20 },
    xAxis: { type: "category", data: times, axisLabel: { fontSize: 8, interval: Math.floor(times.length / 4) }, boundaryGap: false },
    yAxis: { type: "value", axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 1e8).toFixed(0)}亿` }, splitLine: { lineStyle: { color: "#292929", type: "dashed" } } },
    series: [
      {
        name: "主力净流入(累计)", type: "line", data: mains, showSymbol: false,
        lineStyle: { width: 1.4, color: last >= 0 ? "#d7000b" : "#0aa06e" },
        areaStyle: { color: last >= 0 ? "rgba(215,0,11,0.08)" : "rgba(10,160,110,0.08)" },
        markLine: { silent: true, symbol: "none", lineStyle: { color: "#94a3b8", type: "dashed", width: 0.8 }, data: [{ yAxis: 0 }] },
      },
    ],
  };

  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <p className="flex items-center gap-1 text-[11px] font-bold mb-1 text-primary">
        <Activity className="w-3.5 h-3.5" /> 主力资金分时（累计净流入 · 当前 {last >= 0 ? "+" : ""}{(last / 1e8).toFixed(2)} 亿）
      </p>
      <EChart option={option} height={150} />
      <p className="text-[10px] text-muted mt-1">数据源：东财 fflow 分钟级 · 15 秒延迟</p>
    </div>
  );
}
