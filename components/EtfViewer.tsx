"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { useTheme } from "@/components/theme-provider";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import type { KlineBar } from "@/app/api/stock/kline/route";

interface EtfHit {
  code: string;
  name: string;
  secid: string;
}

interface EtfQuote {
  code: string;
  name: string;
  price: number;
  prevClose: number;
  changePct: number;
  nav: number;
  premiumPct: number;
  turnover: number;
  amount: number;
  scale: number;
}

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`;
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

export default function EtfViewer() {
  const { theme } = useTheme();
  const { items, toggle, has } = useWatchlist();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<EtfHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<EtfHit | null>(null);
  const [quote, setQuote] = useState<EtfQuote | null>(null);
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [signals, setSignals] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/etf/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
        const json = await res.json();
        setHits(json?.hits || []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pick = async (hit: EtfHit) => {
    setSelected(hit);
    setShowList(false);
    setQuery(`${hit.name}（${hit.code}）`);
    setErr("");
    setLoading(true);
    setQuote(null);
    setBars([]);
    setSignals([]);
    try {
      const [qr, kr] = await Promise.all([
        fetch(`/api/etf/quote?secid=${hit.secid}`, { cache: "no-store" }),
        fetch(`/api/stock/kline?secid=${hit.secid}`, { cache: "no-store" }),
      ]);
      const qj = await qr.json();
      if (qj?.ok) {
        setQuote(qj.quote);
        setSignals(qj.signals?.signals ?? []);
      } else setErr(qj?.error ?? "加载失败");
      const kj = await kr.json();
      if (kj?.klines) setBars(kj.klines);
    } catch {
      setErr("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const option = useMemo<EChartsOption>(() => {
    if (!bars.length) return {};
    const dates = bars.map((b) => b.date.slice(5));
    const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => ({
      value: b.volume,
      itemStyle: { color: b.close >= b.open ? "rgba(220,38,38,0.6)" : "rgba(22,163,74,0.6)" },
    }));
    const upColor = "#dc2626";
    const downColor = "#16a34a";
    return {
      animation: false,
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: { data: ["MA5", "MA10", "MA20"], top: 4, textStyle: { fontSize: 11 } },
      grid: [
        { left: 52, right: 16, top: 32, height: "58%" },
        { left: 52, right: 16, top: "76%", height: "16%" },
      ],
      xAxis: [
        { type: "category", data: dates, gridIndex: 0, axisLabel: { fontSize: 10 }, boundaryGap: true },
        { type: "category", data: dates, gridIndex: 1, axisLabel: { show: false }, boundaryGap: true },
      ],
      yAxis: [
        { type: "value", scale: true, gridIndex: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
        { type: "value", gridIndex: 1, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1], start: 40, end: 100 },
        { type: "slider", xAxisIndex: [0, 1], height: 16, bottom: 4, start: 40, end: 100 },
      ],
      series: [
        {
          name: "K 线", type: "candlestick", data: ohlc,
          itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor },
        },
        { name: "MA5", type: "line", data: closes.map((_, i) => i < 4 ? null : closes.slice(i - 4, i + 1).reduce((a, c) => a + c, 0) / 5), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#f59e0b" } },
        { name: "MA10", type: "line", data: closes.map((_, i) => i < 9 ? null : closes.slice(i - 9, i + 1).reduce((a, c) => a + c, 0) / 10), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#3b82f6" } },
        { name: "MA20", type: "line", data: closes.map((_, i) => i < 19 ? null : closes.slice(i - 19, i + 1).reduce((a, c) => a + c, 0) / 20), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#8b5cf6" } },
        { name: "成交量", type: "bar", data: volumes, xAxisIndex: 1, yAxisIndex: 1 },
      ],
    };
  }, [bars]);

  useEffect(() => {
    if (!divRef.current || !bars.length) return;
    chartRef.current?.dispose();
    chartRef.current = echarts.init(divRef.current, theme === "dark" ? "dark" : undefined);
    chartRef.current.setOption(option, true);
    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [option, bars, theme]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowList(true);
            if (!e.target.value.trim()) { setHits([]); setSearching(false); }
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 200)}
          placeholder="搜索 ETF，如：半导体ETF / 510300 / 科创50"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/60"
        />
        {showList && query.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-background shadow-lg max-h-72 overflow-auto">
            {searching && <p className="px-4 py-2 text-sm text-muted">搜索中…</p>}
            {!searching && hits.length === 0 && <p className="px-4 py-2 text-sm text-muted">未找到匹配 ETF</p>}
            {hits.map((h) => (
              <button
                key={h.secid}
                onMouseDown={(e) => { e.preventDefault(); pick(h); }}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-primary/5"
              >
                <span className="text-sm font-medium">{h.name}</span>
                <span className="text-xs text-muted font-mono">{h.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="card p-3">
          <p className="text-xs text-muted mb-2">我的自选（{items.length}）</p>
          <div className="flex flex-wrap gap-2">
            {items.map((w) => (
              <span key={w.secid} className="inline-flex items-center gap-1.5 text-xs rounded-md border border-border px-2 py-1">
                <button onClick={() => pick({ secid: w.secid, code: w.code, name: w.name } as EtfHit)} className="font-medium hover:text-primary">{w.name}</button>
                <span className="text-[10px] text-muted font-mono">{w.code}</span>
                <button onClick={() => toggle(w)} className="text-muted hover:text-red-500" title="移除自选">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-muted">正在加载 ETF 数据…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {selected && quote && (
        <div className="card p-4">
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="font-bold">{quote.name}</h2>
            <span className="text-xs text-muted font-mono">{quote.code}</span>
            <button
              onClick={() => toggle({ secid: selected.secid, code: quote.code, name: quote.name, kind: "etf" })}
              className={`ml-2 text-xs px-2 py-1 rounded-md border ${has(selected.secid) ? "border-red-300 text-red-600 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40" : "border-border text-muted hover:border-primary/50"}`}
            >
              {has(selected.secid) ? "★ 已自选" : "☆ 加自选"}
            </button>
            <span className="ml-auto text-xl font-bold font-mono">{quote.price.toFixed(3)}</span>
            <span className={`text-sm font-mono ${quote.changePct >= 0 ? "up" : "down"}`}>
              {quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}%
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
            <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">IOPV 参考净值</p><p className="font-mono font-medium">{quote.nav.toFixed(3)}</p></div>
            <div className={`rounded-lg border px-3 py-2 ${quote.premiumPct >= 0 ? "border-red-200 bg-red-50/50 dark:border-red-900/40" : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40"}`}>
              <p className="text-muted">溢价率</p>
              <p className={`font-mono font-medium ${quote.premiumPct >= 0 ? "up" : "down"}`}>{quote.premiumPct >= 0 ? "+" : ""}{quote.premiumPct.toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">规模</p><p className="font-mono font-medium">{fmtMoney(quote.scale)}</p></div>
            <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">成交额</p><p className="font-mono font-medium">{fmtMoney(quote.amount)}</p></div>
          </div>
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {signals.map((s, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
              ))}
            </div>
          )}
          <div ref={divRef} style={{ height: 380, width: "100%" }} />
          <p className="text-xs text-muted mt-2">溢价率为正表示场内价格高于净值（有溢价买入风险）；数据约 2 分钟延迟，仅供研究参考</p>
        </div>
      )}

      {!selected && (
        <div className="card p-6 text-center text-sm text-muted">
          搜索或选择自选 ETF，查看行情、溢价率与 K 线走势
        </div>
      )}
    </div>
  );
}