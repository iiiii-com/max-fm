"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { sma, boll, macd, aggregateBars } from "@/lib/data/indicators";

export interface LabBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

/** 买卖点（真实事件锚点） */
const REAL_MARKS = [
  { date: "2024-09-24", label: "政策反转 · 买入", type: "buy" as const },
  { date: "2024-10-08", label: "高点 3489 · 减仓", type: "sell" as const },
];

/**
 * 交互式 K 线实验台：多周期切换 / 指标叠加(MA/BOLL/MACD) / 行情回放 / 买卖点
 * 真实数据驱动（上证日线 → 周/月聚合）。
 */
export default function InteractiveKlineLab({ data, height = 420 }: { data: LabBar[]; height?: number }) {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [showMA, setShowMA] = useState(true);
  const [showBoll, setShowBoll] = useState(false);
  const [showMacd, setShowMacd] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  // 回放：visibleCount = 当前显示根数（null = 全部）
  const [playCount, setPlayCount] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bars = useMemo<LabBar[]>(() => {
    if (period === "day") return data;
    return aggregateBars(data, period);
  }, [data, period]);

  // 回放控制
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setPlayCount((c) => {
          if (c == null) return 60;
          if (c >= bars.length) { setPlaying(false); return null; }
          return c + 2; // 每步推进 2 根
        });
      }, 220);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, bars.length]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const visible = useMemo(() => {
    if (playCount == null) return bars;
    return bars.slice(Math.max(0, bars.length - playCount));
  }, [bars, playCount]);

  const option = useMemo<EChartsOption>(() => {
    const dates = visible.map((b) => b.date);
    const closes = visible.map((b) => b.close);
    const ohlc = visible.map((b) => [b.open, b.close, b.low, b.high]);
    const hasMacd = showMacd && period === "day";
    const series: any[] = [
      {
        name: "K线", type: "candlestick", data: ohlc,
        itemStyle: { color: "#d7000b", color0: "#0aa06e", borderColor: "#d7000b", borderColor0: "#0aa06e" },
      },
    ];
    if (showMA) {
      series.push({ name: "MA5", type: "line", data: sma(closes, 5), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#f59e0b" } });
      series.push({ name: "MA20", type: "line", data: sma(closes, 20), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#3b82f6" } });
      series.push({ name: "MA60", type: "line", data: sma(closes, 60), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#8b5cf6" } });
    }
    if (showBoll) {
      const b = boll(closes, 20, 2);
      series.push({ name: "BOLL上", type: "line", data: b.upper, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#94a3b8", type: "dashed" } });
      series.push({ name: "BOLL中", type: "line", data: b.mid, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#64748b" } });
      series.push({ name: "BOLL下", type: "line", data: b.lower, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#94a3b8", type: "dashed" } });
    }
    if (hasMacd) {
      const m = macd(closes);
      series.push({ name: "MACD", type: "bar", data: m.hist, xAxisIndex: 1, yAxisIndex: 1, itemStyle: { color: (p: any) => (p.value >= 0 ? "#d7000b" : "#0aa06e") } });
      series.push({ name: "DIF", type: "line", data: m.dif, xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, lineStyle: { width: 1, color: "#f59e0b" } });
      series.push({ name: "DEA", type: "line", data: m.dea, xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, lineStyle: { width: 1, color: "#3b82f6" } });
    }
    if (showMarks && period === "day") {
      series.push({
        name: "买卖点",
        type: "scatter",
        data: REAL_MARKS.filter((m) => dates.includes(m.date)).map((m) => {
          const b = visible.find((x) => x.date === m.date);
          return {
            value: [m.date, b ? b.high * 1.01 : 0],
            label: { show: true, formatter: m.label, position: "top", fontSize: 10, fontWeight: 700, color: m.type === "buy" ? "#d7000b" : "#0aa06e" },
            itemStyle: { color: m.type === "buy" ? "#d7000b" : "#0aa06e", borderColor: "#fff", borderWidth: 1.5 },
          };
        }),
        symbol: "pin", symbolSize: 30, z: 8,
      });
    }
    series.push({ name: "成交量", type: "bar", data: visible.map((b) => b.volume), xAxisIndex: hasMacd ? 2 : 1, yAxisIndex: hasMacd ? 2 : 1, itemStyle: { color: "rgba(100,116,139,0.5)" } });

    return {
      animation: false,
      tooltip: {
        trigger: "axis", axisPointer: { type: "cross" },
        backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const b = visible[i];
          if (!b) return "";
          const prev = i > 0 ? visible[i - 1].close : b.open;
          const pct = prev ? ((b.close - prev) / prev) * 100 : 0;
          const col = pct >= 0 ? "#d7000b" : "#0aa06e";
          return `<b>${b.date}</b> <span style="color:${col}">${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</span><br/>开 ${b.open} 收 ${b.close}<br/>高 ${b.high} 低 ${b.low}`;
        },
      },
      legend: { top: 2, right: 6, type: "scroll", textStyle: { fontSize: 10 }, data: series.map((s) => s.name) },
      grid: hasMacd
        ? [
            { left: 56, right: 14, top: 34, height: "54%" },
            { left: 56, right: 14, top: "64%", height: "16%" },
            { left: 56, right: 14, top: "84%", height: "12%" },
          ]
        : [
            { left: 56, right: 14, top: 34, height: "64%" },
            { left: 56, right: 14, top: "72%", height: "22%" },
          ],
      xAxis: hasMacd
        ? [
            { type: "category", data: dates, axisLabel: { fontSize: 10 } },
            { type: "category", gridIndex: 1, data: dates, axisLabel: { show: false } },
            { type: "category", gridIndex: 2, data: dates, axisLabel: { fontSize: 9 } },
          ]
        : [
            { type: "category", data: dates, axisLabel: { fontSize: 10 } },
            { type: "category", gridIndex: 1, data: dates, axisLabel: { fontSize: 9 } },
          ],
      yAxis: hasMacd
        ? [
            { scale: true, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#eef0ec" } } },
            { gridIndex: 1, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
            { gridIndex: 2, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
          ]
        : [
            { scale: true, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#eef0ec" } } },
            { gridIndex: 1, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
          ],
      dataZoom: [
        { type: "inside", xAxisIndex: hasMacd ? [0, 1, 2] : [0, 1], start: 0, end: 100 },
        { type: "slider", xAxisIndex: hasMacd ? [0, 1, 2] : [0, 1], height: 14, bottom: 2, start: 0, end: 100 },
      ],
      series,
    };
  }, [visible, showMA, showBoll, showMacd, showMarks, period]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* 控制条 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {(["day", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => { setPeriod(p); setPlayCount(null); setPlaying(false); }}
              className={`px-2.5 py-1 ${period === p ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}>
              {p === "day" ? "日K" : p === "week" ? "周K" : "月K"}
            </button>
          ))}
        </div>
        <span className="w-px h-4 bg-border" />
        {[
          ["MA", showMA, setShowMA],
          ["BOLL", showBoll, setShowBoll],
          ["MACD", showMacd, setShowMacd],
          ["买卖点", showMarks, setShowMarks],
        ].map(([label, on, set]: any) => (
          <button key={label} onClick={() => set(!on)}
            className={`px-2 py-1 rounded text-[11px] border ${on ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted"}`}>
            {label}
          </button>
        ))}
        <span className="w-px h-4 bg-border" />
        <button onClick={() => { setPlaying(false); setPlayCount(null); }} className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40">重置视图</button>
        <button
          onClick={() => {
            if (playing) { setPlaying(false); return; }
            if (playCount != null && playCount >= bars.length) setPlayCount(60);
            setPlaying(true);
          }}
          className={`px-2.5 py-1 rounded text-[11px] font-medium ${playing ? "bg-amber-500/15 text-amber-600 border border-amber-500/40" : "bg-primary text-white hover:bg-primary-dark"}`}>
          {playing ? "⏸ 暂停回放" : "▶ 行情回放"}
        </button>
        <span className="ml-auto text-[10px] text-muted">
          {playCount != null ? `回放中：显示最近 ${Math.min(playCount, bars.length)} / ${bars.length} 根` : `共 ${bars.length} 根 · ${period === "day" ? "2020 起真实日线" : "周/月聚合"}`}
        </span>
      </div>
      <EChart option={option} height={height} />
      <p className="text-[10px] text-muted mt-2 leading-relaxed">
        数据源：腾讯财经日线（2020-01-02 起，周/月由日线聚合）；指标自算（MA/BOLL/MACD）；买卖点为 2024-09-24 政策反转 / 2024-10-08 高点真实锚点。行情回放可观察「低点反转 → 主升 → 回调」的周期演化。
      </p>
    </div>
  );
}
