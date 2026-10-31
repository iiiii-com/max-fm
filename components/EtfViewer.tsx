"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import type { ECharts, EChartsOption } from "@/components/charts/echarts";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useRefresh } from "@/lib/hooks/refresh";
import { THEME_ETFS, ETF_CAT_TONE, type ThemeEtf } from "@/lib/data/leaders";
import type { KlineBar } from "@/app/api/stock/kline/route";
import { mkMainAxis, mkSubAxis, initialZoom } from "@/lib/data/axis";
import DailyMoveBadge from "@/components/charts/DailyMoveBadge";
import { mkKlineTooltip, mkPctLabel } from "@/lib/data/kline-tooltip";
import DeferInView from "@/components/ui/DeferInView";

/**
 * 图表型子组件按需加载（用户任务⑥：ETF 专区首屏 JS < 800KB）。
 *
 * 这几个组件都直接或间接 import 了 echarts（约 800KB）。ETF 专区首屏用户先看到的是
 * 行情表格，K 线速览在页面下方、对比面板与详情图要点击后才出现，
 * 因此把它们拆成独立 chunk：首屏只下载表格逻辑，滚动/点击时再取图表代码。
 */
const ChartSkeleton = ({ h = 260 }: { h?: number }) => (
  <div className="animate-pulse rounded-lg bg-muted/10" style={{ height: h }} aria-busy="true" aria-label="图表加载中" />
);

const LeaderKlineGrid = nextDynamic(() => import("@/components/LeaderKlineGrid"), {
  ssr: false,
  loading: () => <ChartSkeleton h={320} />,
});
const EtfComparePanel = nextDynamic(() => import("@/components/etf/EtfComparePanel"), {
  ssr: false,
  loading: () => <ChartSkeleton h={320} />,
});
const AnnotatableChart = nextDynamic(() => import("@/components/charts/AnnotatableChart"), {
  ssr: false,
  loading: () => <ChartSkeleton h={360} />,
});
const KlineDetailPanel = nextDynamic(
  () => import("@/components/charts/KlineDetail").then((m) => m.KlineDetailPanel),
  { ssr: false, loading: () => <ChartSkeleton h={160} /> },
);
import EtfMarketBoard, { type EtfHitLike } from "@/components/etf/EtfMarketBoard";
import EtfRelatedChains from "@/components/etf/EtfRelatedChains";

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
  nav: number | null;
  navDate: string | null;
  /** 净值是否明显滞后（QDII T+1~T+2 / 长假）：此时不展示溢价率，避免假溢价 */
  navStale: boolean;
  premiumPct: number | null;
  turnover: number;
  amount: number;
  scale: number;
}

interface PartialFlags {
  quote: boolean;
  kline: boolean;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`;
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(Math.round(n));
}

function fmtVol(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return String(n);
}

const MAX_COMPARE = 6;

/**
 * 市场洞察 · ETF 专区。
 *
 * 重构要点（对应「ETF 无法查看、不能对比、有时不显示数据」）：
 *  1. 总览：全市场活跃 ETF 榜单（分类/排序/搜索/市场宽度），不再只有 12 只写死主题；
 *  2. 对比：榜单勾选 2–6 只 → 归一化走势 + 区间收益/回撤，并可跳到对比中心；
 *  3. 容错：净值/溢价率缺失显示「—」不再崩；行情源失败自动降级新浪；K 线与快照互不阻断；
 *  4. 深链：/market?tab=etf&secid=1.510300 可直接打开某只 ETF，分享/收藏可用。
 */
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
  const [partial, setPartial] = useState<PartialFlags | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [showPct, setShowPct] = useState(true);
  const [pctPos, setPctPos] = useState<"top" | "bottom">("top");
  const [pctFont, setPctFont] = useState(9);
  const [mode, setMode] = useState<"board" | "compare">("board");
  const [compareItems, setCompareItems] = useState<EtfHitLike[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [selectedBar, setSelectedBar] = useState<KlineBar | null>(null);
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

  // 提示计时器放进 ref：旧实现把定时器挂在回调函数对象上（showToast._t），
  // 既污染函数对象又需要 any 断言；同时补卸载清理，避免组件卸载后 setToast 报错。
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  /** 把当前选中写进 URL，便于分享/收藏（不触发 Next 路由跳转，避免整页重渲染） */
  const syncUrl = useCallback((hit: EtfHit | null) => {
    try {
      const url = hit ? `/market?tab=etf&secid=${encodeURIComponent(hit.secid)}&name=${encodeURIComponent(hit.name)}` : "/market?tab=etf";
      window.history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
  }, []);

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

  const pick = useCallback(
    async (hit: EtfHit, reset = true) => {
      if (reset) {
        setSelected(hit);
        setShowList(false);
        setQuery(`${hit.name}（${hit.code}）`);
        syncUrl(hit);
      }
      setErr("");
      setLoading(true);
      setQuote(null);
      setBars([]);
      setSignals([]);
      setPartial(null);
      // 行情与 K 线分别容错：任何一个成功都不该让另一个把页面拖进错误态
      const [qr, kr] = await Promise.all([
        fetch(`/api/etf/quote?secid=${hit.secid}`, { cache: "no-store" })
          .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
          .catch(() => null),
        fetch(`/api/stock/kline?secid=${hit.secid}&period=${period}`, { cache: "no-store" })
          .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
          .catch(() => null),
      ]);
      const qj = qr?.json;
      if (qj?.ok) {
        // 只降级 K 线时名字可能为空，用搜索/榜单里的名字兜底
        setQuote({ ...qj.quote, name: qj.quote.name || hit.name });
        setSignals(qj.signals?.signals ?? []);
        setPartial(qj.partial ?? null);
      } else {
        setErr(qj?.error ?? "ETF 行情源暂时不可用，请稍后重试");
      }
      const kj = kr?.json;
      if (kj?.klines?.length) {
        setBars(kj.klines);
        setKTime(Date.now());
      }
      setLoading(false);
    },
    [period, syncUrl]
  );

  // 选中标的跟随全局自动刷新（不重置选择状态）
  const { refreshKey } = useRefresh();
  useEffect(() => {
    if (selected) pick(selected, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, period]);

  // 深链：/market?tab=etf&secid=1.510300&name=xxx
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const secid = sp.get("secid")?.trim();
      if (secid && /^\d+\.\w+$/.test(secid)) {
        pick({ secid, code: secid.split(".")[1] ?? secid, name: sp.get("name") ?? secid }, false);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCompare = useCallback(
    (hit: EtfHitLike) => {
      setCompareItems((prev) => {
        if (prev.some((p) => p.secid === hit.secid)) return prev.filter((p) => p.secid !== hit.secid);
        if (prev.length >= MAX_COMPARE) {
          showToast(`最多同时对比 ${MAX_COMPARE} 只 ETF`);
          return prev;
        }
        return [...prev, hit];
      });
    },
    [showToast]
  );

  const backToBoard = () => {
    setSelected(null);
    setQuery("");
    setQuote(null);
    setBars([]);
    setErr("");
    syncUrl(null);
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
    const upColor = "#c0392b";
    const downColor = "#1e8449";
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
        { type: "value", scale: true, gridIndex: 0, axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } } },
        { type: "value", gridIndex: 1, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1], start: vRange?.[0] ?? initialZoom(bars.length, 250).start, end: vRange?.[1] ?? 100, zoomOnMouseWheel: true },
        { type: "slider", xAxisIndex: [0, 1], height: 16, bottom: 4, start: vRange?.[0] ?? initialZoom(bars.length, 250).start, end: vRange?.[1] ?? 100 },
      ],
      series: [
        {
          name: "K 线", type: "candlestick", data: ohlc,
          itemStyle: { color: upColor, color0: downColor, borderColor: upColor, borderColor0: downColor },
        },
        mkPctLabel({ bars, show: showPct, position: pctPos, fontSize: pctFont, pctRange: vRange }),
        { name: "MA5", type: "line", data: closes.map((_, i) => (i < 4 ? null : closes.slice(i - 4, i + 1).reduce((a, c) => a + c, 0) / 5)), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#b45309" } },
        { name: "MA10", type: "line", data: closes.map((_, i) => (i < 9 ? null : closes.slice(i - 9, i + 1).reduce((a, c) => a + c, 0) / 10)), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#1d4ed8" } },
        { name: "MA20", type: "line", data: closes.map((_, i) => (i < 19 ? null : closes.slice(i - 19, i + 1).reduce((a, c) => a + c, 0) / 20)), smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#7c3aed" } },
        { name: "成交量", type: "bar", data: volumes, xAxisIndex: 1, yAxisIndex: 1 },
      ],
    };
  }, [bars, showPct, pctPos, pctFont, vRange]);

  const nav = quote?.nav ?? null;
  const premium = quote?.premiumPct ?? null;

  return (
    <div className="space-y-4">
      {/* 搜索框（跨市场搜索，不受榜单分类限制） */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowList(true);
            if (!e.target.value.trim()) {
              setHits([]);
              setSearching(false);
            }
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 200)}
          placeholder="搜索全市场 ETF：半导体 ETF / 510300 / 科创50 / 黄金"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/60"
        />
        {showList && query.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-background shadow-lg max-h-72 overflow-auto">
            {searching && <p className="px-4 py-2 text-sm text-muted">搜索中…</p>}
            {!searching && hits.length === 0 && <p className="px-4 py-2 text-sm text-muted">未找到匹配 ETF</p>}
            {hits.map((h) => (
              <button
                key={h.secid}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-primary/5"
              >
                <span className="text-sm font-medium">{h.name}</span>
                <span className="text-xs text-muted font-mono">{h.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 自选 */}
      {items.length > 0 && (
        <div className="card p-3">
          <p className="text-xs text-muted mb-2">我的自选（{items.length}）</p>
          <div className="flex flex-wrap gap-2">
            {items.map((w) => (
              <span key={w.secid} className="inline-flex items-center gap-1.5 text-xs rounded-md border border-border px-2 py-1">
                <button onClick={() => pick({ secid: w.secid, code: w.code, name: w.name } as EtfHit)} className="font-medium hover:text-primary">
                  {w.name}
                </button>
                <span className="text-[10px] text-muted font-mono">{w.code}</span>
                <button onClick={() => toggle(w)} className="text-muted hover:text-red-500" title="移除自选">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 详情态：返回总览 */}
      {selected && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={backToBoard}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:border-primary/40"
          >
            ← 返回 ETF 总览
          </button>
          <button
            onClick={() => {
              toggleCompare({ secid: selected.secid, code: selected.code, name: selected.name });
              showToast(compareItems.some((p) => p.secid === selected.secid) ? "已从对比移除" : "已加入对比（切到「ETF 对比」查看）");
            }}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:border-primary/40"
          >
            {compareItems.some((p) => p.secid === selected.secid) ? "✓ 已在对比" : "＋ 加入对比"}
          </button>
          <a
            href={`/compare?codes=${selected.code}`}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:border-primary/40"
          >
            在对比中心打开 →
          </a>
        </div>
      )}

      {/* 总览 / 对比 */}
      {!selected && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {([
                ["board", "ETF 行情总览"],
                ["compare", `ETF 对比${compareItems.length ? `（${compareItems.length}）` : ""}`],
              ] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 ${mode === m ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "compare" && compareItems.length >= 2 && (
              <button onClick={() => setCompareItems([])} className="text-[11px] text-muted hover:text-foreground">
                清空选择
              </button>
            )}
          </div>

          {mode === "compare" && (
            <EtfComparePanel
              items={compareItems}
              onRemove={(secid) => setCompareItems((prev) => prev.filter((p) => p.secid !== secid))}
              onOpen={(hit) => {
                setSelected(hit as EtfHit);
                syncUrl(hit);
                setMode("board");
              }}
            />
          )}

          <EtfMarketBoard
            onOpen={(hit) => {
              setSelected(hit);
              syncUrl({ ...hit } as EtfHit);
              setQuery(`${hit.name}（${hit.code}）`);
            }}
            compareMode={mode === "compare"}
            selected={compareItems.map((p) => p.secid)}
            onToggleCompare={toggleCompare}
            onToast={showToast}
          />

          {mode === "board" && (
            <>
              <div className="card p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
                  <p className="text-xs text-muted">
                    热门主题 ETF
                    <span className="text-[10px] ml-1.5">点击查看真实 K 线 · 净值 · 信号</span>
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
              <div className="card p-3">
                <p className="text-xs text-muted mb-2.5">
                  热门 ETF K 线速览
                  <span className="text-[10px] ml-1.5">近 60 日 K 线 + MA5/MA20 · 点击卡片直达详情</span>
                </p>
                {/* 首屏之外的 K 线速览：滚动到附近才挂载（否则动态 chunk 仍会立刻下载 echarts） */}
                <DeferInView height={320} label="K 线速览加载中">
                  <LeaderKlineGrid defaultTab="etf" />
                </DeferInView>
              </div>
            </>
          )}
        </>
      )}

      {/* 详情：加载骨架 / 错误重试 / 行情卡 */}
      {selected && loading && (
        <div className="card p-4 space-y-3">
          <div className="h-5 w-40 rounded bg-border/40 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-border/30 animate-pulse" />
            ))}
          </div>
          <div className="h-[280px] rounded-lg bg-border/20 animate-pulse" />
        </div>
      )}

      {selected && !loading && err && !quote && (
        <div className="card p-4">
          <p className="text-sm text-amber-700 dark:text-amber-400">{err}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => pick(selected, false)} className="text-xs px-2.5 py-1 rounded-md border border-border hover:border-primary/50">
              重试
            </button>
            <Link2 onClick={backToBoard} label="返回总览" />
          </div>
        </div>
      )}

      {selected && quote && !loading && (
        <div className="card p-4">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            <h2 className="font-bold">{quote.name}</h2>
            <span className="text-xs text-muted font-mono">{quote.code}</span>
            <button
              onClick={() => toggle({ secid: selected.secid, code: quote.code, name: quote.name, kind: "etf" })}
              className={`text-xs px-2 py-1 rounded-md border ${has(selected.secid) ? "border-red-300 text-red-600 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40" : "border-border text-muted hover:border-primary/50"}`}
            >
              {has(selected.secid) ? "★ 已自选" : "☆ 加自选"}
            </button>
            <span className="ml-auto text-xl font-bold font-mono">{quote.price.toFixed(3)}</span>
            <span className={`text-sm font-mono ${quote.changePct >= 0 ? "up" : "down"}`}>
              {quote.changePct >= 0 ? "+" : ""}
              {quote.changePct.toFixed(2)}%
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
            {partial && !partial.quote && <span className="text-[10px] text-amber-600">已降级：仅 K 线数据</span>}
            {partial && partial.quote && !partial.kline && <span className="text-[10px] text-amber-600">K 线暂缺，行情/净值可用</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-muted">单位净值（最新披露）</p>
              <p className="font-mono font-medium">{nav == null ? "—" : nav.toFixed(3)}</p>
              {quote.navDate && (
                <p className="text-[9px] text-muted mt-0.5">
                  净值日 {quote.navDate}
                  {quote.navStale ? " · 已滞后，不计算溢价率" : ""}
                </p>
              )}
            </div>
            <div
              className={`rounded-lg border px-3 py-2 ${
                premium == null
                  ? "border-border"
                  : premium >= 0
                    ? "border-red-200 bg-red-50/50 dark:border-red-900/40"
                    : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40"
              }`}
            >
              <p className="text-muted">溢价率{quote.navDate && !quote.navStale ? "（对披露净值）" : ""}</p>
              <p className={`font-mono font-medium ${premium == null ? "text-muted" : premium >= 0 ? "up" : "down"}`}>
                {premium == null ? "—" : `${premium >= 0 ? "+" : ""}${premium.toFixed(2)}%`}
              </p>
              {quote.navStale && <p className="text-[9px] text-muted mt-0.5">净值滞后，暂不计算</p>}
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-muted">规模</p>
              <p className="font-mono font-medium">{fmtMoney(quote.scale)}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-muted">成交额</p>
              <p className="font-mono font-medium">{fmtMoney(quote.amount)}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-muted">换手率</p>
              <p className="font-mono font-medium">{quote.turnover > 0 ? `${quote.turnover.toFixed(2)}%` : "—"}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-muted">昨收</p>
              <p className="font-mono font-medium">{quote.prevClose > 0 ? quote.prevClose.toFixed(3) : "—"}</p>
            </div>
            {bars.length > 0 &&
              (() => {
                const b = bars[bars.length - 1];
                return (
                  <>
                    <div className="rounded-lg border border-border px-3 py-2">
                      <p className="text-muted">成交量</p>
                      <p className="font-mono font-medium">{fmtVol(b.volume)}</p>
                    </div>
                    <div className="rounded-lg border border-border px-3 py-2">
                      <p className="text-muted">振幅</p>
                      <p className="font-mono font-medium">{b.high > b.low ? `${(((b.high - b.low) / b.close) * 100).toFixed(2)}%` : "—"}</p>
                    </div>
                  </>
                );
              })()}
          </div>
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {signals.map((s, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="mb-3">
            <EtfRelatedChains code={quote.code} name={quote.name} />
          </div>
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
                  aria-label="涨跌幅标注字号"
                >
                  {[8, 9, 10, 11, 12].map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
              </>
            )}
            <span className="text-[10px] text-muted ml-auto">画线标注：趋势线/水平线/垂直线/射线/通道/矩形 · Ctrl+Z 撤销 · 标注自动持久化</span>
          </div>
          <DailyMoveBadge bars={bars} name={selected?.name ?? "ETF"} decimals={3} />
          {bars.length > 0 ? (
            <div className="relative">
              <AnnotatableChart
                option={option}
                height={380}
                storageKey={`etf-ann-${selected?.secid ?? ""}`}
                snapBars={bars}
                onDataZoom={onZoom}
                chartRef={chartRef}
                onBarClick={(i) => setSelectedBar(bars[i] ?? null)}
                hint="画线标注：选择工具后在图上拖拽创建；选择模式拖动端点编辑，Del/Backspace 或双击删除；样式面板可调颜色/线型/线宽；开启吸附后端点贴近 K 线最高/最低价；标注自动保存，刷新后恢复，可导出/导入 JSON。"
              />
              {selectedBar && (
                <div className="absolute left-2 top-2 z-10">
                  <KlineDetailPanel
                    bar={selectedBar}
                    prev={(() => {
                      const i = bars.findIndex((b) => b.date === selectedBar.date);
                      return i > 0 ? bars[i - 1] : null;
                    })()}
                    onClose={() => setSelectedBar(null)}
                    title={selected?.name}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border p-6 text-center text-xs text-muted">
              K 线数据暂不可用（行情源可能限频）·
              <button onClick={() => pick(selected, false)} className="text-primary hover:underline ml-1">
                重试
              </button>
            </div>
          )}
          <p className="text-xs text-muted mt-2">
            溢价率 = 场内价相对最新披露单位净值的偏离（净值按交易日披露，非盘中 IOPV）；数据约 15~20 秒延迟，仅供研究参考。
          </p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-md bg-foreground text-background text-xs shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** 详情错误态里的「返回总览」按钮（保持主渲染结构简单） */
function Link2({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-foreground hover:border-primary/50">
      {label}
    </button>
  );
}
