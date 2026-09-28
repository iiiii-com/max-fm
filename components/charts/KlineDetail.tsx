"use client";

import { useEffect, useRef, useState, useCallback, type MutableRefObject } from "react";
import { echarts } from "./echarts";

/**
 * K 线详情面板与点击选中 hook
 *
 * 统一所有 K 线组件的「每日涨跌幅」展示：
 * - 顶部悬浮卡片，点击 K 线后固定显示该日完整信息（日期 / OHLC / 涨跌额 / 涨跌幅 / 成交量）
 * - 涨红跌绿（中国惯例，与站点一致）
 * - 与 hover tooltip 互补：hover 看瞬时预览，click 看持续详情
 *
 * 用法：
 *   const [selected, clearSelected] = useKlineClickDetail(chartRef, bars);
 *   return <>
 *     <EChart onClick={...} ... />
 *     <KlineDetail bar={selected} prev={selected ? bars[i-1] : null} onClose={clearSelected} />
 *   </>
 *
 * 对于被 KlineAnnotations SVG 覆盖的图表（svg 会拦截原生点击），
 * 需要在 KlineAnnotations 中通过 onBarClick 回调把选中的 dataIndex 传出来。
 * 这两种模式在调用点同时启用即可兼容。
 */

export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume?: number;
  amount?: number;
}

export interface KlineDetailPanelProps {
  /** 当前选中的 K 线 */
  bar: KlineBar | null;
  /** 前一交易日（用于计算涨跌幅；可选，组件会基于 bar.index 自动取） */
  prev?: KlineBar | null;
  /** 前一交易日收盘价（已知 OHLC 即可，手动指定 prev 可减少对象引用） */
  prevClose?: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题前缀（标的名称等） */
  title?: string;
  /** 绝对定位边距 */
  className?: string;
}

/**
 * K 线详情面板：被选中后顶部居中悬浮，显示完整信息。
 * 选中态消失则自动淡出（受父组件传入的 bar 控制）。
 */
export function KlineDetailPanel({ bar, prev, prevClose, onClose, title, className }: KlineDetailPanelProps) {
  if (!bar) return null;
  const prevCloseValue = prevClose ?? prev?.close ?? null;
  const change = prevCloseValue != null ? bar.close - prevCloseValue : null;
  const pct = prevCloseValue != null && prevCloseValue !== 0 ? ((bar.close - prevCloseValue) / prevCloseValue) * 100 : null;
  const up = (pct ?? 0) >= 0;
  const upColor = "#c0392b"; // A 股惯例：涨红
  const downColor = "#1e8449"; // 跌绿
  const c = up ? upColor : downColor;
  const sign = up ? "+" : "";

  const fmt = (v: number | null | undefined, d = 2) => (v == null || !isFinite(v) ? "—" : v.toFixed(d));
  const fmtVol = (v?: number) => {
    if (v == null || !isFinite(v)) return "—";
    if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
    if (v >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
    return String(v);
  };
  const fmtAmt = (v?: number) => {
    if (v == null || !isFinite(v)) return "—";
    if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
    if (v >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
    return String(v);
  };

  // 涨跌停/振幅等辅助（仅展示，不作判定）
  const amplitude = bar.high > 0 && bar.low > 0 ? ((bar.high - bar.low) / bar.low) * 100 : null;

  return (
    <div
      role="dialog"
      aria-label="K线详情"
      data-kline-detail
      className={
        "pointer-events-auto flex items-center gap-3 rounded-md border border-primary/30 bg-card/95 px-3 py-2 text-[12px] leading-tight shadow-lg backdrop-blur " +
        (className ?? "")
      }
    >
      <div className="flex flex-col gap-0.5 pr-3 border-r border-border/60">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-foreground">{title ?? bar.date}</span>
          <span className="text-[10px] text-muted font-mono">{bar.date}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span style={{ color: c }} className="font-bold text-[15px] font-mono">
            {fmt(bar.close)}
          </span>
          {change != null && pct != null && (
            <span style={{ color: c }} className="font-mono text-[11px]">
              {sign}
              {fmt(change)}　{sign}
              {fmt(pct)}%
            </span>
          )}
        </div>
      </div>

      <table className="font-mono text-[11px]">
        <tbody>
          <tr>
            <td className="text-muted pr-2">开</td>
            <td className="text-right text-foreground">{fmt(bar.open)}</td>
            <td className="text-muted pr-2 pl-3">高</td>
            <td className="text-right text-foreground">{fmt(bar.high)}</td>
            <td className="text-muted pr-2 pl-3">低</td>
            <td className="text-right text-foreground">{fmt(bar.low)}</td>
            <td className="text-muted pr-2 pl-3">振幅</td>
            <td className="text-right text-foreground">{fmt(amplitude, 2)}%</td>
          </tr>
          <tr>
            <td className="text-muted pr-2">量</td>
            <td className="text-right text-foreground">{fmtVol(bar.volume)}</td>
            {bar.amount != null && (
              <>
                <td className="text-muted pr-2 pl-3">额</td>
                <td className="text-right text-foreground">{fmtAmt(bar.amount)}</td>
              </>
            )}
            {prevCloseValue != null && (
              <>
                <td className="text-muted pr-2 pl-3">昨收</td>
                <td className="text-right text-foreground">{fmt(prevCloseValue)}</td>
              </>
            )}
          </tr>
        </tbody>
      </table>

      <button
        type="button"
        onClick={onClose}
        aria-label="关闭详情"
        className="ml-1 rounded p-1 text-muted hover:bg-muted/40 hover:text-foreground transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * K 线点击选中 hook：监听 ECharts chart 的 click 事件。
 * 返回 [selectedBar, clearSelected, attachChart]。
 *
 * 用法：把 attachChart 传给 EChart 的 onReady（或 AnnotatableChart 的 chartRef 状态回调）：
 *   const [selected, clear, attachChart] = useKlineClickDetail(bars);
 *   <EChart onReady={attachChart} ... />
 *
 * 关键：不能直接依赖 chartRef.current —— ref 变化不触发 effect，挂载时 chart 还没初始化，
 * 之后再也不会重试。必须用「状态化的 chart 实例」（onReady 回调）驱动。
 *
 * 注意：AnnotatableChart 包了一层 SVG 画线层会拦截原生点击，
 * 调用方应同时通过 KlineAnnotations 的 onBarClick 回调触发选中。
 */
export function useKlineClickDetail<T extends KlineBar>(
  bars: T[],
  enabled: boolean = true
): [T | null, () => void, (chart: echarts.ECharts | null) => void] {
  const [selected, setSelected] = useState<T | null>(null);
  const [chart, setChart] = useState<echarts.ECharts | null>(null);
  const barsRef = useRef(bars);
  barsRef.current = bars;

  const clear = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (!chart || !enabled) return;
    const handler = (e: any) => {
      // ECharts click：candlestick series 上的点击（seriesIndex 0 = 主 K 线）
      if (e?.seriesType === "candlestick" || (e?.seriesIndex === 0 && e?.componentType === "series")) {
        const i = e.dataIndex;
        if (typeof i === "number" && i >= 0) {
          const b = barsRef.current[i];
          if (b) setSelected(b);
        }
      }
    };
    chart.on("click", handler);
    return () => {
      try {
        chart.off("click", handler);
      } catch {
        /* ignore */
      }
    };
  }, [chart, enabled]);

  return [selected, clear, setChart as (chart: echarts.ECharts | null) => void];
}