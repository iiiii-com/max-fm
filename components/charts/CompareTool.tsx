"use client";

import { useMemo, useState } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";

export const METRICS = [
  { type: "gdp", name: "GDP 同比增速", unit: "%", color: "#4f46e5" },
  { type: "cpi", name: "CPI 同比", unit: "%", color: "#dc2626" },
  { type: "ppi", name: "PPI 同比", unit: "%", color: "#ea580c" },
  { type: "pmi", name: "制造业 PMI", unit: "", color: "#0891b2" },
  { type: "m2", name: "M2 同比增速", unit: "%", color: "#2563eb" },
  { type: "tsf", name: "社融增量", unit: "万亿", color: "#0d9488" },
  { type: "lpr", name: "1年期 LPR", unit: "%", color: "#6d28d9" },
  { type: "fx", name: "外汇储备", unit: "万亿$", color: "#0e7490" },
  { type: "ind", name: "工业增加值同比", unit: "%", color: "#16a34a" },
  { type: "retail", name: "社零同比", unit: "%", color: "#ea580c" },
  { type: "invest", name: "固定资产投资同比", unit: "%", color: "#9333ea" },
  { type: "realestate", name: "房地产开发投资同比", unit: "%", color: "#b91c1c" },
  { type: "fin", name: "财政收入同比", unit: "%", color: "#15803d" },
  { type: "export", name: "出口同比", unit: "%", color: "#7c3aed" },
  { type: "import", name: "进口同比", unit: "%", color: "#a21caf" },
  { type: "unemp", name: "城镇调查失业率", unit: "%", color: "#ca8a04" },
];

export default function CompareTool({ indicators }: {
  indicators: Array<{ type: string; date: string; value: number | null }>;
}) {
  const [a, setA] = useState("gdp");
  const [b, setB] = useState("cpi");
  const metaA = METRICS.find((m) => m.type === a) ?? METRICS[0];
  const metaB = METRICS.find((m) => m.type === b) ?? METRICS[1];

  const { dates, seriesA, seriesB } = useMemo(() => {
    const byType: Record<string, Map<string, number>> = {};
    for (const row of indicators) {
      if (row.value == null) continue;
      (byType[row.type] ??= new Map()).set(row.date, row.value);
    }
    const ma = byType[a] ?? new Map();
    const mb = byType[b] ?? new Map();
    const all = new Set([...ma.keys(), ...mb.keys()]);
    const dates = [...all].sort();
    const pick = (m: Map<string, number>) => dates.map((d) => m.get(d) ?? null);
    return { dates, seriesA: pick(ma), seriesB: pick(mb) };
  }, [indicators, a, b]);

  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { data: [metaA.name, metaB.name], top: 4, textStyle: { fontSize: 12 } },
    grid: { left: 52, right: 52, top: 40, bottom: 56 },
    xAxis: {
      type: "category", data: dates,
      axisLabel: { fontSize: 10 },
      axisLine: { lineStyle: { color: "#d4d4d0" } },
    },
    yAxis: [
      {
        type: "value", scale: true, name: `${metaA.name}(${metaA.unit || "-"})`,
        nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      {
        type: "value", scale: true, name: `${metaB.name}(${metaB.unit || "-"})`,
        nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
      { type: "slider", height: 16, bottom: 6, start: 0, end: 100 },
    ],
    series: [
      {
        name: metaA.name, type: "line", data: seriesA, smooth: true, showSymbol: false,
        lineStyle: { color: metaA.color, width: 2 },
        itemStyle: { color: metaA.color },
      },
      {
        name: metaB.name, type: "line", data: seriesB, smooth: true, showSymbol: false, yAxisIndex: 1,
        lineStyle: { color: metaB.color, width: 2, type: "dashed" },
        itemStyle: { color: metaB.color },
      },
    ],
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="text-sm font-bold">指标对比</span>
        <select
          value={a}
          onChange={(e) => setA(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
        >
          {METRICS.map((m) => <option key={m.type} value={m.type}>{m.name}</option>)}
        </select>
        <span className="text-muted text-sm">vs</span>
        <select
          value={b}
          onChange={(e) => setB(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
        >
          {METRICS.map((m) => <option key={m.type} value={m.type}>{m.name}</option>)}
        </select>
      </div>
      <EChart option={option} height={320} />
    </div>
  );
}