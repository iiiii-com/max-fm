"use client";

import { useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { sma } from "@/lib/data/indicators";
import { scanSignals, type ScanBar } from "@/lib/data/rule-engine";

/**
 * 买卖点扫描器：真实行情 + 规则引擎（判断标准 + 经典形态）
 * K 线图标记信号 + 右侧信号列表（命中依据、强度）。
 */
export default function BuySellScanner({ bars, height = 360 }: { bars: ScanBar[]; height?: number }) {
  const [hoverSignal, setHoverSignal] = useState<string | null>(null);

  const signals = useMemo(() => scanSignals(bars), [bars]);

  const option = useMemo<EChartsOption>(() => {
    const dates = bars.map((b) => b.date);
    const closes = bars.map((b) => b.close);
    const ma20 = sma(closes, 20);
    return {
      animation: false,
      tooltip: {
        trigger: "axis", axisPointer: { type: "cross" },
        backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const b = bars[i];
          if (!b) return "";
          return `<b>${b.date}</b><br/>开 ${b.open} 收 ${b.close}<br/>高 ${b.high} 低 ${b.low}`;
        },
      },
      legend: { top: 2, right: 6, textStyle: { fontSize: 11 }, data: ["K线", "MA20", "买卖信号"] },
      grid: { left: 52, right: 16, top: 34, bottom: 28 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 10 } },
      yAxis: { scale: true, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#eef0ec" } } },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 14, bottom: 2, start: 0, end: 100 },
      ],
      series: [
        {
          name: "K线", type: "candlestick",
          data: bars.map((b) => [b.open, b.close, b.low, b.high]),
          itemStyle: { color: "#d7000b", color0: "#0aa06e", borderColor: "#d7000b", borderColor0: "#0aa06e" },
        },
        { name: "MA20", type: "line", data: ma20, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#3b82f6" } },
        {
          name: "买卖信号", type: "scatter",
          data: signals.map((s) => {
            const b = bars.find((x) => x.date === s.date);
            const isHover = hoverSignal === s.date + s.type;
            return {
              value: [s.date, b ? (s.type === "buy" ? b.low * 0.99 : b.high * 1.01) : 0],
              label: {
                show: isHover, formatter: s.type === "buy" ? "▲买" : "▼卖", position: s.type === "buy" ? "bottom" : "top",
                fontSize: 10, fontWeight: 800, color: s.type === "buy" ? "#d7000b" : "#0aa06e",
              },
              itemStyle: { color: s.type === "buy" ? "#d7000b" : "#0aa06e", borderColor: "#fff", borderWidth: 1.5 },
            };
          }),
          symbol: s2 => (s2[0] === "buy" ? "triangle" : "pin"),
          symbolSize: s2 => (s2[0] === "buy" ? 14 : 26),
          z: 8,
        },
      ],
    };
  }, [bars, signals, hoverSignal]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm font-bold">买卖点扫描 · 规则引擎（判断标准 + 经典形态）</p>
        <span className="text-[11px] text-muted">命中 {signals.length} 个信号 · 悬停 K 线看信号依据</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-3">
        <EChart option={option} height={height} />
        {/* 信号列表 */}
        <div className="border border-border rounded-lg overflow-y-auto max-h-[360px]">
          {signals.length === 0 ? (
            <p className="text-xs text-muted p-3">样本区间内未扫描到信号（可导入更多数据）</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {[...signals].reverse().map((s) => (
                <li key={s.date + s.type}
                  onMouseEnter={() => setHoverSignal(s.date + s.type)}
                  onMouseLeave={() => setHoverSignal(null)}
                  className={`px-2.5 py-2 cursor-default ${hoverSignal === s.date + s.type ? "bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.type === "buy" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                      {s.type === "buy" ? "买" : "卖"}
                    </span>
                    <span className="text-[11px] font-mono text-muted">{s.date}</span>
                    <span className="ml-auto text-[10px] text-muted">{s.strength === 3 ? "强" : s.strength === 2 ? "中" : "弱"}</span>
                  </div>
                  <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{s.rule}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted mt-2 leading-relaxed">
        规则：MA 金叉/死叉 · RSI 超买超卖 · MACD 金叉死叉 · 放量突破 20 日高点 · 缩量回踩 MA20——对应环节 7「技术确认」判断标准，信号标注命中依据，供决策委员会环节 10 汇总。
      </p>
    </div>
  );
}
