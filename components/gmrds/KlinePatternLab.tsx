"use client";

import { useMemo, useState } from "react";
import KlinePatternChart from "@/components/gmrds/KlinePatternChart";
import VizBoundary from "@/components/gmrds/VizBoundary";
import shIndex from "@/data/sh-index.json";

/**
 * 环节 7 · K 线形态与买卖点（真实全量日线 + 区间切换）
 *
 * 为什么要改：此前这里挂的是 data/shanghai-sample.json，只有 219 根（0.91 年）
 * 且为合成数据，与页面宣称的"真实日线"不符。改为直接消费
 * data/sh-index.json（8536 根，1990-12-19 起，腾讯财经历史日线），
 * 并提供区间切换，让长周期形态（熊牛切换、顶部/底部形态）能被真正看到。
 */

/** 可选区间：按"最近 N 年"截断，另有全部 */
const RANGES = [
  { key: "1y", label: "1 年", years: 1 },
  { key: "3y", label: "3 年", years: 3 },
  { key: "5y", label: "5 年", years: 5 },
  { key: "10y", label: "10 年", years: 10 },
  { key: "all", label: "全部", years: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/** sh-index 口径：日期/开/收/高/低/量 */
type Row = [string, number, number, number, number, number];

export default function KlinePatternLab({
  marks,
  caption,
}: {
  marks: Array<{ date: string; label: string; type: "buy" | "sell" | "hold" }>;
  caption?: string;
}) {
  const [range, setRange] = useState<RangeKey>("5y");

  const all = useMemo(
    () =>
      (shIndex as Row[]).map((b) => ({
        date: b[0],
        open: b[1],
        close: b[2],
        high: b[3],
        low: b[4],
        volume: Math.round(b[5]),
      })),
    []
  );

  const bars = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (r.years === 0) return all;
    const from = new Date(all[all.length - 1].date);
    from.setFullYear(from.getFullYear() - r.years);
    const iso = from.toISOString().slice(0, 10);
    return all.filter((b) => b.date >= iso);
  }, [all, range]);

  // 标注点只在当前区间内才画，避免图例出现区间外的买卖点
  const marksInRange = useMemo(() => {
    if (!bars.length) return [];
    const lo = bars[0].date;
    const hi = bars[bars.length - 1].date;
    return marks.filter((m) => m.date >= lo && m.date <= hi);
  }, [marks, bars]);

  const spanYears = bars.length
    ? ((new Date(bars[bars.length - 1].date).getTime() - new Date(bars[0].date).getTime()) /
        86400000 /
        365.25).toFixed(1)
    : "0";

  return (
    <div>
      {/* 区间切换：让 1 年 / 11 年 / 35 年都能一键对比 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className="text-[11px] text-muted mr-1">时间跨度</span>
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
        <span className="text-[10px] text-muted ml-auto tabular-nums">
          {bars.length} 根 · {bars.length ? `${bars[0].date} ~ ${bars[bars.length - 1].date}` : "无数据"} · 约{" "}
          {spanYears} 年
        </span>
      </div>

      <VizBoundary name="K线形态与买卖点">
        <KlinePatternChart
          bars={bars}
          marks={marksInRange}
          title={`上证综指 ${bars.length ? `${bars[0].date} ~ ${bars[bars.length - 1].date}` : ""}（真实日线）· 形态与买卖点`}
          height={420}
          caption={caption}
        />
      </VizBoundary>

      {marksInRange.length === 0 && bars.length > 0 && (
        <p className="text-[10px] text-muted mt-2 border-l-2 border-border pl-2">
          当前区间内无预设买卖点标注。切到「1 年」可看到 2024-09 政策反转、2024-10 顶部、2025-02 突破三处真实拐点。
        </p>
      )}
    </div>
  );
}