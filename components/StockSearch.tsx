"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { useTheme } from "@/components/theme-provider";
import type { StockHit } from "@/app/api/stock/search/route";
import type { KlineBar } from "@/app/api/stock/kline/route";
import ScorePanel, { FlowPanel } from "@/components/ScorePanel";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useRefresh } from "@/lib/hooks/refresh";
import { SECTOR_LEADERS } from "@/lib/data/leaders";

function ma(data: number[], n: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    let sum = 0;
    for (let j = 0; j < n; j++) sum += data[i - j];
    return Number((sum / n).toFixed(3));
  });
}

export default function StockSearch() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const { items, toggle, has } = useWatchlist();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StockHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<StockHit | null>(null);
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [fund, setFund] = useState<Record<string, number | string> | null>(null);
  const [flow, setFlow] = useState<any>(null);
  const [signals, setSignals] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [err, setErr] = useState("");
  const [loadingK, setLoadingK] = useState(false);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const autoPicked = useRef<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q !== autoPicked.current) {
      autoPicked.current = q;
      setQuery(q);
      fetch(`/api/stock/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then(async (json) => {
          const first = json?.hits?.[0];
          if (first) await pick(first);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const pick = async (hit: StockHit, reset = true) => {
    if (reset) {
      setSelected(hit);
      setShowList(false);
      setQuery(`${hit.name}（${hit.code}）`);
    }
    setErr("");
    setLoadingK(true);
    setFund(null);
    setFlow(null);
    setScore(null);
    setLoadingFlow(true);
    try {
      const [kr, fr, flowR] = await Promise.all([
        fetch(`/api/stock/kline?secid=${hit.secid}`, { cache: "no-store" }),
        hit.kind === "stock" ? fetch(`/api/stock/fundamentals?secid=${hit.secid}`, { cache: "no-store" }) : Promise.resolve(null),
        fetch(`/api/stock/flow?secid=${hit.secid}`, { cache: "no-store" }),
      ]);
      const json = await kr.json();
      if (json?.klines) setBars(json.klines);
      else setErr(json?.error ?? "加载失败");
      if (fr) {
        const fj = await fr.json();
        if (fj?.ok) setFund(fj.data);
      }
      const flowJson = await flowR.json();
      if (flowJson?.ok) {
        setFlow(flowJson.flow);
        setSignals(flowJson.signals);
        setScore(flowJson.score);
      }
    } catch {
      setErr("加载失败，请重试");
    } finally {
      setLoadingK(false);
      setLoadingFlow(false);
    }
  };

  // 选中个股跟随全局自动刷新（不重置选择状态）
  const { refreshKey } = useRefresh();
  useEffect(() => {
    if (selected) pick(selected, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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

      {/* 板块龙头速览：一键直达真实 K 线与资金面 */}
      {!selected && (
        <div className="card p-3">
          <p className="text-xs text-muted mb-2.5">
            板块龙头速览
            <span className="text-[10px] ml-1.5">点击查看真实 K 线 · 资金流 · 评分</span>
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SECTOR_LEADERS.map((g) => (
              <span key={g.sector} className="inline-flex items-baseline gap-1.5 text-xs">
                <span className="text-muted shrink-0">{g.sector}</span>
                {g.stocks.map((s) => (
                  <button
                    key={s.secid}
                    onClick={() =>
                      pick({ name: s.name, code: s.code, secid: s.secid, mkt: s.secid.startsWith("1.") ? "1" : "0", kind: "stock" })
                    }
                    className="font-medium text-foreground/90 hover:text-primary hover:underline transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {loadingK && <p className="text-sm text-muted">正在加载 K 线…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {items.length > 0 && (
        <div className="card p-3">
          <p className="text-xs text-muted mb-2">我的自选（{items.length}）</p>
          <div className="flex flex-wrap gap-2">
            {items.map((w) => (
              <span key={w.secid} className="inline-flex items-center gap-1.5 text-xs rounded-md border border-border px-2 py-1">
                <button onClick={() => pick({ secid: w.secid, code: w.code, name: w.name, kind: w.kind } as StockHit)} className="font-medium hover:text-primary">
                  {w.name}
                </button>
                <span className="text-[10px] text-muted font-mono">{w.code}</span>
                <button onClick={() => toggle(w)} className="text-muted hover:text-red-500" title="移除自选">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {selected && last && (
        <div className="card p-4">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="font-bold">{selected.name}</h2>
            <span className="text-xs text-muted font-mono">{selected.code}</span>
            <div className="flex gap-1 text-[10px]">
              <Link href="/invest" className="px-1.5 py-0.5 rounded bg-muted/50 text-muted hover:text-primary">大盘</Link>
              <Link href="/industry" className="px-1.5 py-0.5 rounded bg-muted/50 text-muted hover:text-primary">产业链</Link>
            </div>
            <button
              onClick={() => toggle({ secid: selected.secid, code: selected.code, name: selected.name, kind: selected.kind === "index" ? "index" : "stock" })}
              className={`ml-2 text-xs px-2 py-1 rounded-md border ${has(selected.secid) ? "border-red-300 text-red-600 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40" : "border-border text-muted hover:border-primary/50"}`}
            >
              {has(selected.secid) ? "★ 已自选" : "☆ 加自选"}
            </button>
            <span className="ml-auto text-xl font-bold font-mono">{last.close}</span>
            <span className={`text-sm font-mono ${pct >= 0 ? "up" : "down"}`}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
            </span>
          </div>
          {fund && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">总市值</p><p className="font-mono font-medium">{fmtMv(fund.totalMv)}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">流通市值</p><p className="font-mono font-medium">{fmtMv(fund.floatMv)}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">市盈率 TTM</p><p className="font-mono font-medium">{fund.pe == null ? "—" : Number(fund.pe).toFixed(2)}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">市净率</p><p className="font-mono font-medium">{fund.pb == null ? "—" : Number(fund.pb).toFixed(2)}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">每股收益 TTM</p><p className="font-mono font-medium">{fund.eps == null ? "—" : Number(fund.eps).toFixed(2)}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">每股净资产</p><p className="font-mono font-medium">{fund.bps == null ? "—" : Number(fund.bps).toFixed(2)}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">换手率</p><p className="font-mono font-medium">{fund.turnover == null ? "—" : `${Number(fund.turnover).toFixed(2)}%`}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">昨收</p><p className="font-mono font-medium">{fund.prevClose == null ? "—" : Number(fund.prevClose).toFixed(2)}</p></div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <ScorePanel data={score} loading={loadingFlow} />
            <FlowPanel data={flow} loading={loadingFlow} />
          </div>
          {signals?.signals?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {signals.signals.map((s: string, i: number) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
              ))}
            </div>
          )}
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

function fmtMv(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}万亿`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  return String(v);
}
