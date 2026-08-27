"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

interface TrendPoint {
  period: string;
  date: string;
  revenue: number | null;
  netProfit: number | null;
  grossMargin: number | null;
  roe: number | null;
  eps: number | null;
}

const LAB_SYMBOLS = [
  { label: "🇨🇳 贵州茅台", secid: "1.600519" },
  { label: "🇨🇳 宁德时代", secid: "0.300750" },
  { label: "🇨🇳 招商银行", secid: "1.600036" },
  { label: "🇨🇳 比亚迪", secid: "0.002594" },
  { label: "🇨🇳 平安银行", secid: "0.000001" },
  { label: "🇨🇳 五粮液", secid: "0.000858" },
];

/** 财务三表趋势：营收/净利/毛利率/ROE（东财 F10 真实历史） */
export default function FinancialTrends() {
  const [sel, setSel] = useState(LAB_SYMBOLS[0]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    fetch(`/api/stock/finance-trend?secid=${sel.secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.trend) && j.trend.length) {
          setTrend(j.trend);
          setName(j.name);
        } else setErr(j?.error ?? "财务数据加载失败");
      })
      .catch((e) => !cancelled && setErr(e?.message ?? "加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [sel]);

  const option = useMemo<EChartsOption>(() => {
    if (!trend.length) return {};
    const periods = trend.map((t) => t.period);
    const revenues = trend.map((t) => t.revenue);
    const profits = trend.map((t) => t.netProfit);
    const margins = trend.map((t) => t.grossMargin);
    const roes = trend.map((t) => t.roe);
    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const t = trend[i];
          if (!t) return "";
          return `<b>${t.period}</b>（${t.date}）<br/>营收 ${t.revenue ?? "—"} 亿 · 净利 ${t.netProfit ?? "—"} 亿<br/>毛利率 ${t.grossMargin ?? "—"}% · ROE ${t.roe ?? "—"}% · EPS ${t.eps ?? "—"}`;
        },
      },
      legend: { top: 2, right: 6, type: "scroll", textStyle: { fontSize: 10 }, data: ["营收(亿)", "净利(亿)", "毛利率%", "ROE%"] },
      grid: [
        { left: 56, right: 16, top: 32, height: "38%" },
        { left: 56, right: 16, top: "58%", height: "34%" },
      ],
      xAxis: [
        { type: "category", data: periods, axisLabel: { fontSize: 9, rotate: 30 } },
        { type: "category", gridIndex: 1, data: periods, axisLabel: { fontSize: 9, rotate: 30 } },
      ],
      yAxis: [
        { type: "value", name: "亿元", axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "#eef0ec" } } },
        { type: "value", gridIndex: 1, name: "%", axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "#eef0ec" } } },
      ],
      series: [
        { name: "营收(亿)", type: "bar", data: revenues, itemStyle: { color: "rgba(215,0,11,0.75)" }, barMaxWidth: 28 },
        { name: "净利(亿)", type: "bar", data: profits, itemStyle: { color: "rgba(215,0,11,0.35)" }, barMaxWidth: 28 },
        { name: "毛利率%", type: "line", yAxisIndex: 1, data: margins, smooth: true, showSymbol: false, lineStyle: { width: 1.6, color: "#3b82f6" } },
        { name: "ROE%", type: "line", yAxisIndex: 1, data: roes, smooth: true, showSymbol: false, lineStyle: { width: 1.6, color: "#f59e0b" } },
      ],
    };
  }, [trend]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted mr-1">标的：</span>
        {LAB_SYMBOLS.map((s) => (
          <button
            key={s.secid}
            onClick={() => setSel(s)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              sel.secid === s.secid ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {err ? (
        <p className="text-sm text-muted py-6 text-center">{err}（线上版本可用）</p>
      ) : loading || !trend.length ? (
        <p className="text-sm text-muted py-6 text-center">财务数据加载中…</p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card p-2">
            <EChart option={option} height={340} />
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            <b className="text-foreground">{name}</b> 近 {trend.length} 期财务趋势（东财 F10 真实财报数据，2026-08 核验）：
            营收/净利为当期累计（亿元），毛利率与 ROE 为当期值。判断标准（环节 5）：营收与净利持续双增 → 成长；毛利率稳定 → 定价权；
            净利增速持续高于营收 → 盈利质量佳；反之需警惕。
          </p>
        </>
      )}
    </div>
  );
}
