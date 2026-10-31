"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Quote } from "@/lib/data/quotes";

export interface CoreIndexDef {
  code: string;
  name: string;
  secid: string;
}

const POLL_MS = 25_000;

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtVol(n: number) {
  if (!n || n <= 0) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return String(Math.round(n));
}

function fmtAmt(n: number) {
  if (!n || n <= 0) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(Math.round(n));
}

function hhmmss(ts: number) {
  const t = new Date(ts);
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
}

/**
 * 大盘指数 · 实时卡片组（客户端轮询版）。
 *
 * 之前的核心指数卡是服务端直出，页面打开后不会再更新，用户看完一轮回来数字还是旧的，
 * 这正是「数据更新不及时」的直接感受。这里改为：
 *  - 首屏用服务端传入的行情秒开（SEO/无闪烁），随后每 25 秒拉一次 /api/quotes（接口 20 秒缓存）；
 *  - 页面不可见时暂停轮询，省流量也避免后台标签页堆积请求；
 *  - 顶部给出市场宽度（涨跌家数条）、更新时间、手动刷新与自动刷新开关；
 *  - 卡片补上「日内区间条」与开/高/低/量额，悬停不再需要滑入面板也能看到关键数据。
 */
export default function LiveCoreIndexes({ indexes, initial }: { indexes: CoreIndexDef[]; initial: Quote[] }) {
  const [quotes, setQuotes] = useState<Quote[]>(initial);
  const [time, setTime] = useState<number>(() => (initial[0]?.timestamp as number) || Date.now());
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);
  /**
   * 更新时间必须等水合完成后再显示。
   * 服务端（Vercel 跑在 UTC）与客户端（用户本地时区）用 getHours() 算出来的时刻不同，
   * 首屏直接渲染会触发 hydration mismatch（React #418），React 随后丢弃整棵服务端树重建，
   * 图表容器会被卸载重建——这也正是「大盘指数偶发不显示」的一个来源。
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quotes", { cache: "no-store" });
      const json = await res.json();
      if (Array.isArray(json?.quotes) && json.quotes.length) {
        setQuotes(json.quotes);
        setTime(typeof json.time === "number" ? json.time : Date.now());
        setErr("");
      } else {
        setErr("行情源未返回数据，保留上一次行情");
      }
    } catch {
      if (mounted.current) setErr("网络波动，保留上一次行情");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!auto) return;
    const t = window.setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(t);
    };
  }, [auto, load]);

  useEffect(() => {
    if (tick > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const byCode = new Map(quotes.map((q) => [q.code, q]));
  const core = indexes.map((ix) => byCode.get(ix.code)).filter((q): q is Quote => !!q);
  const ups = core.filter((q) => q.changePct > 0).length;
  const downs = core.filter((q) => q.changePct < 0).length;
  const flats = core.length - ups - downs;
  const avg = core.length ? core.reduce((a, q) => a + q.changePct, 0) / core.length : 0;

  return (
    <div className="space-y-3">
      {/* 市场宽度 + 刷新状态 */}
      <div className="card p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-2 min-w-[220px] flex-1">
          <span className="text-muted shrink-0">核心指数宽度</span>
          <div className="flex h-2 rounded-full overflow-hidden flex-1 min-w-[120px] bg-border/50">
            <span className="bg-red-500/80" style={{ width: `${core.length ? (ups / core.length) * 100 : 0}%` }} title={`上涨 ${ups}`} />
            <span className="bg-slate-400/70" style={{ width: `${core.length ? (flats / core.length) * 100 : 0}%` }} title={`平盘 ${flats}`} />
            <span className="bg-emerald-500/80" style={{ width: `${core.length ? (downs / core.length) * 100 : 0}%` }} title={`下跌 ${downs}`} />
          </div>
          <span className="shrink-0 font-mono">
            <span className="up">{ups} 涨</span>
            <span className="text-muted"> / </span>
            <span className="down">{downs} 跌</span>
            {flats > 0 && <span className="text-muted"> / {flats} 平</span>}
            <span className={`ml-2 ${avg >= 0 ? "up" : "down"}`}>均值 {pct(avg)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${err ? "bg-amber-500" : "bg-emerald-500"} ${auto && !err ? "animate-pulse" : ""}`} />
            {loading ? "更新中…" : hydrated ? `${hhmmss(time)} 更新` : "--:--:-- 更新"}
          </span>
          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[var(--primary,#c0392b)]" />
            自动刷新
          </label>
          <button
            onClick={() => setTick((t) => t + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:border-primary/50 hover:text-foreground disabled:opacity-50"
            title="立即刷新行情"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>
      {err && <p className="text-[11px] text-amber-700 dark:text-amber-400">{err}（下次自动重试）</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {indexes.map((ix) => {
          const q = byCode.get(ix.code);
          if (!q) {
            return (
              <div key={ix.secid} className="card p-4">
                <p className="text-sm text-muted">{ix.name}</p>
                <p className="text-xl font-bold font-mono mt-1 text-muted">—</p>
                <p className="text-[10px] text-muted mt-2">行情暂缺，稍后自动刷新</p>
              </div>
            );
          }
          const up = q.changePct >= 0;
          const range = q.high > q.low ? Math.min(100, Math.max(0, ((q.price - q.low) / (q.high - q.low)) * 100)) : null;
          return (
            <Link key={ix.secid} href={`/market?tab=stocks&q=${encodeURIComponent(ix.name)}`} className="group">
              <div
                className={`card p-4 h-full transition-shadow relative overflow-hidden border-l-2 ${
                  up ? "border-l-red-500/70" : "border-l-emerald-600/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{q.name}</p>
                  <span className="text-[10px] text-muted font-mono">{ix.code}</span>
                </div>
                <p className={`text-2xl font-bold font-mono mt-1 tabular-nums ${up ? "up" : "down"}`}>{q.price.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-1 text-xs font-mono">
                  <span className={up ? "up" : "down"}>{up ? "▲" : "▼"} {pct(q.changePct)}</span>
                  <span className={up ? "up" : "down"}>{q.changeAmount >= 0 ? "+" : ""}{q.changeAmount.toFixed(2)}</span>
                </div>

                {/* 日内区间位置条：钱在当天高低点的什么位置，一眼可见 */}
                <div className="mt-2.5">
                  <div className="relative h-1.5 rounded-full bg-border/60">
                    {range != null && (
                      <span
                        className={`absolute -top-1 w-1.5 h-3.5 rounded-sm ${up ? "bg-red-500" : "bg-emerald-600"} shadow`}
                        style={{ left: `calc(${range}% - 3px)` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[9px] text-muted font-mono mt-0.5">
                    <span>低 {q.low ? q.low.toFixed(2) : "—"}</span>
                    <span>高 {q.high ? q.high.toFixed(2) : "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted mt-2 font-mono">
                  <span>开 {q.open ? q.open.toFixed(2) : "—"}</span>
                  <span className="text-right">量 {fmtVol(q.volume)}</span>
                  <span className="col-span-2">额 {fmtAmt(q.amount)}</span>
                </div>

                <p className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1.5">查看个股行情 · K 线 →</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
