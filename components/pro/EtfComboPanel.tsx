"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, RefreshCw, X } from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

/**
 * 专业版：ETF 组合对比与相关性。
 *
 * 与普通版 `/market?tab=etf` 的对比面板区别（也是升级理由）：
 *  - 普通版：任意 2–6 只 ETF 归一化走势 + 区间收益/回撤；
 *  - 专业版（这里）：在同样归一化走势之外，给出**日收益相关矩阵**、
 *    等权组合的年化波动/最大回撤/平均相关性/分散度，并可导出 CSV 留档。
 *
 * 数据口径：全部用 /api/stock/kline 的前复权日线收盘（ETF 无复权设置时退原始价），
 * 取所选窗口内**所有标的共同交易日**对齐，避免缺日导致收益错位；不做任何模拟填充。
 */

interface ComboItem {
  code: string;
  name: string;
  secid: string;
}

const DEFAULT_ITEMS: ComboItem[] = [
  { code: "510300", name: "沪深300ETF", secid: "1.510300" },
  { code: "512480", name: "半导体ETF", secid: "1.512480" },
  { code: "515790", name: "光伏ETF", secid: "1.515790" },
  { code: "512690", name: "酒ETF", secid: "1.512690" },
  { code: "518880", name: "黄金ETF", secid: "1.518880" },
  { code: "513100", name: "纳指ETF", secid: "1.513100" },
];

const RANGES = [
  { days: 22, label: "1 个月" },
  { days: 66, label: "3 个月" },
  { days: 130, label: "6 个月" },
  { days: 250, label: "1 年" },
];

const MAX_ITEMS = 6;
const COLORS = ["#c0392b", "#1d4ed8", "#1e8449", "#b45309", "#7c3aed", "#0891b2"];

interface Series {
  item: ComboItem;
  dates: string[];
  closes: number[];
}

interface ComboStats {
  item: ComboItem;
  ret: number;
  vol: number;
  maxDrawdown: number;
  latest: number;
}

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function returnsOf(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  return out;
}

function maxDrawdownOf(closes: number[]): number {
  let peak = closes[0] ?? 0;
  let mdd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    if (peak > 0) mdd = Math.min(mdd, (c - peak) / peak);
  }
  return mdd * 100;
}

function corr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va <= 0 || vb <= 0) return 0;
  return cov / Math.sqrt(va * vb);
}

function alignSeries(list: Series[], window: number): { dates: string[]; closes: number[][] } {
  if (!list.length) return { dates: [], closes: [] };
  let common: string[] = list[0].dates.slice();
  for (const s of list.slice(1)) {
    const set = new Set(s.dates);
    common = common.filter((d) => set.has(d));
  }
  common.sort();
  if (common.length > window) common = common.slice(-window);
  const maps = list.map((s) => {
    const m = new Map<string, number>();
    s.dates.forEach((d, i) => m.set(d, s.closes[i]));
    return m;
  });
  const closes = maps.map((m) => common.map((d) => m.get(d) as number));
  return { dates: common, closes };
}

export default function EtfComboPanel() {
  const [items, setItems] = useState<ComboItem[]>(DEFAULT_ITEMS);
  const [rangeDays, setRangeDays] = useState(66);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ComboItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (items.length < 2) return;
    setLoading(true);
    setErr("");
    try {
      const results = await Promise.all(
        items.map(async (item) => {
          try {
            const res = await fetch(
              `/api/stock/kline?secid=${encodeURIComponent(item.secid)}&period=day&days=${rangeDays + 12}`,
              { cache: "no-store" },
            );
            const json = await res.json();
            const bars: Array<{ date: string; close: number }> = json?.klines ?? [];
            return {
              item,
              dates: bars.map((b) => b.date),
              closes: bars.map((b) => b.close),
            } as Series;
          } catch {
            return { item, dates: [], closes: [] } as Series;
          }
        }),
      );
      const ok = results.filter((s) => s.closes.length >= 2);
      if (ok.length < 2) {
        setErr("所选 ETF 的 K 线数据不足，暂无法计算组合与相关性，请稍后重试");
        setSeries([]);
      } else if (ok.length < items.length) {
        setErr(`有 ${items.length - ok.length} 只 ETF 的 K 线暂不可用，已按其余标的计算`);
        setSeries(ok);
      } else {
        setSeries(ok);
      }
      setUpdatedAt(Date.now());
    } catch {
      setErr("数据加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [items, rangeDays]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/etf/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
        const json = await r.json();
        setHits((json?.hits ?? []).slice(0, 6));
      } catch {
        setHits([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const add = (hit: ComboItem) => {
    if (items.some((x) => x.secid === hit.secid)) return;
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, hit]);
    setQuery("");
    setHits([]);
  };
  const remove = (secid: string) => setItems((prev) => prev.filter((x) => x.secid !== secid));

  const aligned = useMemo(() => alignSeries(series, rangeDays), [series, rangeDays]);

  const stats = useMemo<ComboStats[]>(() => {
    if (!aligned.closes.length) return [];
    return series.map((s, i) => {
      const closes = aligned.closes[i].filter((c) => c != null);
      const ret = closes.length >= 2 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : 0;
      const vol = std(returnsOf(closes)) * Math.sqrt(252) * 100;
      return {
        item: s.item,
        ret,
        vol,
        maxDrawdown: maxDrawdownOf(closes),
        latest: closes[closes.length - 1] ?? 0,
      };
    });
  }, [aligned, series]);

  const corrMatrix = useMemo(() => {
    if (aligned.closes.length < 2) return [] as number[][];
    const rets = aligned.closes.map((c) => returnsOf(c.filter((x) => x != null)));
    return rets.map((a) => rets.map((b) => corr(a, b)));
  }, [aligned]);

  const portfolio = useMemo(() => {
    if (aligned.closes.length < 2) return null;
    const rets = aligned.closes.map((c) => returnsOf(c.filter((x) => x != null)));
    const n = Math.min(...rets.map((r) => r.length));
    if (n < 2) return null;
    const equal = new Array(n).fill(0).map((_, i) => rets.reduce((a, r) => a + r[i], 0) / rets.length);
    const vol = std(equal) * Math.sqrt(252) * 100;
    const total = (equal.reduce((a, r) => a * (1 + r), 1) - 1) * 100;
    let idx = 100;
    let peak = 100;
    let mdd = 0;
    for (const r of equal) {
      idx *= 1 + r;
      if (idx > peak) peak = idx;
      mdd = Math.min(mdd, (idx - peak) / peak);
    }
    const avgCorr = corrMatrix.length
      ? (() => {
          let sum = 0;
          let count = 0;
          for (let i = 0; i < corrMatrix.length; i++)
            for (let j = i + 1; j < corrMatrix.length; j++) {
              sum += corrMatrix[i][j];
              count++;
            }
          return count ? sum / count : 0;
        })()
      : 0;
    return { vol, total, mdd: mdd * 100, avgCorr, dispersion: 1 - avgCorr };
  }, [aligned, corrMatrix]);

  const option = useMemo<EChartsOption>(() => {
    if (!aligned.dates.length) return {};
    return {
      animation: false,
      tooltip: { trigger: "axis" },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      grid: { left: 48, right: 20, top: 34, bottom: 28 },
      xAxis: {
        type: "category",
        data: aligned.dates.map((d) => d.slice(5)),
        axisLabel: { fontSize: 10 },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { fontSize: 10, formatter: "{value}" },
        splitLine: { lineStyle: { opacity: 0.35 } },
      },
      series: aligned.closes.map((closes, i) => {
        const base = closes.find((c) => c != null) ?? 1;
        return {
          name: series[i]?.item.name ?? `标的 ${i + 1}`,
          type: "line",
          data: closes.map((c) => (c == null ? null : Number(((c / base) * 100).toFixed(2)))),
          showSymbol: false,
          lineStyle: { width: 1.6, color: COLORS[i % COLORS.length] },
          itemStyle: { color: COLORS[i % COLORS.length] },
        };
      }),
    };
  }, [aligned, series]);

  const exportCsv = () => {
    if (!stats.length) return;
    const lines: string[] = [];
    lines.push(`ETF 组合对比与相关性（窗口 ${rangeDays} 个交易日，共同交易日对齐）`);
    lines.push(`导出时间,${new Date().toLocaleString("zh-CN", { hour12: false })}`);
    lines.push("");
    lines.push("标的,代码,最新价,区间收益%,年化波动%,最大回撤%");
    for (const s of stats) {
      lines.push([s.item.name, s.item.code, s.latest.toFixed(3), s.ret.toFixed(2), s.vol.toFixed(2), s.maxDrawdown.toFixed(2)].join(","));
    }
    if (portfolio) {
      lines.push("");
      lines.push("等权组合,区间收益%,年化波动%,最大回撤%,平均相关性,分散度");
      lines.push(
        ["等权组合", portfolio.total.toFixed(2), portfolio.vol.toFixed(2), portfolio.mdd.toFixed(2), portfolio.avgCorr.toFixed(3), portfolio.dispersion.toFixed(3)].join(","),
      );
    }
    if (corrMatrix.length) {
      lines.push("");
      lines.push(["相关矩阵", ...stats.map((s) => s.item.code)].join(","));
      stats.forEach((s, i) => {
        lines.push([s.item.code, ...corrMatrix[i].map((v) => v.toFixed(3))].join(","));
      });
    }
    lines.push("");
    lines.push("口径：前复权日线收盘；相关系数为日收益 Pearson；年化波动按 √252 折算；最大回撤为区间内峰值回撤。");
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etf-combo-${rangeDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <p className="text-xs font-bold">对比标的（{items.length}/{MAX_ITEMS}）</p>
          {items.map((it) => (
            <span key={it.secid} className="inline-flex items-center gap-1 text-[11px] rounded-md border border-border px-2 py-1">
              <span className="font-medium">{it.name}</span>
              <span className="text-[10px] text-muted font-mono">{it.code}</span>
              <button onClick={() => remove(it.secid)} className="text-muted hover:text-red-500" title="移除">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {items.length < MAX_ITEMS && (
            <span className="relative inline-flex items-center gap-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 ETF 添加…"
                className="text-[11px] rounded-md border border-border px-2 py-1 w-36 bg-transparent"
              />
              <Plus className="w-3 h-3 text-muted" />
              {hits.length > 0 && (
                <span className="absolute z-10 top-full left-0 mt-1 w-52 rounded-md border border-border bg-surface shadow-lg overflow-hidden">
                  {hits.map((h) => (
                    <button
                      key={h.secid}
                      onClick={() => add(h)}
                      className="block w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-primary/10"
                    >
                      {h.name} <span className="text-[10px] text-muted font-mono">{h.code}</span>
                    </button>
                  ))}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={`px-2.5 py-1 ${rangeDays === r.days ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> 重新计算
          </button>
          <button
            onClick={exportCsv}
            disabled={!stats.length}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 disabled:opacity-50"
          >
            <Download className="w-3 h-3" /> 导出 CSV
          </button>
          {updatedAt && (
            <span className="text-[10px] text-muted ml-auto">
              {new Date(updatedAt).toLocaleTimeString("zh-CN", { hour12: false })} 计算
            </span>
          )}
        </div>
        {err && <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">{err}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card p-4 lg:col-span-2">
          <p className="text-xs font-bold mb-2">同窗口归一化走势（起点 = 100）</p>
          {loading && !aligned.dates.length ? (
            <div className="h-[320px] rounded bg-muted/20 animate-pulse" />
          ) : (
            <EChart option={option} height={320} />
          )}
          <p className="text-[10px] text-muted mt-2">共同交易日对齐 · 共 {aligned.dates.length} 根日线 · 前复权收盘</p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-bold mb-2">等权组合</p>
          {portfolio ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border px-2.5 py-2">
                <p className="text-muted text-[10px]">区间收益</p>
                <p className={`font-mono font-bold ${portfolio.total >= 0 ? "up" : "down"}`}>{pct(portfolio.total)}</p>
              </div>
              <div className="rounded-lg border border-border px-2.5 py-2">
                <p className="text-muted text-[10px]">年化波动</p>
                <p className="font-mono font-bold">{portfolio.vol.toFixed(2)}%</p>
              </div>
              <div className="rounded-lg border border-border px-2.5 py-2">
                <p className="text-muted text-[10px]">最大回撤</p>
                <p className="font-mono font-bold down">{portfolio.mdd.toFixed(2)}%</p>
              </div>
              <div className="rounded-lg border border-border px-2.5 py-2">
                <p className="text-muted text-[10px]">平均相关性</p>
                <p className="font-mono font-bold">{portfolio.avgCorr.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-border px-2.5 py-2 col-span-2">
                <p className="text-muted text-[10px]">分散度（1 − 平均相关）</p>
                <p className="font-mono font-bold">{portfolio.dispersion.toFixed(2)}</p>
                <p className="text-[10px] text-muted mt-1 leading-relaxed">
                  越接近 1 说明标的间走势越独立；接近 0 说明组合被同一风险因子主导，等权分散效果有限。
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted">数据不足，暂无法计算组合指标</p>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="card p-4 overflow-x-auto">
            <p className="text-xs font-bold mb-2">单只指标（{rangeDays} 个交易日）</p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="py-1.5 pr-2 font-medium">标的</th>
                  <th className="py-1.5 pr-2 font-medium text-right">最新价</th>
                  <th className="py-1.5 pr-2 font-medium text-right">区间收益</th>
                  <th className="py-1.5 pr-2 font-medium text-right">年化波动</th>
                  <th className="py-1.5 font-medium text-right">最大回撤</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.item.secid} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">{s.item.name}</span>
                      <span className="text-[10px] text-muted font-mono ml-1">{s.item.code}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">{s.latest.toFixed(3)}</td>
                    <td className={`py-1.5 pr-2 text-right font-mono ${s.ret >= 0 ? "up" : "down"}`}>{pct(s.ret)}</td>
                    <td className="py-1.5 pr-2 text-right font-mono">{s.vol.toFixed(2)}%</td>
                    <td className="py-1.5 text-right font-mono down">{s.maxDrawdown.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-4 overflow-x-auto">
            <p className="text-xs font-bold mb-2">日收益相关矩阵</p>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 pr-1 text-left font-medium">—</th>
                  {stats.map((s) => (
                    <th key={s.item.secid} className="py-1 px-1 font-medium text-center" title={s.item.name}>
                      {s.item.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.item.secid}>
                    <td className="py-1 pr-1 font-medium text-[10px] whitespace-nowrap" title={s.item.name}>
                      {s.item.name}
                    </td>
                    {stats.map((t, j) => {
                      const v = corrMatrix[i]?.[j] ?? 0;
                      const bg =
                        v >= 0
                          ? `rgba(192,57,43,${Math.min(0.85, Math.abs(v) * 0.7)})`
                          : `rgba(30,132,73,${Math.min(0.85, Math.abs(v) * 0.7)})`;
                      const fg = Math.abs(v) > 0.62 ? "#fff" : "inherit";
                      return (
                        <td key={t.item.secid} className="py-1 px-1 text-center font-mono" style={{ background: i === j ? "var(--color-border)" : bg, color: fg }}>
                          {v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-muted mt-2 leading-relaxed">
              日收益 Pearson 相关：红色为正相关（同涨同跌），绿色为负相关（对冲效果）。对角线恒为 1。
            </p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted leading-relaxed">
        口径与限制：日线来自东财/新浪多源容错接口（前复权），窗口按所选交易日数取共同交易日；相关性基于日收益而非价格；
        组合为等权、每日再平衡近似，未计交易成本。免费版可在{" "}
        <Link href="/market?tab=etf" className="text-primary hover:underline">ETF 专区</Link>
        查看行情、K 线与基础对比；专业版额外提供相关矩阵、组合波动/回撤与导出。
      </p>
    </div>
  );
}
