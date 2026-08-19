"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { StockHit } from "@/app/api/stock/search/route";
import type { KlineBar } from "@/app/api/stock/kline/route";

function ma(data: number[], n: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    let sum = 0;
    for (let j = 0; j < n; j++) sum += data[i - j];
    return Number((sum / n).toFixed(3));
  });
}

export default function StockSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StockHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<StockHit | null>(null);
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [err, setErr] = useState("");
  const [loadingK, setLoadingK] = useState(false);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
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

  const pick = async (hit: StockHit) => {
    setSelected(hit);
    setShowList(false);
    setQuery(`${hit.name}（${hit.code}）`);
    setErr("");
    setLoadingK(true);
    try {
      const res = await fetch(`/api/stock/kline?secid=${hit.secid}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.klines) setBars(json.klines);
      else setErr(json?.error ?? "加载失败");
    } catch {
      setErr("加载失败，请重试");
    } finally {
      setLoadingK(false);
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
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params: any) => {
          const i = params[0]?.dataIndex ?? 0;
          const b = bars[i];
          if (!b) return "";
          const lines = params.map((p: any) => `${p.marker}${p.seriesName}: ${p.value ?? "—"}`).join("<br/>");
          return `${b.date}<br/>开 ${b.open}　高 ${b.high}<br/>收 ${b.close}　低 ${b.low}<br/>${lines}<br/>量 ${fmtVol(b.volume)}`;
        },
      },
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
        { name: "MA5", type: "line", data: ma(closes, 5), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#f59e0b" } },
        { name: "MA10", type: "line", data: ma(closes, 10), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#3b82f6" } },
        { name: "MA20", type: "line", data: ma(closes, 20), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#8b5cf6" } },
        { name: "成交量", type: "bar", data: volumes, xAxisIndex: 1, yAxisIndex: 1 },
      ],
    };
  }, [bars]);

  useEffect(() => {
    if (!divRef.current || !bars.length) return;
    if (!chartRef.current) chartRef.current = echarts.init(divRef.current);
    chartRef.current.setOption(option, true);
    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [option, bars]);

  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null; }, []);

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const pct = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;

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
          placeholder="输入股票名称或代码，如：平安 / 601318"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/60"
        />
        {showList && query.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-background shadow-lg max-h-72 overflow-auto">
            {searching && <p className="px-4 py-2 text-sm text-muted">搜索中…</p>}
            {!searching && hits.length === 0 && <p className="px-4 py-2 text-sm text-muted">未找到匹配标的</p>}
            {hits.map((h) => (
              <button
                key={h.secid}
                onMouseDown={(e) => { e.preventDefault(); pick(h); }}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-primary/5"
              >
                <span className="text-sm font-medium">{h.name}</span>
                <span className="text-xs text-muted font-mono">{h.code}</span>
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${h.kind === "index" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                  {h.kind === "index" ? "指数" : "股票"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingK && <p className="text-sm text-muted">正在加载 K 线…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {selected && last && (
        <div className="card p-4">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="font-bold">{selected.name}</h2>
            <span className="text-xs text-muted font-mono">{selected.code}</span>
            <span className="ml-auto text-xl font-bold font-mono">{last.close}</span>
            <span className={`text-sm font-mono ${pct >= 0 ? "up" : "down"}`}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
            </span>
          </div>
          <div ref={divRef} style={{ height: 420, width: "100%" }} />
          <p className="text-xs text-muted mt-2">日 K · 前复权 · 数据来自东方财富公开接口，约 2 分钟延迟，仅供研究参考</p>
        </div>
      )}

      {!selected && (
        <div className="card p-6 text-center text-sm text-muted">
          输入名称或代码搜索 A 股（含指数），回车或点击结果查看 K 线走势
        </div>
      )}
    </div>
  );
}

function fmtVol(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return String(n);
}
