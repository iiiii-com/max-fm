"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

interface FlowData {
  mainNetIn: number;
  mainPct: number;
  superNetIn: number;
  bigNetIn: number;
  midNetIn: number;
  smallNetIn: number;
  superPct?: number | null;
  bigPct?: number | null;
  midPct?: number | null;
  smallPct?: number | null;
  mainNetIn5: number | null;
  mainNetIn10: number | null;
  trend: string;
}

const fmt = (v: number | null | undefined) => (v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${(v / 1e8).toFixed(2)}亿`);

/** 当日资金流向四档明细（超大/大/中/小单）+ 主力摘要（东财真实） */
export default function FlowBreakdown({ flow }: { flow: FlowData | null }) {
  if (!flow) return null;
  const tiers = [
    { label: "超大单", net: flow.superNetIn, pct: flow.superPct, note: "≥100 万手" },
    { label: "大单", net: flow.bigNetIn, pct: flow.bigPct, note: "20-100 万手" },
    { label: "中单", net: flow.midNetIn, pct: flow.midPct, note: "4-20 万手" },
    { label: "小单", net: flow.smallNetIn, pct: flow.smallPct, note: "<4 万手" },
  ];
  // 堆叠条：按最大绝对值归一化
  const maxAbs = Math.max(...tiers.map((t) => Math.abs(t.net)), 1e6);

  return (
    <div className="space-y-2">
      {/* 主力摘要 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1 text-[11px] font-bold">
          {flow.trend === "流入" ? <TrendingUp className="w-3.5 h-3.5 up" /> : flow.trend === "流出" ? <TrendingDown className="w-3.5 h-3.5 down" /> : null}
          主力资金
          <b className={flow.mainNetIn >= 0 ? "up" : "down"}>{fmt(flow.mainNetIn)}</b>
          <span className="text-muted">({flow.mainPct.toFixed(1)}%)</span>
        </span>
        <span className="text-[11px] text-muted">5 日 {fmt(flow.mainNetIn5)}</span>
        <span className="text-[11px] text-muted">10 日 {fmt(flow.mainNetIn10)}</span>
        <span className="text-[11px] text-muted">趋势：{flow.trend}</span>
      </div>

      {/* 四档堆叠条（正负分色居中展开） */}
      <div className="flex h-6 rounded-md overflow-hidden border border-border/60">
        {tiers.map((t) => {
          const w = (Math.abs(t.net) / maxAbs) * 50; // 单侧最多 50%
          if (t.net < 0) return <div key={t.label} className="flex-1" />;
          return (
            <div key={t.label} className="flex-1 flex justify-center">
              <div className="h-full" style={{ width: `${w}%`, background: "rgba(215,0,11,0.55)" }} title={`${t.label} +${(t.net / 1e8).toFixed(2)}亿`} />
            </div>
          );
        })}
        {tiers.map((t) => {
          const w = (Math.abs(t.net) / maxAbs) * 50;
          if (t.net >= 0) return <div key={t.label} className="flex-1" />;
          return (
            <div key={t.label} className="flex-1 flex justify-center">
              <div className="h-full" style={{ width: `${w}%`, background: "rgba(10,160,110,0.55)" }} title={`${t.label} ${(t.net / 1e8).toFixed(2)}亿`} />
            </div>
          );
        })}
      </div>

      {/* 四档明细表 */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-muted border-b border-border bg-muted/20">
              <th className="text-left py-1.5 pl-3 pr-2 font-medium">档位</th>
              <th className="text-right py-1.5 px-2 font-medium">净流入</th>
              <th className="text-right py-1.5 px-2 font-medium">占比</th>
              <th className="text-right py-1.5 pr-3 font-medium">方向</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.label} className="border-b border-border/40 last:border-0">
                <td className="py-1.5 pl-3 pr-2">
                  <span className="text-[12px] font-medium">{t.label}</span>
                  <span className="text-[9px] text-muted ml-1">{t.note}</span>
                </td>
                <td className={`py-1.5 px-2 text-right font-mono text-[12px] font-bold ${t.net >= 0 ? "up" : "down"}`}>{fmt(t.net)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-[11px] text-muted">{t.pct != null ? `${t.pct >= 0 ? "+" : ""}${t.pct.toFixed(2)}%` : "—"}</td>
                <td className={`py-1.5 pr-3 text-right text-[11px] font-medium ${t.net >= 0 ? "up" : "down"}`}>{t.net >= 0 ? "流入" : "流出"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted">
        口径：超大单 ≥100 万手 / 大单 20-100 万 / 中单 4-20 万 / 小单 &lt;4 万（东财）；主力 = 超大单+大单。数据为最近交易日收盘统计（东财 fflow daykline，1 小时缓存）。
      </p>
    </div>
  );
}
