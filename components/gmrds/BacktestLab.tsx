"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { STRATEGIES, backtest, type BacktestBar, type BacktestResult } from "@/lib/data/backtest";

interface LabSymbol {
  label: string;
  name: string;
  secid: string;
  kind: "index" | "stock";
}

const LAB_SYMBOLS: LabSymbol[] = [
  { label: "🇨🇳 上证指数", name: "上证指数", secid: "1.000001", kind: "index" },
  { label: "🇨🇳 沪深300", name: "沪深300", secid: "1.000300", kind: "index" },
  { label: "🇨🇳 贵州茅台", name: "贵州茅台", secid: "1.600519", kind: "stock" },
  { label: "🇨🇳 宁德时代", name: "宁德时代", secid: "0.300750", kind: "stock" },
  { label: "🇺🇸 标普500", name: "标普500", secid: "100.SPX", kind: "index" },
  { label: "🇭🇰 恒生指数", name: "恒生指数", secid: "100.HSI", kind: "index" },
];

/** 回测区间：近 3 年（约 750 交易日） */
const DAYS = 750;

export default function BacktestLab() {
  const [sel, setSel] = useState<LabSymbol>(LAB_SYMBOLS[0]);
  const [strategyId, setStrategyId] = useState<string>(STRATEGIES[0].id);
  const [bars, setBars] = useState<BacktestBar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    const api = sel.kind === "index" ? "/api/index/kline" : "/api/stock/kline";
    fetch(`${api}?secid=${sel.secid}&days=${DAYS}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!Array.isArray(j?.klines) || !j.klines.length) throw new Error(j?.error ?? "empty");
        setBars(j.klines);
      })
      .catch((e: any) => !cancelled && setErr(e?.message ?? "数据加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [sel]);

  const strategy = STRATEGIES.find((s) => s.id === strategyId) ?? STRATEGIES[0];
  const result = useMemo<BacktestResult | null>(() => (bars ? backtest(bars, strategy) : null), [bars, strategy]);

  const option = useMemo<EChartsOption>(() => {
    if (!result) return {};
    const dates = result.equityCurve.map((p) => p.date);
    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 12 },
      },
      legend: { top: 2, right: 6, textStyle: { fontSize: 10 }, data: ["策略净值", "买入持有"] },
      grid: { left: 56, right: 16, top: 34, bottom: 24 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 9 } },
      yAxis: { type: "value", scale: true, axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 10000).toFixed(0)}万` } },
      series: [
        {
          name: "策略净值", type: "line", showSymbol: false, smooth: true,
          data: result.equityCurve.map((p) => p.nav),
          lineStyle: { width: 1.6, color: "#d7000b" }, itemStyle: { color: "#d7000b" }, areaStyle: { color: "rgba(215,0,11,0.08)" },
        },
        {
          name: "买入持有", type: "line", showSymbol: false, smooth: true,
          data: result.equityCurve.map((p) => p.benchmark),
          lineStyle: { width: 1.2, color: "#64748b", type: "dashed" }, itemStyle: { color: "#64748b" },
        },
      ],
    };
  }, [result]);

  return (
    <div className="space-y-3">
      {/* 标的选择 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted mr-1">标的：</span>
        {LAB_SYMBOLS.map((s) => (
          <button
            key={s.secid}
            onClick={() => setSel(s)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              sel.secid === s.secid ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {/* 策略选择 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted mr-1">策略：</span>
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStrategyId(s.id)}
            title={s.desc}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              strategyId === s.id ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {s.name}
          </button>
        ))}
        <span className="text-[10px] text-muted ml-1">策略说明：{strategy.desc}</span>
      </div>

      {err ? (
        <p className="text-sm text-destructive py-4 text-center">{err}（数据源受限请切换标的）</p>
      ) : loading || !bars || !result ? (
        <p className="text-sm text-muted py-6 text-center">回测计算中（近 {DAYS} 个交易日真实数据）…</p>
      ) : (
        <>
          {/* 统计卡 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["总收益", `${result.totalRet >= 0 ? "+" : ""}${result.totalRet}%`, result.totalRet >= 0 ? "#d7000b" : "#0aa06e"],
              ["年化收益", `${result.annualRet >= 0 ? "+" : ""}${result.annualRet}%`, result.annualRet >= 0 ? "#d7000b" : "#0aa06e"],
              ["最大回撤", `-${result.maxDrawdown}%`, "#0aa06e"],
              ["胜率 / 交易", `${result.winRate}% / ${result.tradeCount}次`, "#475569"],
            ].map(([label, val, color]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-[10px] text-muted">{label}</p>
                <p className="text-base font-bold font-mono" style={{ color: String(color) }}>{val}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["夏普比率", `${result.sharpe}`],
              ["初始资金", `${result.initial.toLocaleString()}`],
              ["期末净值", `${result.final.toLocaleString()}`],
              ["区间", `${result.startDate.slice(0, 7)} ~ ${result.endDate.slice(0, 7)}（${result.bars} 根）`],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <p className="text-[10px] text-muted">{label}</p>
                <p className="text-sm font-bold font-mono">{val}</p>
              </div>
            ))}
          </div>

          {/* 净值曲线 */}
          <div className="rounded-lg border border-border bg-card p-2">
            <EChart option={option} height={280} />
          </div>

          <p className="text-[10px] text-muted leading-relaxed">
            方法：全仓买卖、次日开盘成交、双边佣金 0.03%；基准=买入持有。回测基于真实行情（{result.symbol} 区间），仅供研究演示，
            历史表现不代表未来收益，不构成投资建议。策略信号可对照 K 线实验台的买卖点扫描（环节 7）。
          </p>
        </>
      )}
    </div>
  );
}
