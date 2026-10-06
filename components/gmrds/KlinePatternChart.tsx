"use client";

import { useMemo, useRef } from "react";
import { usePctPrefs } from "@/components/charts/pct-prefs";
import EChart from "@/components/charts/EChart";
import { KlineDetailPanel, useKlineClickDetail } from "@/components/charts/KlineDetail";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { mkPctSeries } from "@/lib/data/kline-tooltip";
import { mkDayAxisLabel } from "@/lib/data/axis";

export interface KlinePoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface PatternMark {
  date: string;
  label: string;
  type: "buy" | "sell" | "hold";
}

/**
 * K 线形态与买卖点识别（真实数据）
 * 蜡烛 + 均线 + markPoint 买卖点标注，演示「技术确认」环节实操。
 */
export default function KlinePatternChart({
  bars,
  marks,
  title,
  caption,
  height = 380,
}: {
  bars: KlinePoint[];
  marks: PatternMark[];
  title?: string;
  caption?: string;
  height?: number;
}) {
  const [selected, clearSelected, attachChart] = useKlineClickDetail(bars);
  // 每日涨跌幅标注：此前写死 show:true，用户无法关闭
  const { pct: pctCfg, pctToggle } = usePctPrefs();
  const option = useMemo<EChartsOption>(() => {
    const dates = bars.map((b) => b.date);
    const closes = bars.map((b) => b.close);
    const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
    const ma = (n: number) =>
      closes.map((_, i) => (i < n - 1 ? null : closes.slice(i - n + 1, i + 1).reduce((a, c) => a + c, 0) / n));

    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#e2e0dc",
        textStyle: { color: "#e2e0dc", fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const b = bars[i];
          if (!b) return "";
          const prev = i > 0 ? bars[i - 1].close : b.open;
          const pct = prev ? ((b.close - prev) / prev) * 100 : 0;
          const col = b.close >= prev ? "#c0392b" : "#1e8449";
          return `<b>${b.date}</b>  <span style="color:${col}">${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</span><br/>开 ${b.open}　收 ${b.close}<br/>高 ${b.high}　低 ${b.low}`;
        },
      },
      legend: {
        top: 4,
        right: 8,
        textStyle: { fontSize: 11 },
        data: ["K线", "MA20", "MA60", "买卖点"],
      },
      grid: { left: 52, right: 16, top: 40, bottom: 56 },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: mkDayAxisLabel(dates[dates.length - 1], { fontSize: 10 }),
        axisTick: { show: false },
      },
      yAxis: {
        scale: true,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: "#f4f3f0" } },
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 14, bottom: 4, start: 0, end: 100 },
      ],
      series: [
        {
          name: "K线",
          type: "candlestick",
          data: ohlc,
          itemStyle: { color: "#c0392b", color0: "#1e8449", borderColor: "#c0392b", borderColor0: "#1e8449" },
        },
        mkPctSeries({ bars, show: pctCfg.show, position: pctCfg.position, fontSize: pctCfg.fontSize, maxVisible: 60, keep: 60 }),
        { name: "MA20", type: "line", data: ma(20), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#1d4ed8" } },
        { name: "MA60", type: "line", data: ma(60), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#7c3aed" } },
        {
          name: "买卖点",
          type: "scatter",
          data: marks.map((m) => {
            const b = bars.find((x) => x.date === m.date);
            return {
              value: [m.date, b ? b.high * 1.01 : 0],
              label: { show: true, formatter: m.label, position: "top", fontSize: 10, fontWeight: 700, color: m.type === "buy" ? "#c0392b" : m.type === "sell" ? "#1e8449" : "#b45309" },
              itemStyle: {
                color: m.type === "buy" ? "#c0392b" : m.type === "sell" ? "#1e8449" : "#b45309",
                borderColor: "#fff", borderWidth: 1.5,
              },
            };
          }),
          symbol: "pin",
          symbolSize: 34,
          z: 8,
        },
      ],
    };
  }, [bars, marks, pctCfg]);

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      {title && <p className="text-sm font-bold mb-1">{title}</p>}
      <div className="mb-2">{pctToggle}</div>
      <div className="relative">
        <EChart option={option} height={height} onReady={attachChart} />
        {selected && (
          <div className="absolute left-2 top-2 z-10">
            <KlineDetailPanel
              bar={selected}
              prev={(() => {
                const i = bars.findIndex((b) => b.date === selected.date);
                return i > 0 ? bars[i - 1] : null;
              })()}
              onClose={clearSelected}
            />
          </div>
        )}
      </div>
      {caption && <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">{caption}</figcaption>}
    </figure>
  );
}
