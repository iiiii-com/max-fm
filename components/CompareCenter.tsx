"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EChart from "@/components/charts/EChart";
import { downloadCSV } from "@/components/charts/ChartToolbar";
import type { EChartsOption } from "echarts";
import type { KlineBar } from "@/app/api/stock/kline/route";
import { Search, X, Download, GitCompareArrows, Plus } from "lucide-react";
import { CHART_COLORS } from "@/components/charts/palette";

export interface CmpTarget {
  secid: string;
  name: string;
  code: string;
  kind: "stock" | "index" | "etf";
}

interface LoadedSeries {
  target: CmpTarget;
  bars: KlineBar[];
  rangeChangePct: number;
  lastClose: number;
}

const MAX = 8;
const COLORS = CHART_COLORS;

const KIND_LABEL: Record<CmpTarget["kind"], string> = { stock: "股票", index: "指数", etf: "ETF" };
const KIND_STYLE: Record<CmpTarget["kind"], string> = {
  stock: "bg-red-50 text-red-700 border-red-200",
  index: "bg-blue-50 text-blue-700 border-blue-200",
  etf: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const RANGES = [
  { label: "近 60 日", days: 60 },
  { label: "近 120 日", days: 120 },
  { label: "近 250 日", days: 250 },
];

/** 预置常用标的：一键体验，覆盖三类 */
const PRESETS: CmpTarget[] = [
  { secid: "1.000001", name: "上证指数", code: "000001", kind: "index" },
  { secid: "0.399006", name: "创业板指", code: "399006", kind: "index" },
  { secid: "1.000300", name: "沪深300", code: "000300", kind: "index" },
  { secid: "1.600519", name: "贵州茅台", code: "600519", kind: "stock" },
  { secid: "0.300750", name: "宁德时代", code: "300750", kind: "stock" },
  { secid: "1.510300", name: "沪深300ETF", code: "510300", kind: "etf" },
  { secid: "0.159915", name: "创业板ETF", code: "159915", kind: "etf" },
];

export default function CompareCenter() {
  const [picked, setPicked] = useState<CmpTarget[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CmpTarget[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [rangeIdx, setRangeIdx] = useState(0);
  const [series, setSeries] = useState<LoadedSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // 搜索（股票 + 指数 + ETF 合并）
  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const [sRes, eRes] = await Promise.all([
          fetch(`/api/stock/search?q=${encodeURIComponent(query)}`),
          fetch(`/api/etf/search?q=${encodeURIComponent(query)}`),
        ]);
        const [sj, ej] = await Promise.all([sRes.json(), eRes.json()]);
        const stocks: CmpTarget[] = (sj?.hits ?? []).map((h: any) => ({ secid: h.secid, name: h.name, code: h.code, kind: h.kind }));
        const etfs: CmpTarget[] = (ej?.hits ?? []).map((h: any) => ({ secid: h.secid, name: h.name, code: h.code, kind: "etf" as const }));
        const seen = new Set<string>();
        const merged = [...stocks, ...etfs].filter((h) => {
          if (seen.has(h.secid)) return false;
          seen.add(h.secid);
          return true;
        });
        setHits(merged.slice(0, 10));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const add = (t: CmpTarget) => {
    setPicked((p) => (p.some((x) => x.secid === t.secid) || p.length >= MAX ? p : [...p, t]));
    setQuery("");
    setHits([]);
    setFocused(false);
  };

  const remove = (secid: string) => setPicked((p) => p.filter((x) => x.secid !== secid));

  const clearAll = () => setPicked([]);

  // 加载选中标的 K 线
  useEffect(() => {
    abortRef.current?.abort();
    if (picked.length < 2) {
      setSeries([]);
      setFailed([]);
      setErr("");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr("");
    const days = RANGES[rangeIdx].days;

    Promise.allSettled(
      picked.map(async (t) => {
        const res = await fetch(`/api/stock/kline?secid=${t.secid}`, { cache: "no-store", signal: ctrl.signal });
        const j = await res.json();
        if (!Array.isArray(j?.klines) || !j.klines.length) throw new Error(j?.error ?? "empty");
        const bars: KlineBar[] = j.klines.slice(-days);
        const base = bars[0]?.close ?? 0;
        const last = bars[bars.length - 1]?.close ?? 0;
        return {
          target: t,
          bars,
          rangeChangePct: base > 0 ? ((last - base) / base) * 100 : 0,
          lastClose: last,
        } as LoadedSeries;
      })
    ).then((results) => {
      if (ctrl.signal.aborted) return;
      const ok: LoadedSeries[] = [];
      const bad: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.bars.length > 1) ok.push(r.value);
        else bad.push(picked[i].name);
      });
      setSeries(ok);
      setFailed(bad);
      if (!ok.length) setErr("所选标的的走势数据暂不可用，请更换或减少标的数量");
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [picked, rangeIdx]);

  const chartOption = useMemo<EChartsOption>(() => {
    if (series.length < 2) return {};
    const dateSet = new Set<string>();
    series.forEach((s) => s.bars.forEach((b) => dateSet.add(b.date)));
    const dates = [...dateSet].sort();
    const byDate = series.map((s) => {
      const m = new Map<string, number>();
      const base = s.bars[0]?.close ?? 1;
      s.bars.forEach((b) => m.set(b.date, base > 0 ? Math.round((b.close / base) * 10000) / 100 : 0));
      return m;
    });
    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const d = dates[arr[0]?.dataIndex ?? 0] ?? "";
          const lines = arr.map((p: any) => `${p.marker}${p.seriesName}: ${p.value ?? "—"}`);
          return `<b>${d}</b><br/>${lines.join("<br/>")}`;
        },
      },
      legend: { top: 4, type: "scroll", textStyle: { fontSize: 11 } },
      grid: { left: 52, right: 16, top: 40, bottom: 30 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 10 } },
      yAxis: {
        type: "value",
        scale: true,
        name: "归一化（起点 = 100）",
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10, formatter: "{value}" },
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 16, bottom: 4, start: 0, end: 100 },
      ],
      series: series.map((s, i) => ({
        name: s.target.name,
        type: "line" as const,
        data: dates.map((d) => byDate[i].get(d) ?? null),
        smooth: true,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.8, color: COLORS[i % COLORS.length] },
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
    };
  }, [series]);

  const exportCSV = () => {
    if (series.length < 2) return;
    const dateSet = new Set<string>();
    series.forEach((s) => s.bars.forEach((b) => dateSet.add(b.date)));
    const dates = [...dateSet].sort();
    const byDate = series.map((s) => {
      const m = new Map<string, number>();
      const base = s.bars[0]?.close ?? 1;
      s.bars.forEach((b) => m.set(b.date, base > 0 ? Math.round((b.close / base) * 10000) / 100 : 0));
      return m;
    });
    downloadCSV(
      "compare.csv",
      ["date", ...series.map((s) => s.target.name)],
      dates.map((d, idx) => [d, ...series.map((_, i) => byDate[i].get(d) ?? "")])
    );
  };

  const selectedIds = new Set(picked.map((p) => p.secid));
  const availablePresets = PRESETS.filter((p) => !selectedIds.has(p.secid));

  return (
    <div className="space-y-5">
      {/* 搜索与已选 */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <GitCompareArrows className="w-4.5 h-4.5 text-primary" />
          <h2 className="font-bold text-sm">选择标的</h2>
          <span className="text-[11px] text-muted">搜索任意股票 / 指数 / ETF，或点选下方预置标的，2 - {MAX} 个即可对比</span>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary transition-colors">
            <Search className="w-4 h-4 text-muted shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="输入名称或代码，如「茅台」「600519」「510300」"
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted/70"
            />
            {searching && <span className="text-[11px] text-muted shrink-0">搜索中…</span>}
          </div>
          {focused && query.trim() && (
            <div className="absolute z-30 mt-1.5 w-full rounded-lg border border-border bg-card shadow-lg shadow-black/5 overflow-hidden">
              {hits.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted">{searching ? "搜索中…" : "未找到匹配标的"}</p>
              )}
              {hits.map((h) => (
                <button
                  key={h.secid}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(h);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/5 transition-colors"
                >
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${KIND_STYLE[h.kind]}`}>{KIND_LABEL[h.kind]}</span>
                  <span className="text-sm font-medium">{h.name}</span>
                  <span className="text-xs text-muted font-mono">{h.code}</span>
                  <Plus className="w-3.5 h-3.5 text-muted ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 已选标的 */}
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {picked.map((p, i) => (
              <span
                key={p.secid}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md border border-border text-xs"
                style={{ borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}
              >
                <span className={`text-[10px] px-1 py-px rounded ${KIND_STYLE[p.kind]}`}>{KIND_LABEL[p.kind]}</span>
                <span className="font-medium">{p.name}</span>
                <button onClick={() => remove(p.secid)} className="p-0.5 rounded hover:bg-border/70 text-muted" aria-label={`移除${p.name}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <button onClick={clearAll} className="text-[11px] text-muted hover:text-primary ml-1">
              清空
            </button>
          </div>
        )}

        {/* 预置常用 */}
        {availablePresets.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[11px] text-muted mb-2">常用标的</p>
            <div className="flex flex-wrap gap-2">
              {availablePresets.map((p) => (
                <button
                  key={p.secid}
                  onClick={() => add(p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <span className={`text-[10px] px-1 py-px rounded ${KIND_STYLE[p.kind]}`}>{KIND_LABEL[p.kind]}</span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 图表与统计 */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-1.5">
            {RANGES.map((r, i) => (
              <button
                key={r.days}
                onClick={() => setRangeIdx(i)}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                  rangeIdx === i ? "bg-primary/10 text-primary font-semibold" : "text-muted hover:bg-border/60"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            disabled={series.length < 2}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download className="w-3.5 h-3.5" /> 导出 CSV
          </button>
        </div>

        {picked.length < 2 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted">请先选择 2 个以上标的，走势将以起点 = 100 归一化对比</p>
          </div>
        ) : loading ? (
          <p className="text-sm text-muted py-14 text-center">正在加载走势数据…</p>
        ) : err ? (
          <p className="text-sm text-red-600 py-10 text-center">{err}</p>
        ) : series.length >= 2 ? (
          <>
            <EChart option={chartOption} height={380} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-4">
              {series.map((s, i) => (
                <div key={s.target.secid} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs font-medium truncate">{s.target.name}</span>
                    <span className={`ml-auto text-[10px] px-1 py-px rounded shrink-0 ${KIND_STYLE[s.target.kind]}`}>{KIND_LABEL[s.target.kind]}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={`font-mono text-base font-semibold ${s.rangeChangePct >= 0 ? "up" : "down"}`}>
                      {s.rangeChangePct >= 0 ? "+" : ""}{s.rangeChangePct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-muted font-mono">{s.lastClose.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted py-10 text-center">所选标的走势数据不足，请调整选择</p>
        )}

        {failed.length > 0 && !loading && (
          <p className="text-xs text-muted mt-3">以下标的暂时无法获取走势：{failed.join("、")}</p>
        )}
      </div>
    </div>
  );
}
