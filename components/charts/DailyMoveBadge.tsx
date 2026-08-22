"use client";

/**
 * 当日（最新交易日）涨跌概况徽章
 * - 展示最新交易日相对前一日的涨跌数值 + 涨跌百分比
 * - 涨红跌绿（中国习惯），颜色醒目
 * - 紧凑布局，适配移动端小屏
 */
export interface DailyMoveBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

export default function DailyMoveBadge({
  bars,
  name,
  decimals = 2,
}: {
  bars: DailyMoveBar[];
  /** 标的名称（如"上证综指"），可选 */
  name?: string;
  /** 价格小数位（指数 2 位、ETF 3 位） */
  decimals?: number;
}) {
  if (!bars || bars.length < 2) return null;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  if (!last || !prev) return null;

  const diff = last.close - prev.close;
  const pct = prev.close ? (diff / prev.close) * 100 : 0;
  const up = diff >= 0;
  const color = up ? "var(--up)" : "var(--down)";
  const sign = diff >= 0 ? "+" : "";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card/80 px-2.5 py-1.5 text-xs">
      {name && <span className="font-medium text-muted">{name}</span>}
      <span className="font-mono font-bold" style={{ color }}>
        {sign}{diff.toFixed(decimals)}
        <span className="font-normal text-[11px] ml-1" style={{ color }}>
          {sign}{pct.toFixed(2)}%
        </span>
      </span>
      <span className="flex items-center gap-2 text-[10px] text-muted font-mono">
        <span>{last.date}</span>
        <span>开 {last.open.toFixed(decimals)}</span>
        <span>高 {last.high.toFixed(decimals)}</span>
        <span>低 {last.low.toFixed(decimals)}</span>
      </span>
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ color, background: up ? "rgba(215,0,11,0.1)" : "rgba(10,160,110,0.1)" }}
      >
        {up ? "▲ 上涨" : "▼ 下跌"}
      </span>
    </div>
  );
}
