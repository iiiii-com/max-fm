"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { useRefresh } from "@/lib/hooks/refresh";
import type { EtfBoardItem, EtfCat } from "@/lib/data/market";

export interface EtfHitLike {
  secid: string;
  code: string;
  name: string;
}

const CATS: Array<EtfCat | "全部"> = ["全部", "宽基", "行业", "跨境", "商品", "债券", "货币", "策略"];
const SORTS = [
  ["amount", "成交额"],
  ["pct", "涨幅"],
  ["pct_asc", "跌幅"],
  ["turnover", "换手率"],
] as const;
type Sort = (typeof SORTS)[number][0];

function fmtMoney(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(Math.round(n));
}
function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/**
 * ETF 全市场榜单（市场洞察 ETF 专区的「总览」）。
 *
 * 之前的 ETF 专区只有搜索框 + 12 只写死的主题 ETF，用户既看不到全市场此刻
 * 谁在涨、谁成交放量，也没法把两只 ETF 放在一起比 —— 所以加了这块榜单。
 *
 * 数据来自 /api/etf/list（东财 4 个 ETF 板块成交额前 100 合并去重，20s 缓存），
 * 连带分类筛选、排序、搜索、上涨家数/成交额宽度都在这一个请求里算好。
 */
export default function EtfMarketBoard({
  onOpen,
  compareMode,
  selected,
  onToggleCompare,
  onToast,
}: {
  onOpen: (hit: EtfHitLike) => void;
  compareMode: boolean;
  selected: string[];
  onToggleCompare: (hit: EtfHitLike) => void;
  onToast?: (msg: string) => void;
}) {
  const { toggle, has } = useWatchlist();
  const { refreshKey } = useRefresh();
  const [cat, setCat] = useState<(typeof CATS)[number]>("全部");
  const [sort, setSort] = useState<Sort>("amount");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<EtfBoardItem[]>([]);
  const [stats, setStats] = useState<{ up: number; down: number; flat: number; avgPct: number; amount: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // 手动重试
  /** 行情源降级提示（东财不可用→新浪兜底时展示） */
  const [sourceNote, setSourceNote] = useState("");
  const PAGE = 60;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setErr("");
      try {
        const params = new URLSearchParams({ cat, sort, limit: String(PAGE), offset: String(offset) });
        if (debouncedQ) params.set("q", debouncedQ);
        const res = await fetch(`/api/etf/list?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || "榜单加载失败");
        setStats(json.stats ?? null);
        setTotal(json.total ?? 0);
        setUpdated(json.updated ?? null);
        setSourceNote(json.degraded ? String(json.note || "行情源已降级") : "");
        setItems((prev) => (append ? [...prev, ...(json.items ?? [])] : (json.items ?? [])));
      } catch (e: any) {
        setErr(e?.message ?? "榜单加载失败，请稍后重试");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cat, sort, debouncedQ]
  );

  useEffect(() => {
    load(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, sort, debouncedQ, refreshKey, tick]);

  const up = stats?.up ?? 0;
  const down = stats?.down ?? 0;
  const flat = stats?.flat ?? 0;
  const breadth = useMemo(() => {
    const n = up + down + flat || 1;
    return { up: (up / n) * 100, flat: (flat / n) * 100, down: (down / n) * 100 };
  }, [up, down, flat]);

  return (
    <div className="space-y-3">
      {/* 市场宽度条：一眼看清今天 ETF 是普涨还是普跌 */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-2">
          <p className="text-xs font-medium">
            ETF 市场宽度
            <span className="text-[10px] text-muted ml-1.5">{cat === "全部" ? "活跃榜单" : cat} · {total} 只</span>
          </p>
          <span className="text-[11px] tabular-nums up">↑ {up}</span>
          <span className="text-[11px] tabular-nums text-muted">— {flat}</span>
          <span className="text-[11px] tabular-nums down">↓ {down}</span>
          {/*
            平均/成交两个数值始终占位（数据未到时显示 —），不要用 {stats && ...} 条件渲染：
            数据到达后多出这两个 span 会让这一行换行、整块高度 +21px，把下方宽表格整体下推，
            实测在 /market?tab=etf 贡献了约 0.29 的 CLS。固定占位后行数不变，布局不再跳动。
          */}
          <span className="text-[11px] text-muted tabular-nums">平均 {stats ? fmtPct(stats.avgPct) : "—"}</span>
          <span className="text-[11px] text-muted tabular-nums">成交 {stats ? fmtMoney(stats.amount) : "—"}</span>
          <span className="ml-auto text-[10px] text-muted">
            {updated ? `更新 ${new Date(updated).toLocaleTimeString("zh-CN", { hour12: false })}` : "加载中…"}
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-border/40" role="img" aria-label={`上涨 ${up} 平盘 ${flat} 下跌 ${down}`}>
          <div className="bg-[var(--up,#c0392b)]" style={{ width: `${breadth.up}%` }} />
          <div className="bg-[var(--muted,#a8a29e)] opacity-40" style={{ width: `${breadth.flat}%` }} />
          <div className="bg-[var(--down,#1e8449)]" style={{ width: `${breadth.down}%` }} />
        </div>
        {/*
          降级提示行始终占位（无提示时用不换行空格撑高）：提示是异步出现的（东财不可用才降级），
          条件渲染会让卡片在数据到达后长高 21px，把下方整张 ETF 表格下推 —— 这一处就是
          /market?tab=etf 剩余 0.29 CLS 的来源。
        */}
        <p className="text-[10px] mt-1.5 min-h-[15px]" style={{ color: "var(--amber)" }}>
          {sourceNote || "\u00A0"}
        </p>
      </div>

      {/* 筛选 + 排序 + 搜索 */}
      <div className="card p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${
                cat === c ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
          <div className="ml-auto flex rounded-md border border-border overflow-hidden text-[11px]">
            {SORTS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-2 py-1 ${sort === k ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="在榜单中筛选：代码 / 名称，如 半导体 / 510300 / 黄金"
            className="flex-1 min-w-0 px-3 py-1.5 rounded-md border border-border bg-background text-xs focus:outline-none focus:border-primary/60"
          />
          {q && <button onClick={() => setQ("")} className="text-[11px] text-muted hover:text-foreground">清除</button>}
          <button
            onClick={() => setTick((v) => v + 1)}
            className="px-2.5 py-1.5 rounded-md border border-border text-[11px] text-muted hover:text-foreground hover:border-primary/40"
            title="立即刷新榜单"
          >
            刷新
          </button>
        </div>
        {compareMode && (
          <p className="text-[10px] text-primary/80">对比模式：点击行勾选/取消（已选 {selected.length} / 6）</p>
        )}
      </div>

      {err && (
        <div className="card p-3 flex items-center gap-3">
          <p className="text-xs text-red-600 flex-1">{err}</p>
          <button onClick={() => setTick((v) => v + 1)} className="text-[11px] px-2 py-1 rounded border border-border hover:border-primary/50">
            重试
          </button>
        </div>
      )}

      {/* 榜单表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="text-muted border-b border-border bg-border/10">
                {compareMode && <th className="w-8 py-2 pl-3" />}
                <th className="text-left py-2 px-2 font-medium">名称 / 代码</th>
                <th className="text-right py-2 px-2 font-medium">现价</th>
                <th className="text-right py-2 px-2 font-medium">涨跌幅</th>
                <th className="text-right py-2 px-2 font-medium">成交额</th>
                <th className="text-right py-2 px-2 font-medium">换手率</th>
                <th className="text-right py-2 pr-3 pl-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td colSpan={compareMode ? 7 : 6} className="px-3 py-2">
                      <div className="h-3 rounded bg-border/40 animate-pulse" style={{ width: `${70 - i * 5}%` }} />
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && !err && (
                <tr>
                  <td colSpan={compareMode ? 7 : 6} className="px-3 py-6 text-center text-muted">
                    {debouncedQ ? `榜单中没有匹配「${debouncedQ}」的 ETF —— 可点上方搜索框跨市场搜索` : "暂无数据"}
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((d) => {
                  const picked = selected.includes(d.secid);
                  return (
                    <tr
                      key={d.secid}
                      onClick={() => (compareMode ? onToggleCompare({ secid: d.secid, code: d.code, name: d.name }) : onOpen({ secid: d.secid, code: d.code, name: d.name }))}
                      className={`border-b border-border/40 last:border-0 cursor-pointer transition-colors ${
                        picked ? "bg-primary/8" : "hover:bg-primary/5"
                      }`}
                    >
                      {compareMode && (
                        <td className="py-1.5 pl-3">
                          <span
                            className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border text-[9px] ${
                              picked ? "bg-primary text-white border-primary" : "border-border text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </td>
                      )}
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate max-w-[10rem]">{d.name}</span>
                          <span className="text-[9px] px-1 rounded bg-border/40 text-muted shrink-0">{d.cat}</span>
                          <span className="text-[10px] text-muted font-mono shrink-0">{d.code}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-mono">{d.price > 0 ? d.price.toFixed(3) : "—"}</td>
                      <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${d.changePct >= 0 ? "up" : "down"}`}>{fmtPct(d.changePct)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted">{fmtMoney(d.amount)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted">{d.turnover == null ? "—" : `${d.turnover.toFixed(2)}%`}</td>
                      <td className="py-1.5 pr-3 pl-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            const was = has(d.secid);
                            toggle({ secid: d.secid, code: d.code, name: d.name, kind: "etf" });
                            onToast?.(was ? `已从自选移除 ${d.name}` : `已加自选 ${d.name}`);
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${has(d.secid) ? "border-amber-300 text-amber-600" : "border-border text-muted hover:border-primary/40"}`}
                          title={has(d.secid) ? "点击移除自选" : "加入自选"}
                        >
                          {has(d.secid) ? "★" : "☆"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/60">
          <span className="text-[10px] text-muted">
            已加载 {items.length} / {total} 只 · 数据约 15~20 秒延迟，榜单取各板块成交额前 100
          </span>
          {items.length < total && (
            <button
              onClick={() => load(items.length, true)}
              disabled={loadingMore}
              className="text-[11px] px-2.5 py-1 rounded-md border border-border text-muted hover:text-foreground hover:border-primary/40 disabled:opacity-50"
            >
              {loadingMore ? "加载中…" : "加载更多"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
