"use client";

import { useMemo, useState } from "react";
import { fmt, fmtPct, fmtWan } from "@/lib/utils";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

export interface ScorePanelData {
  total: number;
  level: string;
  tech: number;
  flow: number;
  valuation: number;
  fundamentals: number;
  summary: string;
  signals: string[];
}

export interface FlowPanelData {
  mainNetIn: number;
  mainPct: number;
  superNetIn: number;
  bigNetIn: number;
  midNetIn: number;
  smallNetIn: number;
  mainNetIn5: number | null;
  mainNetIn10: number | null;
  trend: string;
  trendScore: number;
}

function scoreColor(n: number) {
  if (n >= 70) return "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/40 dark:bg-red-950/30";
  if (n >= 50) return "text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/40 dark:bg-orange-950/30";
  if (n >= 40) return "text-sky-600 border-sky-200 bg-sky-50 dark:text-sky-400 dark:border-sky-900/40 dark:bg-sky-950/30";
  return "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/40 dark:bg-emerald-950/30";
}

function flowColor(n: number) {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "";
}

export default function ScorePanel({ data, loading }: { data: ScorePanelData | null; loading?: boolean }) {
  if (loading) return <p className="text-xs text-muted">评分计算中…</p>;
  if (!data) return <p className="text-xs text-muted">暂无评分数据</p>;
  const dims: Array<[string, number]> = [
    ["技术面", data.tech],
    ["资金面", data.flow],
    ["估值面", data.valuation],
    ["基本面", data.fundamentals],
  ];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-2xl font-bold font-mono px-2.5 py-1 rounded-lg border ${scoreColor(data.total)}`}>{data.total}</span>
        <div>
          <p className="text-sm font-medium">{data.level}</p>
          <p className="text-[11px] text-muted">综合评分（0-100）</p>
        </div>
      </div>
      {data.signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {data.signals.map((s, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {dims.map(([name, v]) => (
          <div key={name} className="text-center rounded-md bg-muted/40 px-1 py-1.5">
            <p className="text-[10px] text-muted">{name}</p>
            <p className={`text-sm font-bold font-mono ${v >= 60 ? "up" : v <= 40 ? "down" : ""}`}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FlowPanel({ data, loading }: { data: FlowPanelData | null; loading?: boolean }) {
  const [range, setRange] = useState<"1d" | "5d" | "10d">("1d");
  const { chartOption, donutOption } = useMemo<{
    chartOption: EChartsOption;
    donutOption: EChartsOption;
  }>(() => {
    if (!data) return { chartOption: {}, donutOption: {} };
    const tiers: Array<{ name: string; value: number }> = [
      { name: "超大单", value: data.superNetIn / 1e8 },
      { name: "大单", value: data.bigNetIn / 1e8 },
      { name: "中单", value: data.midNetIn / 1e8 },
      { name: "小单", value: data.smallNetIn / 1e8 },
    ];
    const main = data.mainNetIn / 1e8;
    const retail = (data.midNetIn + data.smallNetIn) / 1e8;
    const chartOption: EChartsOption = {
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const p = params?.[0];
          if (!p) return "";
          const t = tiers[p.dataIndex];
          return `${t.name}<br/>净流入：${t.value >= 0 ? "+" : ""}${t.value.toFixed(2)}亿`;
        },
      },
      xAxis: {
        type: "value",
        min: (v: any) => Math.min(-0.2, v.min * 1.1),
        max: (v: any) => Math.max(0.2, v.max * 1.1),
        axisLabel: { fontSize: 9, formatter: "{value}亿" },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
      },
      yAxis: {
        type: "category",
        data: tiers.map((t) => t.name),
        inverse: true,
        axisTick: { show: false },
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          barWidth: 12,
          data: tiers.map((t) => ({
            value: Number(t.value.toFixed(2)),
            itemStyle: {
              borderRadius: [0, 3, 3, 0],
              color:
                t.value >= 0
                  ? { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "rgba(220,38,38,0.35)" }, { offset: 1, color: "#dc2626" }] }
                  : { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "rgba(22,163,74,0.35)" }, { offset: 1, color: "#16a34a" }] },
            },
          })),
          label: {
            show: true,
            position: "right",
            fontSize: 9,
            color: "inherit",
            formatter: (p: any) => `${p.value >= 0 ? "+" : ""}${Number(p.value).toFixed(1)}亿`,
          },
        },
      ],
    };
    const donutOption: EChartsOption = {
      tooltip: {
        trigger: "item",
        formatter: (p: any) => `${p.name}<br/>净流入：${p.value >= 0 ? "+" : ""}${Number(p.value).toFixed(2)}亿`,
      },
      legend: { bottom: 0, textStyle: { fontSize: 10 }, itemWidth: 10, itemHeight: 10 },
      series: [
        {
          type: "pie",
          radius: ["46%", "70%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 1 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 11, fontWeight: "bold" } },
          data: [
            { name: "主力净流入", value: Math.abs(Number(main.toFixed(2))), itemStyle: { color: main >= 0 ? "#dc2626" : "#16a34a" } },
            { name: "散户净流入", value: Math.abs(Number(retail.toFixed(2))), itemStyle: { color: retail >= 0 ? "#dc2626" : "#16a34a" } },
          ],
        },
      ],
    };
    return { chartOption, donutOption };
  }, [data]);

  if (loading) return <p className="text-xs text-muted">资金流加载中…</p>;
  if (!data) return <p className="text-xs text-muted">暂无资金流数据</p>;
  const rangeMain = range === "5d" ? data.mainNetIn5 : range === "10d" ? data.mainNetIn10 : data.mainNetIn;
  const rows: Array<[string, number, boolean]> = [
    ["主力净流入", data.mainNetIn, true],
    ["超大单", data.superNetIn, true],
    ["大单", data.bigNetIn, true],
    ["中单", data.midNetIn, true],
    ["小单", data.smallNetIn, true],
  ];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm font-medium">资金流向</p>
        <span className={`text-[11px] px-1.5 py-0.5 rounded ${data.trend === "流入" ? "up bg-red-50 dark:bg-red-950/40" : data.trend === "流出" ? "down bg-emerald-50 dark:bg-emerald-950/40" : "text-muted bg-muted/40"}`}>
          {data.trend} {data.trendScore}分
        </span>
      </div>

      {/* 时间范围切换 */}
      <div className="flex rounded-md border border-border overflow-hidden text-xs mb-2 w-fit">
        {([["1d", "当日"], ["5d", "5日"], ["10d", "10日"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            className={`px-2 py-0.5 ${range === k ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 主数字：按时间范围切换 */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-xl font-bold font-mono ${flowColor(Number(rangeMain))}`}>
          {rangeMain == null ? "—" : `${Number(rangeMain) >= 0 ? "+" : ""}${fmtWan(Number(rangeMain) / 1e8)}`}
        </span>
        <span className="text-[11px] text-muted">主力净流入（{range === "1d" ? "当日" : range === "5d" ? "5日" : "10日"}）</span>
      </div>

      {/* 四档资金条形图 */}
      <EChart option={chartOption} height={150} />

      {/* 主力 vs 散户占比环图 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
        <EChart option={donutOption} height={150} className="min-w-0" />
        <div className="flex flex-col justify-center text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted">主力（超大+大单）</span>
            <span className={`font-mono font-medium ${flowColor(data.mainNetIn)}`}>{fmtWan(data.mainNetIn / 1e8)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">散户（中+小单）</span>
            <span className={`font-mono font-medium ${flowColor((data.midNetIn + data.smallNetIn))}`}>{fmtWan((data.midNetIn + data.smallNetIn) / 1e8)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-muted">净占比</span>
            <span className={`font-mono font-medium ${flowColor(data.mainPct)}`}>{data.mainPct >= 0 ? "+" : ""}{data.mainPct.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs mt-2 pt-2 border-t border-border/60">
        {rows.map(([name, v, show]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-muted">{name}</span>
            <span className={`font-mono font-medium ${flowColor(v)}`}>{show ? fmtWan(v / 1e8) : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignalChips({ signals }: { signals: string[] }) {
  if (!signals?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((s, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
      ))}
    </div>
  );
}

export function fmtMoney(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return fmt(n, 0);
}

export { fmtPct };