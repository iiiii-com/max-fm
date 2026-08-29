"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { sma, boll, macd, kdj, rsi, type OHLC } from "@/lib/data/indicators";

export interface LabBar extends OHLC {
  date: string;
  amount?: number;
}

export interface LabMark {
  index: number;
  type: "buy" | "sell";
  label: string; // 形态名/信号来源
}

const UP_C = "#d7000b"; // 涨=红（A股惯例）
const DOWN_C = "#0aa06e"; // 跌=绿

type SubIndicator = "none" | "macd" | "kdj" | "rsi";

/** 01 交互式 K 线实验台：多周期 + 指标叠加 + 历史回放 + 买卖点标注联动
 *  回放模式下指标只用「已显示数据」重算 —— 不窥视未来，符合教学正确性。
 */
export default function KlineLab({
  bars,
  symbol,
  period,
  marks,
  showMarks,
}: {
  bars: LabBar[];
  symbol: string;
  period: "day" | "week" | "month";
  marks: LabMark[];
  showMarks: boolean;
}) {
  const [showMA, setShowMA] = useState(true);
  const [showBOLL, setShowBOLL] = useState(false);
  const [sub, setSub] = useState<SubIndicator>("macd");

  // ---- 历史回放 ----
  const [replay, setReplay] = useState(false);
  const [replayIdx, setReplayIdx] = useState(bars.length);
  const [speed, setSpeed] = useState(200); // ms / 根
  const [startIdx, setStartIdx] = useState(0); // 回放起点（从当前可视区开始）

  useEffect(() => {
    setReplay(false);
    setReplayIdx(bars.length);
    setStartIdx(Math.max(0, bars.length - 120));
  }, [bars]);

  useEffect(() => {
    if (!replay) return;
    const t = setInterval(() => {
      setReplayIdx((i) => {
        if (i >= bars.length) {
          setReplay(false);
          return i;
        }
        return i + 1;
      });
    }, speed);
    return () => clearInterval(t);
  }, [replay, speed, bars.length]);

  const startReplay = () => {
    const from = Math.max(0, bars.length - 250);
    setStartIdx(from);
    setReplayIdx(from);
    setReplay(true);
  };

  const visible = useMemo(() => bars.slice(0, replayIdx), [bars, replayIdx]);
  const closes = useMemo(() => visible.map((b) => b.close), [visible]);
  const dates = useMemo(() => visible.map((b) => b.date.slice(5)), [visible]);

  // ---- 指标（在可见序列上计算：回放时 = 只用当时已知数据）----
  const ma5 = useMemo(() => (showMA ? sma(closes, 5) : null), [closes, showMA]);
  const ma10 = useMemo(() => (showMA ? sma(closes, 10) : null), [closes, showMA]);
  const ma20 = useMemo(() => (showMA ? sma(closes, 20) : null), [closes, showMA]);
  const ma60 = useMemo(() => (showMA ? sma(closes, 60) : null), [closes, showMA]);
  const bl = useMemo(() => (showBOLL ? boll(closes) : null), [closes, showBOLL]);
  const macdRes = useMemo(() => (sub === "macd" ? macd(closes) : null), [closes, sub]);
  const kdjRes = useMemo(() => (sub === "kdj" ? kdj(visible) : null), [visible, sub]);
  const rsiRes = useMemo(() => (sub === "rsi" ? rsi(closes, 14) : null), [closes, sub]);

  const option = useMemo<EChartsOption>(() => {
    if (!visible.length) return {};
    const last = visible[visible.length - 1];
    const prev = visible[visible.length - 2] ?? last;
    const pct = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
    const hasSub = sub !== "none";

    const markPts = showMarks
      ? marks
          .filter((m) => m.index < replayIdx)
          .map((m) => ({
            coord: [dates[m.index], visible[m.index]?.low ?? visible[visible.length - 1].low],
            symbol: m.type === "buy" ? "triangle" : "pin",
            symbolSize: m.type === "buy" ? 10 : 12,
            symbolRotate: m.type === "buy" ? 0 : 180,
            itemStyle: { color: m.type === "buy" ? "#16a34a" : UP_C },
            label: { show: m.type === "sell", formatter: m.label, fontSize: 9, position: "top", color: "#d7000b" },
          }))
      : [];

    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params: any) => {
          const i = Array.isArray(params) ? params[0]?.dataIndex : params?.dataIndex;
          if (i == null || !visible[i]) return "";
          const b = visible[i];
          const p = i > 0 ? visible[i - 1] : b;
          const ch = p.close ? ((b.close - p.close) / p.close) * 100 : 0;
          return `<b>${b.date}</b><br/>开 ${b.open.toFixed(2)}　高 ${b.high.toFixed(2)}<br/>低 ${b.low.toFixed(2)}　收 <b style="color:${ch >= 0 ? UP_C : DOWN_C}">${b.close.toFixed(2)}（${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%）</b><br/>量 ${(b.volume / 1e4).toFixed(0)}万手`;
        },
      },
      legend: { top: 0, textStyle: { fontSize: 10 }, data: [...(showMA ? ["MA5", "MA10", "MA20", "MA60"] : []), ...(showBOLL ? ["BOLL"] : []), ...(sub !== "none" ? [sub.toUpperCase()] : [])] },
      grid: [
        { left: 56, right: 16, top: 26, height: 250 },
        { left: 56, right: 16, top: 288, height: 56 },
        ...(hasSub ? [{ left: 56, right: 16, top: 356, height: 90 }] : []),
      ],
      xAxis: [
        { type: "category", data: dates, gridIndex: 0, axisLabel: { show: false }, boundaryGap: true },
        { type: "category", data: dates, gridIndex: 1, axisLabel: { show: false }, boundaryGap: true },
        ...(hasSub ? [{ type: "category" as const, data: dates, gridIndex: 2, axisLabel: { fontSize: 9 }, boundaryGap: true }] : []),
      ],
      yAxis: [
        { scale: true, gridIndex: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.12)" } } },
        { gridIndex: 1, axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 1e4).toFixed(0)}万` }, splitLine: { show: false } },
        ...(hasSub ? [{ gridIndex: 2, scale: true, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.1)" } } }] : []),
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1, ...(hasSub ? [2] : [])], start: Math.max(0, 100 - (130 / Math.max(1, visible.length)) * 100), end: 100 },
        { type: "slider", xAxisIndex: [0, 1, ...(hasSub ? [2] : [])], bottom: 2, height: 14, borderColor: "rgba(128,128,128,0.2)" },
      ],
      series: [
        {
          name: symbol,
          type: "candlestick",
          data: visible.map((b) => [b.open, b.close, b.low, b.high]),
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: { color: UP_C, color0: DOWN_C, borderColor: UP_C, borderColor0: DOWN_C },
          markPoint: markPts.length ? { data: markPts, animation: false } : undefined,
        },
        {
          name: "成交量",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: visible.map((b) => ({ value: b.volume, itemStyle: { color: b.close >= b.open ? "rgba(215,0,11,0.55)" : "rgba(10,160,110,0.55)" } })),
        },
        ...(showMA
          ? ([
              { name: "MA5", type: "line", data: ma5, symbol: "none", lineStyle: { width: 1, color: "#f59e0b" } },
              { name: "MA10", type: "line", data: ma10, symbol: "none", lineStyle: { width: 1, color: "#3b82f6" } },
              { name: "MA20", type: "line", data: ma20, symbol: "none", lineStyle: { width: 1, color: "#8b5cf6" } },
              { name: "MA60", type: "line", data: ma60, symbol: "none", lineStyle: { width: 1.2, color: "#64748b" } },
            ] as any[])
          : []),
        ...(showBOLL
          ? ([
              { name: "BOLL上轨", type: "line", data: bl!.upper, symbol: "none", lineStyle: { width: 1, color: "rgba(128,128,128,0.5)" } },
              { name: "BOLL中轨", type: "line", data: bl!.mid, symbol: "none", lineStyle: { width: 1, color: "#f59e0b", type: "dashed" } },
              { name: "BOLL下轨", type: "line", data: bl!.lower, symbol: "none", lineStyle: { width: 1, color: "rgba(128,128,128,0.5)" } },
            ] as any[])
          : []),
        ...(macdRes
          ? ([
              { name: "MACD", type: "bar", xAxisIndex: 2, yAxisIndex: 2, data: macdRes.hist.map((h) => ({ value: h, itemStyle: { color: (h ?? 0) >= 0 ? UP_C : DOWN_C } })) },
              { name: "DIF", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: macdRes.dif, symbol: "none", lineStyle: { width: 1, color: "#f59e0b" } },
              { name: "DEA", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: macdRes.dea, symbol: "none", lineStyle: { width: 1, color: "#3b82f6" } },
            ] as any[])
          : []),
        ...(kdjRes
          ? ([
              { name: "KDJ", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: kdjRes.k, symbol: "none", lineStyle: { width: 1, color: "#f59e0b" } },
              { name: "D", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: kdjRes.d, symbol: "none", lineStyle: { width: 1, color: "#3b82f6" } },
              { name: "J", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: kdjRes.j, symbol: "none", lineStyle: { width: 1, color: "#8b5cf6" } },
            ] as any[])
          : []),
        ...(rsiRes
          ? ([{ name: "RSI(14)", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: rsiRes, symbol: "none", lineStyle: { width: 1.2, color: "#f59e0b" }, markLine: { silent: true, data: [{ yAxis: 70, lineStyle: { color: "rgba(215,0,11,0.3)", type: "dashed" } }, { yAxis: 30, lineStyle: { color: "rgba(10,160,110,0.3)", type: "dashed" } }] } }] as any[])
          : []),
      ],
      graphic: replay
        ? [
            {
              type: "text",
              left: "center",
              top: 40,
              style: { text: `回放中 · ${visible[visible.length - 1]?.date ?? ""}　${last.close.toFixed(2)}（${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%）`, fontSize: 14, fontWeight: 700, fill: pct >= 0 ? UP_C : DOWN_C },
            },
          ]
        : undefined,
    };
  }, [visible, dates, sub, showMA, showBOLL, showMarks, marks, replayIdx, symbol, ma5, ma10, ma20, ma60, bl, macdRes, kdjRes, rsiRes, replay]);

  if (!bars.length) {
    return <div className="flex items-center justify-center h-[300px] text-sm text-muted">K 线数据加载中…</div>;
  }

  const btn = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs transition-colors duration-150 ${active ? "bg-primary text-white" : "text-muted hover:text-foreground hover:bg-border/60"}`;

  return (
    <div>
      {/* 控制条：叠加指标 + 副图 + 回放 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-muted mr-1">主图：</span>
          <button className={btn(showMA)} onClick={() => setShowMA(!showMA)} aria-pressed={showMA}>均线 MA</button>
          <button className={btn(showBOLL)} onClick={() => setShowBOLL(!showBOLL)} aria-pressed={showBOLL}>BOLL</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted mr-1">副图：</span>
          {(["macd", "kdj", "rsi", "none"] as SubIndicator[]).map((s) => (
            <button key={s} className={btn(sub === s)} onClick={() => setSub(s)} aria-pressed={sub === s}>
              {s === "none" ? "无" : s.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => (replay ? setReplay(false) : startReplay())}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-border hover:border-primary/50 hover:text-primary transition-colors"
          >
            {replay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {replay ? "暂停" : "历史回放"}
          </button>
          {replay && (
            <>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="px-1.5 py-1 rounded-md border border-border bg-card text-xs"
                aria-label="回放速度"
              >
                <option value={500}>0.5×慢</option>
                <option value={200}>1×</option>
                <option value={80}>2.5×快</option>
              </select>
              <span className="text-muted font-mono tabular-nums">{replayIdx - startIdx}/{bars.length - startIdx}根</span>
              <button
                onClick={() => {
                  setReplay(false);
                  setReplayIdx(bars.length);
                }}
                className="p-1 rounded-md text-muted hover:text-primary"
                aria-label="退出回放"
                title="退出回放，显示全部"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <EChart option={option} height={sub === "none" ? 380 : 480} />

      {/* 回放进度条 */}
      {replay && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={startIdx}
            max={bars.length}
            value={replayIdx}
            onChange={(e) => setReplayIdx(Number(e.target.value))}
            className="flex-1 accent-[var(--primary)]"
            aria-label="回放进度"
          />
          <span className="text-[11px] text-muted font-mono">{bars[Math.min(replayIdx, bars.length) - 1]?.date ?? ""}</span>
        </div>
      )}
    </div>
  );
}
