"use client";

import { useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { STRATEGIES, backtest, type BacktestBar, type BacktestResult } from "@/lib/data/backtest";
import type { LabBar } from "./KlineLab";

/** 08 策略回测：预设策略库 × 当前标的真实历史数据
 *  引擎复用 lib/data/backtest（全量信号 → 逐笔配对 → 指标与净值曲线）。
 */
export default function BacktestCard({ bars, symbol }: { bars: LabBar[]; symbol: string }) {
  const [strategyId, setStrategyId] = useState(STRATEGIES[0].id);
  const strategy = STRATEGIES.find((s) => s.id === strategyId) ?? STRATEGIES[0];

  const result = useMemo<BacktestResult | null>(
    () => (bars.length >= 60 ? backtest(bars as BacktestBar[], strategy) : null),
    [bars, strategy]
  );

  const option = useMemo<EChartsOption>(() => {
    if (!result) return {};
    const dates = result.equityCurve.map((p) => p.date);
    return {
      animation: false,
      tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
      legend: { top: 0, textStyle: { fontSize: 10 }, data: ["策略净值", "买入持有"] },
      grid: { left: 56, right: 16, top: 30, bottom: 22 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 9 } },
      yAxis: { type: "value", scale: true, axisLabel: { fontSize: 9 } },
      series: [
        {
          name: "策略净值",
          type: "line",
          showSymbol: false,
          data: result.equityCurve.map((p) => p.nav),
          lineStyle: { width: 1.6, color: "#d7000b" },
          itemStyle: { color: "#d7000b" },
          areaStyle: { color: "rgba(215,0,11,0.07)" },
        },
        {
          name: "买入持有",
          type: "line",
          showSymbol: false,
          data: result.equityCurve.map((p) => p.benchmark),
          lineStyle: { width: 1.2, color: "#64748b", type: "dashed" },
          itemStyle: { color: "#64748b" },
        },
      ],
    };
  }, [result]);

  if (bars.length < 60) return <p className="text-sm text-muted py-8 text-center">K 线样本不足 60 根，无法回测（可在上方切换更大周期）。</p>;

  const closed = result?.trades.filter((t) => !t.open) ?? [];
  const stat = (label: string, value: string, tone: "up" | "down" | "plain" = "plain") => (
    <div className="rounded-md border border-border bg-surface/50 px-3 py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`text-lg font-bold font-mono tabular-nums leading-tight ${tone === "up" ? "up" : tone === "down" ? "down" : ""}`}>{value}</p>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-muted">策略：</span>
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStrategyId(s.id)}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors duration-150 ${
              strategyId === s.id ? "bg-primary text-white" : "text-muted hover:text-foreground hover:bg-border/60"
            }`}
            aria-pressed={strategyId === s.id}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted mb-3 leading-relaxed">
        <span className="font-medium text-foreground">{strategy.name}</span>：{strategy.desc} · 标的：{symbol} · 样本 {result?.bars ?? 0} 根（{result?.startDate} → {result?.endDate}）
      </p>

      {result && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {stat("总收益", `${result.totalRet.toFixed(1)}%`, result.totalRet >= 0 ? "up" : "down")}
            {stat("年化", `${result.annualRet.toFixed(1)}%`, result.annualRet >= 0 ? "up" : "down")}
            {stat("最大回撤", `${result.maxDrawdown.toFixed(1)}%`, "down")}
            {stat("胜率", `${result.winRate.toFixed(0)}%`)}
            {stat("夏普", result.sharpe.toFixed(2))}
            {stat("平仓次数", `${result.tradeCount}`)}
          </div>

          <EChart option={option} height={260} />

          <details className="mt-3">
            <summary className="text-xs text-muted cursor-pointer hover:text-primary select-none">
              交易明细（{closed.length} 笔已平仓{result.trades.some((t) => t.open) ? `，另 ${result.trades.filter((t) => t.open).length} 笔持仓中` : ""}）
            </summary>
            <div className="mt-2 rounded-md border border-border overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-xs table-stripe">
                <thead>
                  <tr className="text-muted border-b border-border">
                    <th scope="col" className="text-left px-3 py-1.5">买入日</th>
                    <th scope="col" className="text-right px-2">买价</th>
                    <th scope="col" className="text-left px-3">卖出日</th>
                    <th scope="col" className="text-right px-2">卖价</th>
                    <th scope="col" className="text-right px-3">收益率</th>
                  </tr>
                </thead>
                <tbody>
                  {closed.map((t, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1 font-mono">{t.buyDate}</td>
                      <td className="px-2 text-right font-mono">{t.buyPrice.toFixed(2)}</td>
                      <td className="px-3 font-mono">{t.sellDate ?? "—"}</td>
                      <td className="px-2 text-right font-mono">{t.sellPrice?.toFixed(2) ?? "—"}</td>
                      <td className={`px-3 text-right font-mono font-bold ${(t.retPct ?? 0) >= 0 ? "up" : "down"}`}>
                        {t.retPct == null ? "—" : `${t.retPct >= 0 ? "+" : ""}${t.retPct.toFixed(2)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
