"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "@/components/charts/echarts";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useRefresh } from "@/lib/hooks/refresh";
import { THEME_ETFS, ETF_CAT_TONE, type ThemeEtf } from "@/lib/data/leaders";
import type { KlineBar } from "@/app/api/stock/kline/route";
import { mkMainAxis, mkSubAxis } from "@/lib/data/axis";
import LeaderKlineGrid from "@/components/LeaderKlineGrid";
import AnnotatableChart from "@/components/charts/AnnotatableChart";
import DailyMoveBadge from "@/components/charts/DailyMoveBadge";
import { mkKlineTooltip, mkPctLabel } from "@/lib/data/kline-tooltip";

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

function fmtVol(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return String(n);
}

export default function EtfViewer() {
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
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [showPct, setShowPct] = useState(true);
  const [pctPos, setPctPos] = useState<"top" | "bottom">("top");
  const [pctFont, setPctFont] = useState(9);
  // 缩放可视范围联动：涨跌幅标注随缩放全标可视区，不遗漏任何一根
  const [vRange, setVRange] = useState<[number, number] | null>(null);
  const onZoom = useCallback((e?: unknown) => {
    const ev = e as { batch?: Array<{ start?: number; end?: number }> } | undefined;
    const b = ev?.batch?.[0];
    // 始终更新 vRange：快速连续缩放时保持最新可视区间，避免 option 重建重置 dataZoom
    if (b && typeof b.start === "number" && typeof b.end === "number") {
      setVRange([b.start as number, b.end as number]);
    }
  }, []);
  const [kTime, setKTime] = useState<number | null>(null);
  const [etfCat, setEtfCat] = useState<"全部" | ThemeEtf["cat"]>("全部");

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

  const pick = async (hit: EtfHit, reset = true) => {
    if (reset) {
      setSelected(hit);
      setShowList(false);
      setQuery(`${hit.name}（${hit.code}）`);
    }
    setErr("");
    setLoading(true);
    setQuote(null);
    setBars([]);
    setSignals([]);
    try {
      const [qr, kr] = await Promise.all([
        fetch(`/api/etf/quote?secid=${hit.secid}`, { cache: "no-store" }),
        fetch(`/api/stock/kline?secid=${hit.secid}&period=${period}`, { cache: "no-store" }),
      ]);
      const qj = await qr.json();
      if (qj?.ok) {
        setQuote(qj.quote);
        setSignals(qj.signals?.signals ?? []);
      } else setErr(qj?.error ?? "加载失败");
      const kj = await kr.json();
      if (kj?.klines) {
        setBars(kj.klines);
        setKTime(Date.now());
      }
    } catch {
      setErr("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 选中标的跟随全局自动刷新（不重置选择状态）
  const { refreshKey } = useRefresh();
  useEffect(() => {
    if (selected) pick(selected, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, period]);

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
      tooltip: mkKlineTooltip({ bars, formatter: (params: any) => {
        const i = params[0]?.dataIndex ?? 0;
        const b = bars[i];
        if (!b) return "";
        const lines = params.map((p: any) => `${p.marker}${p.seriesName}: ${p.value ?? "—"}`).join("<br/>");
        return `<div style="font-size:12px;line-height:1.6"><b>${b.date}</b><br/>开 ${b.open}　高 ${b.high}<br/>收 ${b.close}　低 ${b.low}<br/>${lines}<br/>量 ${fmtVol(b.volume)}</div>`;
      } }),
      legend: { data: ["MA5", "MA10", "MA20"], top: 4, textStyle: { fontSize: 11 } },
      grid: [
        { left: 52, right: 16, top: 32, height: "58%" },
        { left: 52, right: 16, top: "76%", height: "16%" },
      ],
      xAxis: [
        {
          ...mkMainAxis({ dataLength: dates.length, period: "day", firstDate: dates[0], lastDate: dates[dates.length - 1] }),
          data: dates,
        },
        { ...mkSubAxis(dates.length, 1), data: dates },
      ],
      yAxis: [
        { type: "value", scale: true, gridIndex: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#292929", type: "dashed" } } },
        { type: "value", gridIndex: 1, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1], start: vRange?.[0] ?? 0, end: vRange?.[1] ?? 100, zoomOnMouseWheel: true },
        { type: "slider", xAxisIndex: [0, 1], height: 16, bottom: 4, start: vRange?.[0] ?? 0, end: vRange?.[1] ?? 100 },
      ],
      series: [
        {
          name: "K 线", type: "candlestick", data: ohlc,
          itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor },
        },
        // 逐根涨跌幅标注（scatter 叠加）
        mkPctLabel({ bars, show: showPct, position: pctPos, fontSize: pctFont, pctRange: vRange }),
        { name: "MA5", type: "line", data: closes.map((_, i) => i < 4 ? null : closes.slice(i - 4, i + 1).reduce((a, c) => a + c, 0) / 5), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#f59e0b" } },
        { name: "MA10", type: "line", data: closes.map((_, i) => i < 9 ? null : closes.slice(i - 9, i + 1).reduce((a, c) => a + c, 0) / 10), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#3b82f6" } },
        { name: "MA20", type: "line", data: closes.map((_, i) => i < 19 ? null : closes.slice(i - 19, i + 1).reduce((a, c) => a + c, 0) / 20), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#8b5cf6" } },
        { name: "成交量", type: "bar", data: volumes, xAxisIndex: 1, yAxisIndex: 1 },
      ],
    };
  }, [bars, showPct, pctPos, pctFont, vRange]);

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

      {/* 热门主题 ETF：分类筛选 + 一键直达真实 K 线 */}
      {!selected && (
        <div className="card p-3">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
            <p className="text-xs text-muted">
              热门主题 ETF
              <span className="text-[10px] ml-1.5">点击查看真实 K 线 · 持仓 · 信号</span>
            </p>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(["全部", "宽基", "行业", "跨境"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setEtfCat(c)}
                  className={`px-2 py-0.5 ${etfCat === c ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {THEME_ETFS.filter((t) => etfCat === "全部" || t.cat === etfCat).map((t) => (
              <button
                key={t.secid}
                onClick={() => pick({ secid: t.secid, code: t.code, name: t.name })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs hover:border-primary/50 hover:text-primary transition-colors"
              >
                {t.name}
                <span className={`text-[9px] px-1 rounded ${ETF_CAT_TONE[t.cat]}`}>{t.cat}</span>
                <span className="text-[10px] text-muted font-mono">{t.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* 主题 ETF K 线速览：近 60 日走势 + MA 指标（仅未选中时展示） */}
      {!selected && (
        <div className="card p-3">
          <p className="text-xs text-muted mb-2.5">
            热门 ETF K 线速览
            <span className="text-[10px] ml-1.5">近 60 日 K 线 + MA5/MA20 · 点击卡片直达详情</span>
          </p>
          <LeaderKlineGrid defaultTab="etf" />
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
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(["day", "week", "month"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setVRange(null);
                  }}
                  className={`px-2.5 py-1 ${period === p ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
                >
                  {p === "day" ? "日K" : p === "week" ? "周K" : "月K"}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted">
              {period === "day" ? "前复权日线" : period === "week" ? "前复权周线" : "前复权月线"}
              {bars.length ? ` · 最新 ${bars[bars.length - 1].date}` : ""}
              {kTime ? ` · ${new Date(kTime).toLocaleTimeString("zh-CN", { hour12: false })} 更新` : ""}
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
            <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">换手率</p><p className="font-mono font-medium">{quote.turnover == null ? "—" : `${Number(quote.turnover).toFixed(2)}%`}</p></div>
            <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">昨收</p><p className="font-mono font-medium">{quote.prevClose.toFixed(3)}</p></div>
            {bars.length > 0 && (() => {
              const b = bars[bars.length - 1];
              return (
                <>
                  <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">成交量</p><p className="font-mono font-medium">{fmtVol(b.volume)}</p></div>
                  <div className="rounded-lg border border-border px-3 py-2"><p className="text-muted">振幅</p><p className="font-mono font-medium">{b.high > b.low ? `${(((b.high - b.low) / b.close) * 100).toFixed(2)}%` : "—"}</p></div>
                </>
              );
            })()}
          </div>
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {signals.map((s, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{s}</span>
              ))}
            </div>
          )}
          {/* 逐根涨跌幅标注开关 */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <button
              onClick={() => setShowPct((v) => !v)}
              className={`px-2 py-1 rounded text-[11px] border ${showPct ? "border-primary/40 text-primary bg-primary/10 font-medium" : "border-border text-muted hover:border-primary/40"}`}
              title="逐根 K 线标注当日涨跌幅（涨红跌绿）"
            >
              {showPct ? "逐根涨跌幅：开" : "逐根涨跌幅：关"}
            </button>
            {showPct && (
              <>
                <button
                  onClick={() => setPctPos((v) => (v === "top" ? "bottom" : "top"))}
                  className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40"
                >
                  {pctPos === "top" ? "位置：上方" : "位置：下方"}
                </button>
                <select
                  value={pctFont}
                  onChange={(e) => setPctFont(Number(e.target.value))}
                  className="px-1 py-0.5 rounded text-[11px] border border-border bg-transparent text-muted"
                >
                  {[8, 9, 10, 11, 12].map((s) => <option key={s} value={s}>{s}px</option>)}
                </select>
              </>
            )}
            <span className="text-[10px] text-muted ml-auto">画线标注：趋势线/水平线/垂直线/射线/通道/矩形 · Ctrl+Z 撤销 · 标注自动持久化</span>
          </div>
          <DailyMoveBadge bars={bars} name={selected?.name ?? "ETF"} decimals={3} />
          <AnnotatableChart
            option={option}
            height={380}
            storageKey={`etf-ann-${selected?.secid ?? ""}`}
            snapBars={bars}
            onDataZoom={onZoom}
            hint="画线标注：选择工具后在图上拖拽创建；选择模式拖动端点编辑，Del/Backspace 或双击删除；样式面板可调颜色/线型/线宽；开启吸附后端点贴近 K 线最高/最低价；标注自动保存，刷新后恢复，可导出/导入 JSON。"
          />
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