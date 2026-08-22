"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import type { KlineBar } from "@/app/api/stock/kline/route";
import { mkKlineTooltip, mkPctLabel } from "@/lib/data/kline-tooltip";

export interface DrawerStock {
  name: string;
  secid: string;
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

function ma(data: number[], n: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    let s = 0;
    for (let j = 0; j < n; j++) s += data[i - j];
    return Number((s / n).toFixed(3));
  });
}

export default function StockDrawer({ stock, onClose }: { stock: DrawerStock | null; onClose: () => void }) {
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [flow, setFlow] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stock) return;
    let alive = true;
    setBars([]);
    setFlow(null);
    setScore(null);
    setLoading(true);
    Promise.all([
      fetch(`/api/stock/kline?secid=${stock.secid}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/stock/flow?secid=${stock.secid}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([k, f]) => {
        if (!alive) return;
        if (k?.klines) setBars(k.klines);
        if (f?.ok) {
          setFlow(f.flow);
          setScore(f.score);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [stock]);

  useEffect(() => {
    if (!stock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [stock, onClose]);

  const klineOption = useMemo<EChartsOption>(() => {
    if (!bars.length) return {};
    const dates = bars.map((b) => b.date.slice(5));
    const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
    const closes = bars.map((b) => b.close);
    return {
      grid: [{ left: 40, right: 10, top: 10, bottom: 20 }],
      tooltip: mkKlineTooltip({ bars: bars as Array<{ date: string; open?: number; close: number; high?: number; low?: number; volume?: number }> }),
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: { fontSize: 9 },
      },
      yAxis: {
        scale: true,
        axisLabel: { fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
      },
      dataZoom: [{ type: "inside", start: Math.max(0, 100 - (60 / bars.length) * 100), end: 100 }],
      series: [
        {
          name: "K线",
          type: "candlestick",
          data: ohlc,
          itemStyle: {
            color: "#dc2626",
            color0: "#16a34a",
            borderColor: "#dc2626",
            borderColor0: "#16a34a",
          },
        },
        // 逐根涨跌幅标注（scatter 叠加）
        mkPctLabel({ bars, show: true, fontSize: 8 }),
        { name: "MA5", type: "line", data: ma(closes, 5), symbol: "none", lineStyle: { width: 1, color: "#f59e0b" } },
        { name: "MA10", type: "line", data: ma(closes, 10), symbol: "none", lineStyle: { width: 1, color: "#3b82f6" } },
        { name: "MA20", type: "line", data: ma(closes, 20), symbol: "none", lineStyle: { width: 1, color: "#8b5cf6" } },
      ],
    };
  }, [bars]);

  const flowOption = useMemo<EChartsOption>(() => {
    const rows: Array<[string, number | null]> = [
      ["今日", flow?.mainNetIn ?? null],
      ["5日", flow?.mainNetIn5 ?? null],
      ["10日", flow?.mainNetIn10 ?? null],
    ];
    const has = rows.some(([, v]) => v != null);
    if (!has) return {};
    return {
      grid: { left: 44, right: 10, top: 20, bottom: 20 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const p = params?.[0];
          if (!p) return "";
          return `${rows[p.dataIndex][0]}主力净额：${(p.value as number) >= 0 ? "+" : ""}${fmtMoney((p.value as number) * 1e8)}`;
        },
      },
      xAxis: { type: "category", data: rows.map((r) => r[0]), axisLabel: { fontSize: 10 } },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 9, formatter: "{value}亿" },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
      },
      series: [
        {
          type: "bar",
          barWidth: 22,
          data: rows.map(([, v]) => {
            const val = v == null ? 0 : v / 1e8;
            return {
              value: val,
              itemStyle: {
                borderRadius: [2, 2, 0, 0],
                color:
                  v == null
                    ? "rgba(128,128,128,0.3)"
                    : v >= 0
                      ? { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#dc2626" }, { offset: 1, color: "rgba(220,38,38,0.3)" }] }
                      : { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#16a34a" }, { offset: 1, color: "rgba(22,163,74,0.3)" }] },
              },
            } as any;
          }),
        },
      ],
    };
  }, [flow]);

  if (!stock) return null;

  const scoreVal = score?.total ?? null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 right-0 w-full max-w-[560px] bg-background border-l border-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-background/95 backdrop-blur border-b border-border">
          <div>
            <p className="font-bold">{stock.name}</p>
            <p className="text-[10px] text-muted font-mono">{stock.secid}</p>
          </div>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-md border border-border hover:border-primary/50" aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">K 线（日线）</p>
            {loading ? (
              <div className="flex items-center justify-center h-[260px] rounded-md border border-border text-xs text-muted">加载中…</div>
            ) : bars.length ? (
              <EChart option={klineOption} height={260} />
            ) : (
              <div className="flex items-center justify-center h-[260px] rounded-md border border-border text-xs text-muted">暂无数据</div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium mb-2">主力资金（今日 / 5 日 / 10 日）</p>
            {loading ? (
              <div className="flex items-center justify-center h-[150px] rounded-md border border-border text-xs text-muted">加载中…</div>
            ) : flow ? (
              <EChart option={flowOption} height={150} />
            ) : (
              <div className="flex items-center justify-center h-[150px] rounded-md border border-border text-xs text-muted">暂无数据</div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium mb-2">资金评分</p>
            {loading ? (
              <p className="text-xs text-muted">评分计算中…</p>
            ) : score ? (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-2xl font-bold font-mono px-2.5 py-1 rounded-lg border ${
                    scoreVal >= 70 ? "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/40 dark:bg-red-950/30"
                    : scoreVal >= 50 ? "text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/40 dark:bg-orange-950/30"
                    : "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                  }`}>
                    {scoreVal}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{score.level}</p>
                    <p className="text-[11px] text-muted">综合评分（0-100）</p>
                  </div>
                </div>
                {score.summary && <p className="text-[11px] text-muted mb-2">{score.summary}</p>}
                {Array.isArray(score.signals) && score.signals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {score.signals.map((s: string, i: number) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">暂无评分数据</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}