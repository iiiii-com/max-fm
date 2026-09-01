"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "@/components/charts/echarts";
import { echarts } from "@/components/charts/echarts";
import EChart from "@/components/charts/EChart";
import { Card } from "@/components/ui";
import { BULL_BEAR_CYCLES } from "@/lib/data/bullbear";
import { BULL_BEAR_EVENTS, EVENT_DIR_META } from "@/lib/data/bullbear-events";
import { sma, macd, boll, kdj, rsi, detectSwings, buildSwingMarkPoints, type IndicatorKey } from "@/lib/data/indicators";
import { mkMainAxis, mkSubAxis } from "@/lib/data/axis";
import { mkPctSeries } from "@/lib/data/kline-tooltip";
import DailyMoveBadge from "@/components/charts/DailyMoveBadge";
import { mkKlineTooltip } from "@/lib/data/kline-tooltip";
import AnnotatableChart from "@/components/charts/AnnotatableChart";
import rawKline from "@/data/sh-index.json";

interface Bar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

const BARS: Bar[] = (rawKline as [string, string, string, string, string, string][]).map((r) => ({
  date: r[0],
  open: Number(r[1]),
  close: Number(r[2]),
  high: Number(r[3]),
  low: Number(r[4]),
  volume: Number(r[5]),
}));

/** 早期 3 段（1990-1993 腾讯源点位失真，用上交所公开点位） */
const EARLY_NOTE =
  "1990-1993 前三轮（牛1→熊1→牛2）腾讯源数据失真，已用上交所公开点位校准；K 线图自 1993-01-04 起为真实日线";

function fmtVol(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿手`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万手`;
  return `${n.toFixed(0)}手`;
}

/**
 * 统一标注标签样式工厂：
 * - rotate: 0 强制文字水平（修复 ECharts markLine 竖直线导致文字垂直的问题）
 * - 白底 + 主题色字 + 浅描边，在涨红跌绿背景下均醒目
 * - position 支持 "top"/"bottom"/"start"/"end"（沿线的外侧，不遮挡 K 线主体）
 */
function mkLabel(text: string, color: string, position: "start" | "end" | "top" | "bottom" = "end") {
  return {
    show: true,
    formatter: text,
    color, // 文字用主题色，与背景强对比
    fontSize: 10,
    fontWeight: "bold" as const,
    rotate: 0, // 关键：强制水平，避免沿线旋转
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: color,
    borderWidth: 1,
    borderRadius: 3,
    padding: [2, 5],
    position,
    distance: 6,
  };
}

/** 月K聚合：每月首日开盘 / 末日收盘 / 区间最高最低 / 月累计量 */
function aggregateMonthly(bars: Bar[]): Bar[] {
  const map = new Map<string, Bar[]>();
  for (const b of bars) {
    const key = b.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  const out: Bar[] = [];
  for (const [month, group] of map) {
    const first = group[0];
    const last = group[group.length - 1];
    out.push({
      date: `${month}-01`,
      open: first.open,
      close: last.close,
      high: Math.max(...group.map((b) => b.high)),
      low: Math.min(...group.map((b) => b.low)),
      volume: group.reduce((a, b) => a + b.volume, 0),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const CYCLE_COLORS = {
  bullLine: "#dc2626",
  bearLine: "#16a34a",
  bullArea: "rgba(220,38,38,0.06)",
  bearArea: "rgba(22,163,74,0.06)",
};

/** 构建蜡烛图 option：牛熊起终点标注 + 区间底色 + 成交量副图 */
function buildOption(
  bars: Bar[],
  cycles: typeof BULL_BEAR_CYCLES,
  period: "day" | "month",
  rangeStart = 0,
  indicators: IndicatorKey[] = ["ma"],
  showSwing = true,
  showPct = false,
  pctPos: "top" | "bottom" = "top",
  pctFont = 9,
  vRange: [number, number] | null = null
): EChartsOption {
  const dates = bars.map((b) => b.date);
  const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
  const volumes = bars.map((b) => ({
    value: b.volume,
    itemStyle: { color: b.close >= b.open ? "rgba(220,38,38,0.55)" : "rgba(22,163,74,0.55)" },
  }));
  const idxByDate = new Map(dates.map((d, i) => [d, i]));

  const markLines: any[] = [];
  const markAreas: any[] = [];

  // ---- 涨跌幅度标注：zigzag 识别峰谷，锚定价格点位 ----
  // 阈值：日K 用 15%（避免 8190 根点过密），月K 用 25%（月线波动更大）
  const swingThreshold = period === "day" ? 15 : 25;
  const swings = detectSwings(bars.map((b) => b.close), swingThreshold);
  const swingMarks = showSwing ? buildSwingMarkPoints(swings, { maxCount: period === "day" ? 48 : 40, minAbsPct: swingThreshold }) : [];

  for (const c of cycles) {
    const iFrom = idxByDate.get(c.from);
    const iTo = idxByDate.get(c.to);
    if (iFrom == null && iTo == null) continue;
    const isBull = c.phase === "bull";
    const lineColor = isBull ? CYCLE_COLORS.bullLine : CYCLE_COLORS.bearLine;
    const areaColor = isBull ? CYCLE_COLORS.bullArea : CYCLE_COLORS.bearArea;
    const labelColor = isBull ? "#dc2626" : "#16a34a";
    const short = c.period.replace(/^(牛|熊)(\d+)-/, "$1$2");
    if (iFrom != null) {
      markLines.push({
        xAxis: dates[iFrom],
        lineStyle: { color: lineColor, width: 1.2, type: "solid" },
        label: mkLabel(`${short}启动`, labelColor, "start"),
      });
    }
    if (iTo != null) {
      markLines.push({
        xAxis: dates[iTo],
        lineStyle: { color: lineColor, width: 1.2, type: "dashed" },
        label: mkLabel(`${short}${isBull ? "见顶" : "见底"}`, labelColor, "end"),
      });
    }
    // 区间底色：从起点（或前一交易日）到终点
    const sIdx = iFrom ?? 0;
    const eIdx = iTo ?? bars.length - 1;
    if (eIdx > sIdx) {
      markAreas.push([
        { xAxis: dates[sIdx], itemStyle: { color: areaColor } },
        { xAxis: dates[eIdx] },
      ]);
    }
  }

  // 重大回调标注：牛市内高点到低点 > 20% 的回落（仅日K展示，避免月K过密）
  if (period === "day") {
    const majorPulls: Array<{ from: string; to: string; label: string }> = [];
    for (const c of cycles) {
      if (c.phase !== "bull") continue;
      const i0 = idxByDate.get(c.from);
      const i1 = idxByDate.get(c.to);
      if (i0 == null || i1 == null) continue;
      // 寻找牛市内超过 20% 的回调段
      let peakIdx = i0;
      for (let i = i0 + 1; i <= i1; i++) {
        if (bars[i].close > bars[peakIdx].close) peakIdx = i;
        const dd = (bars[peakIdx].close - bars[i].close) / bars[peakIdx].close;
        if (dd > 0.2) {
          // 该点为回调低点（粗略）
          majorPulls.push({
            from: bars[peakIdx].date,
            to: bars[i].date,
            label: `回调${(dd * 100).toFixed(0)}%`,
          });
          peakIdx = i;
        }
      }
    }
    // 只保留最显著的若干条，避免标注过密
    const significant = majorPulls.slice(-6);
    for (const p of significant) {
      const ia = idxByDate.get(p.from);
      const ib = idxByDate.get(p.to);
      if (ia == null || ib == null || ia === ib) continue;
      markAreas.push([
        { xAxis: p.from, itemStyle: { color: "rgba(139,92,246,0.08)" } },
        { xAxis: p.to },
      ]);
      markLines.push({
        xAxis: p.to,
        lineStyle: { color: "#8b5cf6", width: 1, type: "dotted" },
        label: mkLabel(p.label, "#7c3aed", "end"),
      });
    }
  }

  // ---- 关键事件精细标注（修正版）：精确对齐 + 防重叠 + 统一虚线样式 ----
  // 判定标准：事件标注一律采用"事件实际发布/发生日 → 最近交易日"映射（节假日向前对齐）；
  // 标签位置按时间顺序交替上下排布，避免同区重叠；影响区间用映射后交易日对齐。
  const evSorted = [...BULL_BEAR_EVENTS].sort((a, b) => a.date.localeCompare(b.date));
  let labelOnTop = true; // 交替标注位置
  for (const ev of BULL_BEAR_EVENTS) {
    // 事件日期精确映射到最近交易日（节假日/周末自动对齐前一交易日）
    let iEv = idxByDate.get(ev.date);
    if (iEv == null) {
      for (let i = 0; i < bars.length; i++) {
        if (bars[i].date > ev.date) break;
        iEv = i;
      }
    }
    if (iEv == null) continue;
    const meta = EVENT_DIR_META[ev.direction];
    const evColor = meta.color;
    const evDate = bars[iEv].date; // 映射后的实际交易日
    labelOnTop = !labelOnTop;
    // 事件触发时点：统一"竖直虚线 + 标签"，标签在竖线顶端/底端水平排列、交替上下防重叠
    const evText = ev.name.length > 7 ? `${ev.name.slice(0, 7)}…` : ev.name;
    markLines.push({
      xAxis: evDate,
      lineStyle: { color: evColor, width: 1.2, type: "dashed" },
      label: mkLabel(evText, evColor, labelOnTop ? "start" : "end"),
    });
    // 影响区间（markArea）：严格使用映射后的交易日对齐，避免节假日漂移
    const iEnd = (() => {
      const next = evSorted.find((e) => e.date > ev.date && e.cycle === ev.cycle)?.date ?? ev.until;
      if (next) {
        let i2 = idxByDate.get(next);
        if (i2 == null) {
          for (let i = bars.length - 1; i >= 0; i--) {
            if (bars[i].date <= next) {
              i2 = i;
              break;
            }
          }
        }
        if (i2 != null && i2 > iEv) return i2;
      }
      return Math.min(iEv + 40, bars.length - 1);
    })();
    const startClose = bars[iEv].close;
    const endClose = bars[iEnd].close;
    const pct = ((endClose - startClose) / startClose) * 100;
    markAreas.push([
      {
        xAxis: evDate,
        itemStyle: {
          color:
            ev.direction === "down"
              ? "rgba(22,163,74,0.07)"
              : ev.direction === "volatile"
                ? "rgba(217,119,6,0.06)"
                : "rgba(220,38,38,0.07)",
        },
      },
      { xAxis: bars[iEnd].date },
    ]);
    // 涨跌幅标签：标注事件后区间涨跌（作为 markLine 附加）
    if (Math.abs(pct) >= 1) {
      markLines.push({
        xAxis: bars[iEnd].date,
        lineStyle: { color: evColor, width: 1, type: "dashed" },
        label: mkLabel(`区间 ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, pct >= 0 ? "#dc2626" : "#16a34a", "end"),
      });
    }
  }

  const closes = bars.map((b) => b.close);
  const hasMacd = indicators.includes("macd");
  // 动态网格：主图 + 成交量（+ MACD 副图）
  const grid = [
    { left: 56, right: 16, top: 36, height: hasMacd ? "44%" : "56%" },
    { left: 56, right: 16, top: hasMacd ? "62%" : "76%", height: "12%" },
  ];
  if (hasMacd) grid.push({ left: 56, right: 16, top: "78%", height: "14%" });
  const xAxes = [
    {
      ...mkMainAxis({ dataLength: dates.length, period, firstDate: dates[0], lastDate: dates[dates.length - 1] }),
      data: dates,
    },
    { ...mkSubAxis(dates.length, 1), data: dates },
  ];
  if (hasMacd) xAxes.push({ ...mkSubAxis(dates.length, 2), data: dates });
  const yAxes: any[] = [
    { type: "value", scale: true, gridIndex: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#292929", type: "dashed" } } },
    { type: "value", gridIndex: 1, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
  ];
  if (hasMacd) yAxes.push({ type: "value", gridIndex: 2, axisLabel: { fontSize: 9 }, splitLine: { show: false }, scale: true });

  // 指标系列
  const indicatorSeries: any[] = [];
  const legendData = ["K 线"];
  if (indicators.includes("ma")) {
    const m5 = sma(closes, 5), m10 = sma(closes, 10), m20 = sma(closes, 20), m60 = sma(closes, 60);
    for (const [name, data, color] of [["MA5", m5, "#f59e0b"], ["MA10", m10, "#3b82f6"], ["MA20", m20, "#8b5cf6"], ["MA60", m60, "#ef4444"]] as const) {
      indicatorSeries.push({ name, type: "line", data, smooth: true, showSymbol: false, lineStyle: { width: 1, color } });
      legendData.push(name);
    }
  }
  if (indicators.includes("boll")) {
    const b = boll(closes);
    indicatorSeries.push({ name: "BOLL上", type: "line", data: b.upper, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#94a3b8", type: "dashed" } });
    indicatorSeries.push({ name: "BOLL中", type: "line", data: b.mid, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#64748b" } });
    indicatorSeries.push({ name: "BOLL下", type: "line", data: b.lower, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#94a3b8", type: "dashed" } });
    legendData.push("BOLL上", "BOLL中", "BOLL下");
  }
  if (indicators.includes("kdj")) {
    const k = kdj(bars);
    for (const [name, data, color] of [["K", k.k, "#f59e0b"], ["D", k.d, "#3b82f6"], ["J", k.j, "#a855f7"]] as const) {
      indicatorSeries.push({ name, type: "line", data, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color } });
      legendData.push(name);
    }
  }
  if (indicators.includes("rsi")) {
    const r6 = rsi(closes, 6), r14 = rsi(closes, 14);
    for (const [name, data, color] of [["RSI6", r6, "#f59e0b"], ["RSI14", r14, "#8b5cf6"]] as const) {
      indicatorSeries.push({ name, type: "line", data, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color } });
      legendData.push(name);
    }
  }
  if (hasMacd) {
    const m = macd(closes);
    indicatorSeries.push({ name: "DIF", type: "line", data: m.dif, xAxisIndex: 2, yAxisIndex: 2, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color: "#3b82f6" } });
    indicatorSeries.push({ name: "DEA", type: "line", data: m.dea, xAxisIndex: 2, yAxisIndex: 2, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color: "#f59e0b" } });
    indicatorSeries.push({
      name: "MACD", type: "bar", data: m.hist.map((v) => ({ value: v, itemStyle: { color: (v ?? 0) >= 0 ? "rgba(220,38,38,0.55)" : "rgba(22,163,74,0.55)" } })),
      xAxisIndex: 2, yAxisIndex: 2,
    });
    legendData.push("DIF", "DEA", "MACD");
  }
  legendData.push("成交量");

  return {
    animation: false,
    tooltip: mkKlineTooltip({ bars, formatter: (params: any) => {
      const arr = Array.isArray(params) ? params : [params];
      const i = arr[0]?.dataIndex ?? 0;
      const b = bars[i];
      if (!b) return "";
      const lines = arr.map((p: any) => `${p.marker}${p.seriesName}: ${p.value ?? "—"}`).join("<br/>");
      return `<div style="font-size:12px;line-height:1.6"><b>${b.date}</b><br/>开 ${b.open}　高 ${b.high}<br/>收 ${b.close}　低 ${b.low}<br/>${lines}<br/>量 ${fmtVol(b.volume)}</div>`;
    } }),
    legend: { top: 4, right: 8, textStyle: { fontSize: 11 }, data: legendData },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid,
    xAxis: xAxes,
    yAxis: yAxes,
    dataZoom: [
      /* category 轴下用 minSpan（百分比）而非 minValueSpan（对 category 无效）：
         0.05% ≈ 4-5 根日K，保证放大上限足够小；maxSpan 100 允许全览 */
      { type: "inside", xAxisIndex: hasMacd ? [0, 1, 2] : [0, 1], start: vRange?.[0] ?? rangeStart, end: vRange?.[1] ?? 100, zoomOnMouseWheel: true, minSpan: 0.05, maxSpan: 100 },
      { type: "slider", xAxisIndex: hasMacd ? [0, 1, 2] : [0, 1], height: 16, bottom: 4, start: vRange?.[0] ?? rangeStart, end: vRange?.[1] ?? 100, minSpan: 0.05, maxSpan: 100 },
    ],
    series: [
      {
        name: "K 线",
        type: "candlestick",
        data: ohlc,
        itemStyle: { color: "#dc2626", color0: "#16a34a", borderColor: "#dc2626", borderColor0: "#16a34a" },
        markLine: { symbol: "none", silent: true, data: markLines },
        markArea: { silent: true, data: markAreas },
        markPoint: {
          symbol: "pin",
          symbolSize: 46,
          data: swingMarks,
          tooltip: { formatter: (p: any) => p.value },
          label: { show: true },
        },
      },
      // 逐根涨跌幅标注（scatter 叠加，candlestick label 实测不渲染）
      mkPctSeries({ bars, show: showPct, position: pctPos, fontSize: pctFont, pctRange: vRange }),
      ...indicatorSeries,
      { name: "成交量", type: "bar", data: volumes, xAxisIndex: 1, yAxisIndex: 1 },
    ],
  };
}

export default function BullBearKline() {
  const [period, setPeriod] = useState<"day" | "month">("day");
  const [range, setRange] = useState<"all" | "5y" | "10y" | "20y">("all");
  const [indicators, setIndicators] = useState<IndicatorKey[]>(["ma"]);
  const [showSwing, setShowSwing] = useState(true);
  const [showPct, setShowPct] = useState(true);
  const [pctPos, setPctPos] = useState<"top" | "bottom">("top");
  const [pctFont, setPctFont] = useState(9);
  // 当前可视窗口（start/end 百分比）：只用于缩放时局部更新涨跌幅标注，
  // 不进入 option 重建 —— dataZoom 完全由 ECharts 内部管理，消除「缩放被 React 重置」的反馈回路
  const chartRef = useRef<echarts.ECharts | null>(null);
  const viewRef = useRef<[number, number] | null>(null);

  /** 用当前窗口局部更新「涨跌幅」标注系列（不重建 option，不动 dataZoom，缩放无上限） */
  const syncPctSeries = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const pctSeries = mkPctSeries({ bars: viewBarsRef.current, show: showPct, position: pctPos, fontSize: pctFont, pctRange: viewRef.current });
    chart.setOption({ series: [{ name: "涨跌幅", ...(pctSeries as any) }] } as any, { notMerge: false });
  }, [showPct, pctPos, pctFont]);

  const onZoom = useCallback(
    (e?: unknown) => {
      const ev = e as { batch?: Array<{ start?: number; end?: number }> } | undefined;
      const b = ev?.batch?.[0];
      if (b && typeof b.start === "number" && typeof b.end === "number") {
        viewRef.current = [b.start, b.end];
        syncPctSeries();
      }
    },
    [syncPctSeries]
  );

  const toggleIndicator = (k: IndicatorKey) => {
    setIndicators((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  };

  // 数据自 1993-01-04 起（腾讯源可靠区间，避免早期失真干扰）
  const bars = useMemo(() => {
    const reliable = BARS.filter((b) => b.date >= "1993-01-04");
    return period === "month" ? aggregateMonthly(reliable) : reliable;
  }, [period]);
  // bars 的 ref 副本：缩放回调里局部更新标注需要最新 bars
  const viewBarsRef = useRef(bars);
  viewBarsRef.current = bars;

  // 快速定位：按起始百分比设置 dataZoom（默认全部展示，可一键聚焦近 N 年）
  const rangeStartFor = useCallback(
    (k: "all" | "5y" | "10y" | "20y") => {
      if (k === "all") return 0;
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - (k === "5y" ? 5 : k === "10y" ? 10 : 20));
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const idx = bars.findIndex((b) => b.date >= cutoffStr);
      if (idx <= 0) return 0;
      return Math.round((idx / bars.length) * 100);
    },
    [bars]
  );
  const rangeStart = useMemo(() => rangeStartFor(range), [range, rangeStartFor]);

  const option = useMemo(
    // vRange 已移出 option：dataZoom 由 ECharts 自管，缩放不再重建 option（修复放大受限）
    () => buildOption(bars, BULL_BEAR_CYCLES, period, rangeStart, indicators, showSwing, showPct, pctPos, pctFont, null),
    [bars, period, rangeStart, indicators, showSwing, showPct, pctPos, pctFont]
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm">上证综指 · 牛熊全景 K 线（真实历史）</h3>
          <span className="text-[10px] text-muted hidden sm:inline">
            红实线=牛市启动 · 红虚线=牛市见顶 · 绿实线=熊市启动 · 绿虚线=熊市见底 · 紫=重大回调 · 实线标签=关键事件
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {([
              ["all", "全部"],
              ["20y", "近20年"],
              ["10y", "近10年"],
              ["5y", "近5年"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setRange(k);
                  // 快速定位：dispatchAction 设置 dataZoom（rangeStart 会在 option 重建后应用，
                  // 这里立即定位避免闪烁）；随后按新窗口更新涨跌幅标注
                  const chart = chartRef.current;
                  if (chart && k !== "all") {
                    const nextStart = rangeStartFor(k);
                    if (nextStart > 0) {
                      chart.dispatchAction({ type: "dataZoom", start: nextStart, end: 100 });
                      viewRef.current = [nextStart, 100];
                      syncPctSeries();
                    }
                  } else if (chart) {
                    chart.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
                    viewRef.current = null;
                    syncPctSeries();
                  }
                }}
                className={`px-2 py-1 ${range === k ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["day", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  viewRef.current = null;
                }}
                className={`px-2.5 py-1 ${period === p ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                {p === "day" ? "日K" : "月K"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 技术指标自由组合 */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[10px] text-muted shrink-0">技术指标：</span>
        {([
          ["ma", "MA"],
          ["macd", "MACD"],
          ["boll", "BOLL"],
          ["kdj", "KDJ"],
          ["rsi", "RSI"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => toggleIndicator(k)}
            className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
              indicators.includes(k)
                ? "bg-primary/15 text-primary border-primary/40 font-medium"
                : "border-border text-muted hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setShowSwing((v) => !v)}
          className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
            showSwing ? "bg-amber-500/15 text-amber-600 border-amber-500/40 font-medium" : "border-border text-muted hover:border-amber-500/40"
          }`}
        >
          {showSwing ? "峰谷幅度标注：开" : "峰谷幅度标注：关"}
        </button>
        <span className="w-px h-4 bg-border" />
        <button
          onClick={() => setShowPct((v) => !v)}
          className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
            showPct ? "bg-primary/15 text-primary border-primary/40 font-medium" : "border-border text-muted hover:border-primary/40"
          }`}
          title="逐根 K 线标注当日涨跌幅（涨红跌绿）"
        >
          {showPct ? "逐根涨跌幅：开" : "逐根涨跌幅：关"}
        </button>
        {showPct && (
          <>
            <button
              onClick={() => setPctPos((v) => (v === "top" ? "bottom" : "top"))}
              className="px-2 py-0.5 rounded text-[11px] border border-border text-muted hover:border-primary/40"
              title="切换标注位置（K 线上方/下方）"
            >
              {pctPos === "top" ? "位置：上方" : "位置：下方"}
            </button>
            <select
              value={pctFont}
              onChange={(e) => setPctFont(Number(e.target.value))}
              className="px-1 py-0.5 rounded text-[11px] border border-border bg-transparent text-muted"
              title="标注字号"
            >
              {[8, 9, 10, 11, 12].map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>
          </>
        )}
        <span className="text-[10px] text-muted">叠加主图：MA/BOLL/KDJ/RSI · 副图：MACD · 可多选组合</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> 牛市区间</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> 熊市区间</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block" /> 牛市重大回调(&gt;20%)</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> 关键事件触发</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 bg-primary/15 inline-block rounded-sm" /> 事件影响区间</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 bg-red-500 inline-block rounded-sm" /> +涨幅</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 bg-green-500 inline-block rounded-sm" /> -回调</span>
        <span className="text-muted/70">拖动/滚轮缩放 · 悬停看 OHLC 与事件 · 事件标注判定：政策发布/市场拐点日 → 最近交易日</span>
      </div>

      {/* 当日整体涨跌概况 */}
      <DailyMoveBadge bars={bars} name="上证综指" />

      {/* 高度随周期变化：月K 点少可更高，日K 固定 */}
      <AnnotatableChart
        option={option}
        height={period === "month" ? 440 : 480}
        storageKey="bullbear-kline-ann"
        snapBars={bars}
        onDataZoom={onZoom}
        chartRef={chartRef}
        hint="画线标注：选择工具后在图上拖拽创建；选择模式拖动端点编辑，Del/Backspace 或双击删除；样式面板可调颜色/线型/线宽；开启吸附后端点贴近 K 线最高/最低价；标注自动保存，刷新后恢复，可导出/导入 JSON。"
      />

      <p className="text-[10px] text-muted mt-2 leading-relaxed border-t border-border/60 pt-2">
        {EARLY_NOTE}；数据源：腾讯财经 fqkline 历史日线（8536 个交易日）；涨跌与区间标注基于各轮牛熊起止点收盘价计算。
      </p>
    </Card>
  );
}
