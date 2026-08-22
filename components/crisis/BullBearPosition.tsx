"use client";

import { useMemo } from "react";
import { Badge, Card } from "@/components/ui";
import { BULL_BEAR_CYCLES } from "@/lib/data/bullbear";

/**
 * 危机 → A 股牛熊周期定位卡
 * 将危机重演的时间窗映射到 21 轮牛熊周期表中，展示危机所处的牛熊阶段与同期量能/估值特征。
 */
const CRISIS_TO_PERIOD: Record<string, string> = {
  "2008-subprime": "熊6-大熊市", // A 股视角：2007.10 见顶 → 2008.10 见底
  "2015-ashare-crash": "熊8-股灾",
  "2020-covid-crash": "牛10-结构牛",
  "1997-asian-crisis": "熊4-回调",
  "2000-dotcom-bubble": "熊5-五年熊",
  // 1929 大萧条（1929-1933）时 A 股尚未开市（上交所 1990 年成立），不做牛熊映射
};

function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtVolHand(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿手`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万手`;
  return `${n.toFixed(0)}手`;
}

export default function BullBearPosition({ crisisId, period }: { crisisId: string; period?: [string, string] }) {
  const cycle = useMemo(() => {
    const name = CRISIS_TO_PERIOD[crisisId];
    if (!name) return null;
    return BULL_BEAR_CYCLES.find((c) => c.period === name) ?? null;
  }, [crisisId]);

  if (!cycle) return null;
  const isBull = cycle.phase === "bull";
  const dd = Math.round(((cycle.low - cycle.high) / cycle.high) * 1000) / 10;

  return (
    <Card className="p-4 border-l-4 border-l-primary">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <p className="text-xs font-semibold text-muted">A 股牛熊周期定位</p>
        <Badge tone={isBull ? "red" : "green"}>{isBull ? "牛市阶段" : "熊市阶段"}</Badge>
        <span className="text-[10px] text-muted ml-auto font-mono">{period?.[0]} ~ {period?.[1]}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted mb-0.5">所处阶段</p>
          <p className="font-semibold whitespace-nowrap">{cycle.period}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted mb-0.5">阶段涨跌</p>
          <p className={`font-semibold font-mono ${isBull ? "up" : "down"}`}>{fmtPct(cycle.changePct)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted mb-0.5">持续时长</p>
          <p className="font-semibold font-mono">{cycle.months} 个月</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted mb-0.5">区间回撤</p>
          <p className="font-semibold font-mono down">{fmtPct(dd)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted mb-0.5">天量 / 地量</p>
          <p className="font-semibold font-mono">{fmtVolHand(cycle.maxVolHand)} / {fmtVolHand(cycle.minVolHand)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted mb-0.5">量能比</p>
          <p className="font-semibold font-mono">{cycle.volRatio != null ? `${cycle.volRatio}×` : "—"}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2 col-span-2">
          <p className="text-muted mb-0.5">估值区间</p>
          <p className="font-medium">{cycle.peRange ?? "—"}</p>
        </div>
      </div>
      {cycle.volNote && (
        <p className="text-[11px] text-muted mt-2 leading-relaxed border-t border-border/60 pt-2">
          <span className="font-semibold">量能特征：</span>{cycle.volNote}
        </p>
      )}
    </Card>
  );
}
