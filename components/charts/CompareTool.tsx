"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "./EChart";
import ChartToolbar, { downloadCSV, type ChartType, type ChartRange } from "./ChartToolbar";
import type { EChartsOption } from "echarts";
import { MACRO_METRIC_COLORS } from "./palette";

export const METRICS = [
  { type: "gdp", name: "GDP 同比增速", unit: "%" },
  { type: "cpi", name: "CPI 同比", unit: "%" },
  { type: "ppi", name: "PPI 同比", unit: "%" },
  { type: "pmi", name: "制造业 PMI", unit: "" },
  { type: "m2", name: "M2 同比增速", unit: "%" },
  { type: "tsf", name: "社融增量", unit: "万亿" },
  { type: "lpr", name: "1年期 LPR", unit: "%" },
  { type: "fx", name: "外汇储备", unit: "万亿$" },
  { type: "ind", name: "工业增加值同比", unit: "%" },
  { type: "retail", name: "社零同比", unit: "%" },
  { type: "invest", name: "固定资产投资同比", unit: "%" },
  { type: "realestate", name: "房地产开发投资同比", unit: "%" },
  { type: "fin", name: "财政收入同比", unit: "%" },
  { type: "export", name: "出口同比", unit: "%" },
  { type: "import", name: "进口同比", unit: "%" },
  { type: "unemp", name: "城镇调查失业率", unit: "%" },
  { type: "houseprice", name: "百城房价同比", unit: "%" },
  { type: "yield10y", name: "10年期国债收益率", unit: "%" },
  { type: "usdcny", name: "美元兑人民币", unit: "" },
  { type: "m1", name: "M1 同比增速", unit: "%" },
  { type: "tsfstock", name: "社融存量同比", unit: "%" },
  { type: "loans", name: "新增人民币贷款", unit: "万亿" },
  { type: "gold", name: "伦敦金现货", unit: "美元/盎司" },
  { type: "carsales", name: "乘用车零售销量", unit: "万辆" },
].map((m) => ({ ...m, color: MACRO_METRIC_COLORS[m.type] ?? "#171717" }));

export default function CompareTool() {
  const [a, setA] = useState("gdp");
  const [b, setB] = useState("cpi");
  const [type, setType] = useState<ChartType>("line");
  const [range, setRange] = useState<ChartRange>(0);
  const [log, setLog] = useState(false);
  const [indicators, setIndicators] = useState<Array<{ type: string; date: string; value: number | null }> | null>(null);
  const metaA = METRICS.find((m) => m.type === a) ?? METRICS[0];
  const metaB = METRICS.find((m) => m.type === b) ?? METRICS[1];

  useEffect(() => {
    let alive = true;
    fetch("/api/indicators")
      .then((r) => r.json())
      .then((rows) => { if (alive) setIndicators(rows); })
      .catch(() => { if (alive) setIndicators([]); });
    return () => { alive = false; };
  }, []);

  const { dates, seriesA, seriesB } = useMemo(() => {
    const rows = indicators ?? [];
    const byType: Record<string, Map<string, number>> = {};
    for (const row of rows) {
      if (row.value == null) continue;
      (byType[row.type] ??= new Map()).set(row.date, row.value);
    }
    const ma = byType[a] ?? new Map();
    const mb = byType[b] ?? new Map();
    const all = [...new Set([...ma.keys(), ...mb.keys()])].sort();
    const picked = range === 0 ? all : all.slice(-range);
    const pick = (m: Map<string, number>) => picked.map((d) => m.get(d) ?? null);
    return { dates: picked, seriesA: pick(ma), seriesB: pick(mb) };
  }, [indicators, a, b, range]);

  const canLog = useMemo(() => {
    const vals = [...seriesA, ...seriesB].filter((v): v is number => v != null);
    return vals.length > 0 && vals.every((v) => v > 0);
  }, [seriesA, seriesB]);

  const option: EChartsOption = useMemo(() => {
    const seriesType = type === "bar" ? "bar" : "line";
    const mk = (name: string, series: (number | null)[], color: string, yAxisIndex: number, dashed = false) => ({
      name, type: seriesType, data: series, smooth: true, showSymbol: false,
      barMaxWidth: 12,
      lineStyle: { color, width: 2, type: dashed ? "dashed" : "solid" as const },
      itemStyle: { color, borderRadius: type === "bar" ? [3, 3, 0, 0] : 0 },
      areaStyle: type === "area"
        ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: "rgba(0,0,0,0)" }] } }
        : undefined,
      yAxisIndex,
    });
    return {
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
          type: log && canLog ? "log" : "value", scale: true, name: `${metaA.name}(${metaA.unit || "-"})`,
          nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 },
          splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
        },
        {
          type: log && canLog ? "log" : "value", scale: true, name: `${metaB.name}(${metaB.unit || "-"})`,
          nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 16, bottom: 6, start: 0, end: 100 },
      ],
      series: [
        mk(metaA.name, seriesA, metaA.color, 0),
        mk(metaB.name, seriesB, metaB.color, 1, true),
      ],
    } as EChartsOption;
  }, [metaA, metaB, dates, seriesA, seriesB, type, log, canLog]);

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
      <div className="flex justify-end -mt-1 mb-1">
        <ChartToolbar
          type={type} setType={setType}
          range={range} setRange={setRange}
          log={log} setLog={setLog} canLog={canLog}
          onExport={() => downloadCSV("compare.csv", ["date", metaA.name, metaB.name], dates.map((d, i) => [d, seriesA[i] ?? "", seriesB[i] ?? ""]))}
        />
      </div>
      <EChart option={option} height={320} />
      {!indicators && (
        <p className="text-xs text-muted mt-2">指标数据加载中…</p>
      )}
    </div>
  );
}