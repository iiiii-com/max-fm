"use client";

import { useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import VizBoundary from "@/components/gmrds/VizBoundary";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { sma } from "@/lib/data/indicators";
import { mkDayAxisLabel } from "@/lib/data/axis";
import usMarket from "@/data/us-market.json";

/**
 * 美股日线 K 线（22 年真实历史 · 可切区间）
 *
 * 为什么新增：站内原有 UsMarketKline 是"年度视角"，每年一根 K 线，
 * 且年度量能用高低值占位，无法做日线级形态与指标分析。
 * 本组件直接消费 data/us-market.json 的 daily 序列（5540 根，2004-09-27 起），
 * 提供 1/3/5/10 年与全部切换，让 2008 崩盘、2020 熔断、2022 加息熊市
 * 等日线级形态都能被看到。
 *
 * 数据源：腾讯财经 usfqkline 复权日线，与 A 股 sh-index 同口径。
 */

type UsKey = "spx" | "ndx";

interface Source {
  name: string;
  code: string;
  daily: Array<{
    date: string;
    open: number | null;
    close: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
  }>;
}

const META: Record<UsKey, { label: string; desc: string }> = {
  spx: { label: "标普 500", desc: "美国大盘蓝筹，覆盖约 80% 美股市值" },
  ndx: { label: "纳斯达克 100", desc: "科技成长股代表，含 FAANG 等权重股" },
};

const RANGES = [
  { key: "1y", label: "1 年", years: 1 },
  { key: "3y", label: "3 年", years: 3 },
  { key: "5y", label: "5 年", years: 5 },
  { key: "10y", label: "10 年", years: 10 },
  { key: "20y", label: "20 年", years: 20 },
  { key: "all", label: "全部", years: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/** 关键拐点（真实事件锚点，落在对应年份内） */
const PIVOTS: Record<UsKey, Array<{ date: string; label: string; type: "buy" | "sell" | "hold" }>> = {
  spx: [
    { date: "2008-10-10", label: "雷曼 · 全球流动性危机", type: "sell" },
    { date: "2009-03-09", label: "QE1 触底反弹", type: "buy" },
    { date: "2020-03-23", label: "疫情熔断底", type: "buy" },
    { date: "2022-10-12", label: "激进加息 · 阶段底", type: "buy" },
    { date: "2025-04-08", label: "关税冲击低点", type: "hold" },
  ],
  ndx: [
    { date: "2008-10-10", label: "雷曼 · 科技股同步", type: "sell" },
    { date: "2009-03-09", label: "QE1 触底反弹", type: "buy" },
    { date: "2020-03-23", label: "疫情熔断底", type: "buy" },
    { date: "2022-10-12", label: "加息熊市底", type: "buy" },
    { date: "2025-04-08", label: "关税冲击低点", type: "hold" },
  ],
};

export default function UsDailyKline() {
  const [idx, setIdx] = useState<UsKey>("spx");
  const [range, setRange] = useState<RangeKey>("10y");
  const [withMa, setWithMa] = useState(true);

  const all = useMemo(() => {
    const src = (usMarket as unknown as Record<UsKey, Source>)[idx];
    return src.daily.filter(
      (b): b is { date: string; open: number; close: number; high: number; low: number; volume: number } =>
        b.close != null && b.open != null && b.high != null && b.low != null
    );
  }, [idx]);

  const bars = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (r.years === 0) return all;
    const last = new Date(all[all.length - 1].date);
    last.setFullYear(last.getFullYear() - r.years);
    const iso = last.toISOString().slice(0, 10);
    return all.filter((b) => b.date >= iso);
  }, [all, range]);

  const option = useMemo<EChartsOption>(() => {
    const dates = bars.map((b) => b.date);
    // ECharts candlestick 口径：[open, close, low, high]
    const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
    const closes = bars.map((b) => b.close);
    const vols = bars.map((b, i) => [i, b.volume]);
    const ma = withMa ? sma(closes, 20) : null;

    const series: any[] = [
      {
        name: "K线",
        type: "candlestick",
        data: ohlc,
        itemStyle: {
          color: "#c0392b", // 阳线（涨）中国习惯用红
          color0: "#1e8449", // 阴线（跌）用绿
          borderColor: "#c0392b",
          borderColor0: "#1e8449",
        },
      },
    ];
    if (ma) {
      series.push({
        name: "MA20",
        type: "line",
        data: ma,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, color: "#d97706" },
      });
    }
    series.push({
      name: "成交量",
      type: "bar",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: vols,
      itemStyle: { color: "rgba(120,120,120,0.45)" },
    });

    return {
      animation: false,
      grid: [
        { left: 58, right: 14, top: 28, height: "62%" },
        { left: 58, right: 14, top: "76%", height: "12%" },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
      },
      legend: {
        data: series.map((s) => s.name),
        top: 0,
        textStyle: { fontSize: 10 },
        itemHeight: 8,
        itemWidth: 14,
      },
      xAxis: [
        {
          type: "category",
          data: dates,
          scale: true,
          axisLine: { lineStyle: { color: "#c9c5bd" } },
          axisLabel: mkDayAxisLabel(dates[dates.length - 1], { fontSize: 9 }),
          splitLine: { show: false },
        },
        {
          type: "category",
          gridIndex: 1,
          data: dates,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          axisLabel: { fontSize: 9 },
          splitLine: { lineStyle: { color: "#e8e5e0", type: "dashed" } },
        },
        {
          gridIndex: 1,
          axisLabel: { fontSize: 8, formatter: (v: number) => compact(v) },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1], start: Math.max(0, 100 - (120 / Math.max(bars.length, 1)) * 100), end: 100 },
        {
          type: "slider",
          xAxisIndex: [0, 1],
          height: 16,
          bottom: 0,
          start: Math.max(0, 100 - (120 / Math.max(bars.length, 1)) * 100),
          end: 100,
        },
      ],
      series,
    } as EChartsOption;
  }, [bars, withMa]);

  const spanYears = bars.length
    ? ((new Date(bars[bars.length - 1].date).getTime() - new Date(bars[0].date).getTime()) / 86400000 / 365.25).toFixed(1)
    : "0";
  const inRange = bars.length
    ? PIVOTS[idx].filter((p) => p.date >= bars[0].date && p.date <= bars[bars.length - 1].date)
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        {(Object.keys(META) as UsKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setIdx(k)}
            aria-pressed={idx === k}
            title={META[k].desc}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
              idx === k
                ? "bg-primary text-white border-primary"
                : "border-border text-muted hover:text-foreground hover:border-primary/40"
            }`}
          >
            {META[k].label}
          </button>
        ))}

        <span className="w-px h-4 bg-border mx-1" />

        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            aria-pressed={range === r.key}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
              range === r.key
                ? "bg-primary text-white border-primary"
                : "border-border text-muted hover:text-foreground hover:border-primary/40"
            }`}
          >
            {r.label}
          </button>
        ))}

        <button
          onClick={() => setWithMa((v) => !v)}
          aria-pressed={withMa}
          className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
            withMa
              ? "bg-primary/10 text-primary border-primary/40"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          MA20
        </button>

        <span className="text-[10px] text-muted ml-auto tabular-nums">
          {bars.length} 根 · {bars.length ? `${bars[0].date} ~ ${bars[bars.length - 1].date}` : "无数据"} · 约 {spanYears} 年
        </span>
      </div>

      <VizBoundary name="美股日线K线">
        <EChart option={option} height={420} />
      </VizBoundary>

      <p className="text-[10px] text-muted mt-2 leading-relaxed">
        数据源：腾讯财经 usfqkline 复权日线，与站内 A 股 sh-index 同口径；区间内可见拐点{" "}
        {inRange.length ? inRange.map((p) => `${p.date} ${p.label}`).join("；") : "无预设拐点（切到 20 年或全部可见 2008 与 2020）"}。
        拖动下方滑块可局部放大。历史表现不代表未来收益，不构成投资建议。
      </p>
    </div>
  );
}

function compact(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
}