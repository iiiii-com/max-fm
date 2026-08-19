"use client";

import { fmt, fmtPct, fmtWan } from "@/lib/utils";

export interface ScorePanelData {
  total: number;
  level: string;
  tech: number;
  flow: number;
  valuation: number;
  fundamentals: number;
  summary: string;
  signals: string[];
}

export interface FlowPanelData {
  mainNetIn: number;
  mainPct: number;
  superNetIn: number;
  bigNetIn: number;
  midNetIn: number;
  smallNetIn: number;
  mainNetIn5: number | null;
  mainNetIn10: number | null;
  trend: string;
  trendScore: number;
}

function scoreColor(n: number) {
  if (n >= 70) return "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/40 dark:bg-red-950/30";
  if (n >= 50) return "text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/40 dark:bg-orange-950/30";
  if (n >= 40) return "text-sky-600 border-sky-200 bg-sky-50 dark:text-sky-400 dark:border-sky-900/40 dark:bg-sky-950/30";
  return "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/40 dark:bg-emerald-950/30";
}

function flowColor(n: number) {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "";
}

export default function ScorePanel({ data, loading }: { data: ScorePanelData | null; loading?: boolean }) {
  if (loading) return <p className="text-xs text-muted">评分计算中…</p>;
  if (!data) return <p className="text-xs text-muted">暂无评分数据</p>;
  const dims: Array<[string, number]> = [
    ["技术面", data.tech],
    ["资金面", data.flow],
    ["估值面", data.valuation],
    ["基本面", data.fundamentals],
  ];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-2xl font-bold font-mono px-2.5 py-1 rounded-lg border ${scoreColor(data.total)}`}>{data.total}</span>
        <div>
          <p className="text-sm font-medium">{data.level}</p>
          <p className="text-[11px] text-muted">综合评分（0-100）</p>
        </div>
      </div>
      {data.signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {data.signals.map((s, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {dims.map(([name, v]) => (
          <div key={name} className="text-center rounded-md bg-muted/40 px-1 py-1.5">
            <p className="text-[10px] text-muted">{name}</p>
            <p className={`text-sm font-bold font-mono ${v >= 60 ? "up" : v <= 40 ? "down" : ""}`}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FlowPanel({ data, loading }: { data: FlowPanelData | null; loading?: boolean }) {
  if (loading) return <p className="text-xs text-muted">资金流加载中…</p>;
  if (!data) return <p className="text-xs text-muted">暂无资金流数据</p>;
  const rows: Array<[string, number, boolean]> = [
    ["主力净流入", data.mainNetIn, true],
    ["超大单", data.superNetIn, true],
    ["大单", data.bigNetIn, true],
    ["中单", data.midNetIn, true],
    ["小单", data.smallNetIn, true],
  ];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-medium">资金流向</p>
        <span className={`text-[11px] px-1.5 py-0.5 rounded ${data.trend === "流入" ? "up bg-red-50 dark:bg-red-950/40" : data.trend === "流出" ? "down bg-emerald-50 dark:bg-emerald-950/40" : "text-muted bg-muted/40"}`}>
          {data.trend} {data.trendScore}分
        </span>
      </div>
      <div className="space-y-1 text-xs">
        {rows.map(([name, v, show]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-muted">{name}</span>
            <span className={`font-mono font-medium ${flowColor(v)}`}>{show ? fmtWan(v / 1e8) : "—"}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-muted">5日主力净额</span>
          <span className={`font-mono font-medium ${flowColor(data.mainNetIn5 ?? 0)}`}>{data.mainNetIn5 == null ? "—" : fmtWan(data.mainNetIn5 / 1e8)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">10日主力净额</span>
          <span className={`font-mono font-medium ${flowColor(data.mainNetIn10 ?? 0)}`}>{data.mainNetIn10 == null ? "—" : fmtWan(data.mainNetIn10 / 1e8)}</span>
        </div>
      </div>
    </div>
  );
}

export function SignalChips({ signals }: { signals: string[] }) {
  if (!signals?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((s, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
      ))}
    </div>
  );
}

export function fmtMoney(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return fmt(n, 0);
}

export { fmtPct };