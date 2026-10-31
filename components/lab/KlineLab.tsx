"use client";

/* ============================================================
   01 交互式 K 线实验台
   - 主图：蜡烛 + MA(5/10/20/60) + BOLL 叠加
   - 副图：MACD / KDJ / RSI / 无
   - 历史回放：只用「已显示数据」计算指标（不窥视未来）
   - 买卖点标注来自 02/05 联动
   - 本轮增强：缩放记忆 / 快捷区间 / 区间统计 / 指标读数 /
     悬浮十字光标带指标值 / 单根涨跌幅开关 / 导出 PNG / 回放单步 /
     加载骨架与错误重试
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePctPrefs } from "@/components/charts/pct-prefs";
import { Camera, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import EChart from "@/components/charts/EChart";
import { KlineDetailPanel, useKlineClickDetail } from "@/components/charts/KlineDetail";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { sma, boll, macd, kdj, rsi, type OHLC } from "@/lib/data/indicators";
import { mkPctSeries } from "@/lib/data/kline-tooltip";
import { mkDayAxisLabel } from "@/lib/data/axis";

export interface LabBar extends OHLC {
  date: string;
  amount?: number;
}

export interface LabMark {
  index: number;
  type: "buy" | "sell";
  label: string; // 形态名/信号来源
}

const UP_C = "#c0392b"; // 涨=红（A股惯例）
const DOWN_C = "#1e8449"; // 跌=绿

type SubIndicator = "none" | "macd" | "kdj" | "rsi";

/** 主图默认展示最近多少根（与快捷区间解耦，用户缩放后不再被数据刷新重置） */
const DEFAULT_WINDOW = 130;

interface KlineLabProps {
  bars: LabBar[];
  symbol: string;
  period: "day" | "week" | "month";
  marks: LabMark[];
  showMarks: boolean;
  /** 数据加载中（显示骨架，而不是「加载中」一行字） */
  loading?: boolean;
  /** 加载失败时的重试入口 */
  onRetry?: () => void;
}

export default function KlineLab({ bars, symbol, period, marks, showMarks, loading = false, onRetry }: KlineLabProps) {
  const [showMA, setShowMA] = useState(true);
  const [showBOLL, setShowBOLL] = useState(false);
  const [sub, setSub] = useState<SubIndicator>("macd");
  // 每日涨跌幅标注：可在设置里关闭（长周期下会糊成一片）
  const { pct: pctCfg, pctToggle } = usePctPrefs();

  // ---- 历史回放 ----
  const [replay, setReplay] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayIdx, setReplayIdx] = useState(bars.length);
  const [speed, setSpeed] = useState(200); // ms / 根
  const [startIdx, setStartIdx] = useState(0); // 回放起点（从当前可视区开始）

  // ---- 缩放（按 标的+周期 记忆，数据刷新不重置）----
  const zoomRef = useRef<{ start: number; end: number } | null>(null);
  const zoomKeyRef = useRef("");
  const [zoomHint, setZoomHint] = useState<string>("");
  const chartRef = useRef<echarts.ECharts | null>(null);
  const key = `${symbol}|${period}`;

  useEffect(() => {
    if (zoomKeyRef.current !== key) {
      zoomKeyRef.current = key;
      zoomRef.current = null;
      setZoomHint("");
    }
    setReplay(false);
    setReplayPlaying(false);
    setReplayIdx(bars.length);
    setStartIdx(Math.max(0, bars.length - 120));
  }, [bars, key]);

  useEffect(() => {
    if (!replay || !replayPlaying) return;
    const t = setInterval(() => {
      setReplayIdx((i) => {
        if (i >= bars.length) {
          setReplayPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, speed);
    return () => clearInterval(t);
  }, [replay, replayPlaying, speed, bars.length]);

  const startReplay = useCallback(() => {
    const from = Math.max(0, bars.length - 250);
    setStartIdx(from);
    setReplayIdx(from);
    setReplay(true);
    setReplayPlaying(true);
  }, [bars.length]);

  const exitReplay = useCallback(() => {
    setReplay(false);
    setReplayPlaying(false);
    setReplayIdx(bars.length);
  }, []);

  // 回放键盘操作：空格 播放/暂停，←/→ 单步（输入框内不劫持）
  useEffect(() => {
    if (!replay) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        setReplayPlaying((v) => !v);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setReplayPlaying(false);
        setReplayIdx((i) => Math.min(bars.length, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setReplayPlaying(false);
        setReplayIdx((i) => Math.max(startIdx, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replay, bars.length, startIdx]);

  const visible = useMemo(() => bars.slice(0, replayIdx), [bars, replayIdx]);
  const closes = useMemo(() => visible.map((b) => b.close), [visible]);
  const dates = useMemo(() => visible.map((b) => b.date), [visible]);

  const [selected, clearSelected, attachChart] = useKlineClickDetail(visible);

  // ---- 指标（在可见序列上计算：回放时 = 只用当时已知数据）----
  const ma5 = useMemo(() => (showMA ? sma(closes, 5) : null), [closes, showMA]);
  const ma10 = useMemo(() => (showMA ? sma(closes, 10) : null), [closes, showMA]);
  const ma20 = useMemo(() => (showMA ? sma(closes, 20) : null), [closes, showMA]);
  const ma60 = useMemo(() => (showMA ? sma(closes, 60) : null), [closes, showMA]);
  const bl = useMemo(() => (showBOLL ? boll(closes) : null), [closes, showBOLL]);
  const macdRes = useMemo(() => (sub === "macd" ? macd(closes) : null), [closes, sub]);
  const kdjRes = useMemo(() => (sub === "kdj" ? kdj(visible) : null), [visible, sub]);
  const rsiRes = useMemo(() => (sub === "rsi" ? rsi(closes, 14) : null), [closes, sub]);

  /** 当前可视区间统计（用最后 N 根近似：图表缩放后无法精确反查，取最近窗口足够说明） */
  const windowBars = useMemo(() => {
    const n = visible.length;
    const size = Math.max(20, Math.min(n, 120));
    return visible.slice(n - size);
  }, [visible]);

  const stats = useMemo(() => {
    if (windowBars.length < 2) return null;
    const first = windowBars[0].close;
    const lastBar = windowBars[windowBars.length - 1];
    const chg = first ? ((lastBar.close - first) / first) * 100 : 0;
    let hi = -Infinity;
    let lo = Infinity;
    let peak = -Infinity;
    let maxDD = 0;
    for (const b of windowBars) {
      hi = Math.max(hi, b.high);
      lo = Math.min(lo, b.low);
      peak = Math.max(peak, b.close);
      maxDD = Math.min(maxDD, (b.close - peak) / peak);
    }
    const amp = lo > 0 ? ((hi - lo) / lo) * 100 : 0;
    const n = windowBars.length;
    const avgVol = windowBars.reduce((a, b) => a + b.volume, 0) / n;
    const last5 = windowBars.slice(-5);
    const avgVol5 = last5.reduce((a, b) => a + b.volume, 0) / Math.max(1, last5.length);
    return {
      n,
      chg,
      amp,
      maxDD: maxDD * 100,
      volRatio: avgVol ? avgVol5 / avgVol : null,
      from: windowBars[0].date,
      to: lastBar.date,
    };
  }, [windowBars]);

  /** 最新一根的指标读数（副图联动，图例之外再给一行数字） */
  const readout = useMemo(() => {
    const i = visible.length - 1;
    if (i < 0) return null;
    const b = visible[i];
    const prev = visible[i - 1];
    const chg = prev?.close ? ((b.close - prev.close) / prev.close) * 100 : null;
    const res: Array<{ label: string; value: string; tone?: "up" | "down" }> = [];
    if (showMA && ma20 && ma20[i] != null) {
      const above = b.close >= (ma20[i] as number);
      res.push({ label: "MA20", value: (ma20[i] as number).toFixed(2), tone: above ? "up" : "down" });
    }
    if (showBOLL && bl?.mid[i] != null) {
      res.push({ label: "BOLL中轨", value: String((bl.mid[i] as number).toFixed(2)) });
    }
    if (macdRes) {
      const dif = macdRes.dif[i];
      const dea = macdRes.dea[i];
      if (dif != null && dea != null) {
        res.push({ label: "DIF", value: Number(dif).toFixed(2), tone: dif >= dea ? "up" : "down" });
        res.push({ label: "DEA", value: Number(dea).toFixed(2) });
      }
    }
    if (kdjRes) {
      const k = kdjRes.k[i];
      if (k != null) res.push({ label: "K", value: Number(k).toFixed(1) });
    }
    if (rsiRes) {
      const r = rsiRes[i];
      if (r != null) res.push({ label: "RSI14", value: Number(r).toFixed(1), tone: r >= 70 ? "up" : r <= 30 ? "down" : undefined });
    }
    return { chg, res };
  }, [visible, showMA, showBOLL, ma20, bl, macdRes, kdjRes, rsiRes]);

  const option = useMemo<EChartsOption>(() => {
    if (!visible.length) return {};
    const last = visible[visible.length - 1];
    const prev = visible[visible.length - 2] ?? last;
    const pct = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
    const hasSub = sub !== "none";
    const fmt = (v: number | null | undefined, d = 2) => (v == null ? "—" : Number(v).toFixed(d));

    const markPts = showMarks
      ? marks
          .filter((m) => m.index < replayIdx)
          .map((m) => ({
            coord: [dates[m.index], visible[m.index]?.low ?? visible[visible.length - 1].low],
            symbol: m.type === "buy" ? "triangle" : "pin",
            symbolSize: m.type === "buy" ? 10 : 12,
            symbolRotate: m.type === "buy" ? 0 : 180,
            itemStyle: { color: m.type === "buy" ? "#1e8449" : UP_C },
            label: { show: m.type === "sell", formatter: m.label, fontSize: 9, position: "top" as const, color: "#c0392b" },
          }))
      : [];

    const zoom = zoomRef.current;
    const defaultStart = Math.max(0, 100 - (DEFAULT_WINDOW / Math.max(1, visible.length)) * 100);

    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", label: { fontSize: 9 } },
        formatter: (params: any) => {
          const i = Array.isArray(params) ? params[0]?.dataIndex : params?.dataIndex;
          if (i == null || !visible[i]) return "";
          const b = visible[i];
          const p = i > 0 ? visible[i - 1] : b;
          const ch = p.close ? ((b.close - p.close) / p.close) * 100 : 0;
          const lines: string[] = [
            `<b>${b.date}</b>　振幅 ${(((b.high - b.low) / (b.open || b.close)) * 100).toFixed(2)}%`,
            `开 ${b.open.toFixed(2)}　高 ${b.high.toFixed(2)}　低 ${b.low.toFixed(2)}　收 <b style="color:${ch >= 0 ? UP_C : DOWN_C}">${b.close.toFixed(2)}（${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%）</b>`,
            `量 ${(b.volume / 1e4).toFixed(0)}万手${b.amount ? `　额 ${(b.amount / 1e8).toFixed(2)}亿` : ""}`,
          ];
          if (showMA) lines.push(`MA5 ${fmt(ma5?.[i])}　MA10 ${fmt(ma10?.[i])}　MA20 ${fmt(ma20?.[i])}　MA60 ${fmt(ma60?.[i])}`);
          if (showBOLL) lines.push(`BOLL 上 ${fmt(bl?.upper[i])}　中 ${fmt(bl?.mid[i])}　下 ${fmt(bl?.lower[i])}`);
          if (macdRes) lines.push(`MACD 柱 ${fmt(macdRes.hist[i])}　DIF ${fmt(macdRes.dif[i])}　DEA ${fmt(macdRes.dea[i])}`);
          if (kdjRes) lines.push(`K ${fmt(kdjRes.k[i], 1)}　D ${fmt(kdjRes.d[i], 1)}　J ${fmt(kdjRes.j[i], 1)}`);
          if (rsiRes) lines.push(`RSI(14) ${fmt(rsiRes[i], 1)}`);
          return lines.join("<br/>");
        },
      },
      legend: {
        top: 0,
        textStyle: { fontSize: 10 },
        data: [
          ...(showMA ? ["MA5", "MA10", "MA20", "MA60"] : []),
          ...(showBOLL ? ["BOLL上轨", "BOLL中轨", "BOLL下轨"] : []),
          ...(sub !== "none" ? [sub.toUpperCase()] : []),
        ],
      },
      grid: [
        { left: 56, right: 16, top: 26, height: 250 },
        { left: 56, right: 16, top: 288, height: 56 },
        ...(hasSub ? [{ left: 56, right: 16, top: 356, height: 90 }] : []),
      ],
      xAxis: [
        { type: "category", data: dates, gridIndex: 0, axisLabel: { show: false }, boundaryGap: true },
        { type: "category", data: dates, gridIndex: 1, axisLabel: { show: false }, boundaryGap: true },
        ...(hasSub
          ? [{ type: "category" as const, data: dates, gridIndex: 2, axisLabel: mkDayAxisLabel(dates[dates.length - 1], { fontSize: 9 }), boundaryGap: true }]
          : []),
      ],
      yAxis: [
        { scale: true, gridIndex: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.12)" } } },
        { gridIndex: 1, axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 1e4).toFixed(0)}万` }, splitLine: { show: false } },
        ...(hasSub ? [{ gridIndex: 2, scale: true, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.1)" } } }] : []),
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1, ...(hasSub ? [2] : [])],
          start: zoom ? zoom.start : defaultStart,
          end: zoom ? zoom.end : 100,
        },
        {
          type: "slider",
          xAxisIndex: [0, 1, ...(hasSub ? [2] : [])],
          bottom: 2,
          height: 14,
          borderColor: "rgba(128,128,128,0.2)",
          start: zoom ? zoom.start : defaultStart,
          end: zoom ? zoom.end : 100,
        },
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
        mkPctSeries({ bars: visible, show: pctCfg.show, position: pctCfg.position, fontSize: pctCfg.fontSize, maxVisible: 60, keep: 60 }),
        ...(showMA
          ? ([
              { name: "MA5", type: "line", data: ma5, symbol: "none", lineStyle: { width: 1, color: "#b45309" } },
              { name: "MA10", type: "line", data: ma10, symbol: "none", lineStyle: { width: 1, color: "#1d4ed8" } },
              { name: "MA20", type: "line", data: ma20, symbol: "none", lineStyle: { width: 1, color: "#7c3aed" } },
              { name: "MA60", type: "line", data: ma60, symbol: "none", lineStyle: { width: 1.2, color: "#6b6862" } },
            ] as any[])
          : []),
        ...(showBOLL
          ? ([
              { name: "BOLL上轨", type: "line", data: bl!.upper, symbol: "none", lineStyle: { width: 1, color: "rgba(128,128,128,0.5)" } },
              { name: "BOLL中轨", type: "line", data: bl!.mid, symbol: "none", lineStyle: { width: 1, color: "#b45309", type: "dashed" } },
              { name: "BOLL下轨", type: "line", data: bl!.lower, symbol: "none", lineStyle: { width: 1, color: "rgba(128,128,128,0.5)" } },
            ] as any[])
          : []),
        ...(macdRes
          ? ([
              { name: "MACD", type: "bar", xAxisIndex: 2, yAxisIndex: 2, data: macdRes.hist.map((h) => ({ value: h, itemStyle: { color: (h ?? 0) >= 0 ? UP_C : DOWN_C } })) },
              { name: "DIF", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: macdRes.dif, symbol: "none", lineStyle: { width: 1, color: "#b45309" } },
              { name: "DEA", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: macdRes.dea, symbol: "none", lineStyle: { width: 1, color: "#1d4ed8" } },
            ] as any[])
          : []),
        ...(kdjRes
          ? ([
              { name: "KDJ", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: kdjRes.k, symbol: "none", lineStyle: { width: 1, color: "#b45309" } },
              { name: "D", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: kdjRes.d, symbol: "none", lineStyle: { width: 1, color: "#1d4ed8" } },
              { name: "J", type: "line", xAxisIndex: 2, yAxisIndex: 2, data: kdjRes.j, symbol: "none", lineStyle: { width: 1, color: "#7c3aed" } },
            ] as any[])
          : []),
        ...(rsiRes
          ? ([
              {
                name: "RSI(14)",
                type: "line",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: rsiRes,
                symbol: "none",
                lineStyle: { width: 1.2, color: "#b45309" },
                markLine: {
                  silent: true,
                  data: [
                    { yAxis: 70, lineStyle: { color: "rgba(215,0,11,0.3)", type: "dashed" } },
                    { yAxis: 30, lineStyle: { color: "rgba(10,160,110,0.3)", type: "dashed" } },
                  ],
                },
              },
            ] as any[])
          : []),
      ],
      graphic: replay
        ? [
            {
              type: "text",
              left: "center",
              top: 40,
              style: {
                text: `${replayPlaying ? "回放中" : "已暂停"} · ${visible[visible.length - 1]?.date ?? ""}　${last.close.toFixed(2)}（${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%）`,
                fontSize: 14,
                fontWeight: 700,
                fill: pct >= 0 ? UP_C : DOWN_C,
              },
            },
          ]
        : undefined,
    };
  }, [visible, dates, sub, showMA, showBOLL, showMarks, marks, replayIdx, symbol, ma5, ma10, ma20, ma60, bl, macdRes, kdjRes, rsiRes, replay, replayPlaying, pctCfg]);

  // ---- 缩放记忆：图表内滚动/拖拽后记住窗口，数据刷新时不跳回默认 ----
  const onDataZoom = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const dz = chart.getOption().dataZoom as any[];
      const first = Array.isArray(dz) ? dz[0] : null;
      if (first && typeof first.start === "number" && typeof first.end === "number") {
        zoomRef.current = { start: first.start, end: first.end };
        const total = visible.length;
        const from = Math.max(0, Math.floor((first.start / 100) * total));
        const to = Math.min(total, Math.ceil((first.end / 100) * total));
        setZoomHint(`${Math.max(1, to - from)} 根`);
      }
    } catch {
      /* 忽略 */
    }
  }, [visible.length]);

  const setRange = (n: number) => {
    const chart = chartRef.current;
    if (!chart || !visible.length) return;
    const total = visible.length;
    const size = Math.min(total, n);
    const start = ((total - size) / total) * 100;
    chart.dispatchAction({ type: "dataZoom", start, end: 100 });
  };

  const resetZoom = () => {
    zoomRef.current = null;
    setZoomHint("");
    const chart = chartRef.current;
    if (chart) chart.dispatchAction({ type: "dataZoom", start: Math.max(0, 100 - (DEFAULT_WINDOW / Math.max(1, visible.length)) * 100), end: 100 });
  };

  const exportPng = () => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${symbol}-${period}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch {
      /* 忽略：个别浏览器限制 */
    }
  };

  const btn = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs transition-colors duration-150 ${active ? "bg-primary text-white" : "text-muted hover:text-foreground hover:bg-border/60"}`;

  // ---- 加载 / 空态 ----
  if (!bars.length) {
    if (loading) {
      return (
        <div className="space-y-2" aria-busy="true" aria-label="K 线数据加载中">
          <div className="flex items-center gap-2">
            {[100, 64, 72, 56].map((w, i) => (
              <div key={i} className="h-6 rounded-md bg-muted/15 animate-pulse" style={{ width: w }} />
            ))}
          </div>
          <div className="h-[380px] rounded-lg bg-muted/10 animate-pulse" />
          <p className="text-[11px] text-muted">正在拉取多源 K 线（东财 → 新浪 → 腾讯）…</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-[300px] gap-3 text-sm text-muted">
        <p>暂无 K 线数据</p>
        <p className="text-[11px] text-muted/80">上游行情源可能刚好超时，稍后重试通常即可恢复</p>
        {onRetry && (
          <button onClick={onRetry} className="px-3 py-1.5 rounded-md text-xs border border-border hover:border-primary/50 hover:text-primary">
            重试拉取
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* 控制条：叠加指标 + 副图 + 区间 + 导出 + 回放 */}
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
        {pctToggle}
        {!replay && (
          <div className="flex items-center gap-1">
            <span className="text-muted mr-1">区间：</span>
            {[
              { n: 60, label: "60日" },
              { n: 120, label: "120日" },
              { n: 250, label: "250日" },
            ].map((r) => (
              <button key={r.n} className={btn(false)} onClick={() => setRange(r.n)}>
                {r.label}
              </button>
            ))}
            <button className={btn(false)} onClick={resetZoom}>重置</button>
            {zoomHint && <span className="text-[10px] text-muted ml-1">当前 {zoomHint}</span>}
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={exportPng}
            title="把当前图表导出为 PNG"
            aria-label="导出图表 PNG"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-border hover:border-primary/50 hover:text-primary transition-colors"
          >
            <Camera className="w-3 h-3" /> 导出
          </button>
          <button
            onClick={() => (replay ? exitReplay() : startReplay())}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-border hover:border-primary/50 hover:text-primary transition-colors"
          >
            {replay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {replay ? "退出回放" : "历史回放"}
          </button>
          {replay && (
            <>
              <button
                onClick={() => { setReplayPlaying((v) => !v); }}
                className="p-1 rounded-md text-muted hover:text-primary"
                aria-label={replayPlaying ? "暂停回放" : "继续回放"}
                title={replayPlaying ? "暂停（空格）" : "继续（空格）"}
              >
                {replayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { setReplayPlaying(false); setReplayIdx((i) => Math.max(startIdx, i - 1)); }}
                className="p-1 rounded-md text-muted hover:text-primary"
                aria-label="回退一根"
                title="← 回退一根"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setReplayPlaying(false); setReplayIdx((i) => Math.min(bars.length, i + 1)); }}
                className="p-1 rounded-md text-muted hover:text-primary"
                aria-label="前进一根"
                title="→ 前进一根"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="px-1.5 py-1 rounded-md border border-border bg-card text-xs"
                aria-label="回放速度"
              >
                <option value={500}>0.5×</option>
                <option value={200}>1×</option>
                <option value={80}>2.5×</option>
                <option value={30}>5×</option>
              </select>
              <span className="text-muted font-mono tabular-nums">{Math.max(0, replayIdx - startIdx)}/{Math.max(1, bars.length - startIdx)}根</span>
              <button
                onClick={exitReplay}
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

      {/* 区间统计 + 最新指标读数。
          高度预留两行：数据未到时这块是空的，拿到 bars 后同时出现「近 N 根 / 振幅 / 最大回撤 /
          近 5 日量比 / 区间」+ 右侧读数，会在窄一点的卡片里折成两行、把下方 K 线整体下推 61px
          （实测 /lab 的 0.075 CLS 就来自这里）。min-h 让首帧就把这两行位置占住。 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px] text-muted min-h-[60px] content-start">
        {stats && (
          <>
            <span className="font-mono">
              近 {stats.n} 根：<span className={stats.chg >= 0 ? "up" : "down"}>{stats.chg >= 0 ? "+" : ""}{stats.chg.toFixed(2)}%</span>
            </span>
            <span className="font-mono">振幅 {stats.amp.toFixed(2)}%</span>
            <span className="font-mono">
              最大回撤 <span className="down">{stats.maxDD.toFixed(2)}%</span>
            </span>
            {stats.volRatio != null && <span className="font-mono">近 5 日量比 {stats.volRatio.toFixed(2)}</span>}
            <span className="font-mono text-muted/70">
              {stats.from} → {stats.to}
            </span>
          </>
        )}
        {readout?.res.length ? (
          <span className="ml-auto flex items-center gap-3 font-mono flex-wrap">
            {readout.res.map((r) => (
              <span key={r.label} className="text-muted/80">
                {r.label}:{" "}
                <span className={r.tone === "up" ? "up" : r.tone === "down" ? "down" : "text-foreground"}>{r.value}</span>
              </span>
            ))}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <EChart
          option={option}
          height={sub === "none" ? 380 : 480}
          chartRef={chartRef}
          onDataZoom={onDataZoom}
          onReady={attachChart}
        />
        {selected && (
          <div className="absolute left-2 top-2 z-10">
            <KlineDetailPanel
              bar={selected}
              prev={(() => {
                const i = visible.findIndex((b) => b.date === selected.date);
                return i > 0 ? visible[i - 1] : null;
              })()}
              onClose={clearSelected}
              title={symbol}
            />
          </div>
        )}
      </div>

      {/* 回放进度条 */}
      {replay && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={startIdx}
            max={bars.length}
            value={replayIdx}
            onChange={(e) => {
              setReplayPlaying(false);
              setReplayIdx(Number(e.target.value));
            }}
            className="flex-1 accent-[var(--primary)]"
            aria-label="回放进度"
          />
          <span className="text-[11px] text-muted font-mono">{bars[Math.min(replayIdx, bars.length) - 1]?.date ?? ""}</span>
          <span className="text-[10px] text-muted/70">空格 播放/暂停 · ←/→ 单步</span>
        </div>
      )}
    </div>
  );
}
