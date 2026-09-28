"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { EmptyState, ErrorState, LoadingRegion } from "@/components/ui-state";
import { CollapsibleOnMobile } from "@/components/ui-disclosure";
import type { EChartsOption } from "@/components/charts/echarts";
import { useWatchlist, type WatchItem } from "@/lib/hooks/useWatchlist";
import { useRefresh } from "@/lib/hooks/refresh";

/**
 * 图表与抽屉按需加载
 *
 * 板块卡片默认是「表格」视图，条形图需用户手动切换；个股抽屉也只在点击后打开。
 * 但 EChart 是 ECharts（约 796KB 原始 / 263KB 传输）的唯一入口，静态 import 会让
 * ECharts 无条件进入首页首屏包 —— 实测首页加载了 263KB 的 ECharts chunk 却渲染 0 个 canvas。
 * 改为 dynamic import 后，ECharts 只在真正切到「条形图」或打开抽屉时才下载。
 */
const EChart = dynamic(() => import("@/components/charts/EChart"), {
  ssr: false,
  loading: () => <div className="flex h-[480px] items-center justify-center text-xs text-muted">图表加载中…</div>,
});
const StockDrawer = dynamic(() => import("@/components/StockDrawer"), { ssr: false });
// 仅类型引用（编译期擦除，不产生运行时依赖，故不会把 StockDrawer 拉回首屏包）
import type { DrawerStock } from "@/components/StockDrawer";

interface SectorLeader {
  name: string;
  secid: string;
  /** 涨跌幅 %；东财列表接口内联返回，缺失时为 null */
  pct: number | null;
}

interface SectorRow {
  code: string;
  name: string;
  price: number;
  changePct: number;
  mainNetIn: number;
  mainPct: number;
  amount: number;
  up?: number;
  down?: number;
  /** 0=母板块，2/3=东财 Ⅱ/Ⅲ 细分分册 */
  tier?: number;
  leader?: SectorLeader | null;
}

interface SectorStock {
  name: string;
  secid: string;
  price: number;
  pct: number;
  mainNet: number;
}

interface Northbound {
  shIn: number;
  szIn: number;
  totalIn: number;
  date: string;
  stopped?: boolean; // 2024-08 起停止实时披露：true 时显示说明而非误导性 0
}

interface BoardUniverse {
  total: number;
  returned: number;
  deduped: number;
  note: string;
}

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

export default function MarketDashboard() {
  const { items, toggle, has } = useWatchlist();
  const { refreshKey } = useRefresh();
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [universe, setUniverse] = useState<BoardUniverse | null>(null);
  const [north, setNorth] = useState<Northbound | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"table" | "bar">("table");
  // 排名表默认按主力净流入**降序**（榜单语义 = 最强在前）
  const [sortKey, setSortKey] = useState<"changePct" | "mainNetIn" | "amount" | "mainPct">("mainNetIn");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  // 默认隐藏东财 Ⅱ/Ⅲ 细分分册：它们与母板块是同一批股票的子集，混排会重复计算
  const [hideSubtier, setHideSubtier] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, SectorStock[]>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerStock | null>(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/sector/board?top=60", { cache: "no-store" });
      const j = await res.json();
      if (j?.ok) {
        setSectors(j.list || []);
        setUniverse(j.universe ?? null);
        setNorth(j.northbound);
        setErr("");
      } else setErr(j?.error ?? "加载失败");
    } catch {
      setErr("资金流数据暂不可用");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadDetail = async (code: string) => {
    if (detailMap[code]) return;
    setDetailLoading(code);
    try {
      const res = await fetch(`/api/sector/flow/detail?bk=${code}`, { cache: "no-store" });
      const j = await res.json();
      setDetailMap((m) => ({ ...m, [code]: j?.list || [] }));
    } catch {
      setDetailMap((m) => ({ ...m, [code]: [] }));
    } finally {
      setDetailLoading(null);
    }
  };

  const toggleExpand = (code: string) => {
    if (expanded === code) {
      setExpanded(null);
    } else {
      setExpanded(code);
      loadDetail(code);
    }
  };

  const stockWatch = items.filter((i) => i.kind === "stock" || i.kind === "index" || i.kind === "etf");
  const sectorWatch = items.filter((i) => i.kind === "sector");

  const visibleSectors = useMemo(
    () => (hideSubtier ? sectors.filter((s) => !s.tier) : sectors),
    [sectors, hideSubtier]
  );

  const sortedSectors = useMemo(() => {
    return [...visibleSectors].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      // sortDir=1 → 降序（vb - va），sortDir=-1 → 升序
      return (vb - va) * sortDir;
    });
  }, [visibleSectors, sortKey, sortDir]);

  // 排名类指标首次点击一律降序（最强在前），二次点击才反转
  const toggleSort = (key: "changePct" | "mainNetIn" | "amount" | "mainPct") => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const SortTh = ({ k, children, className = "" }: { k: "changePct" | "mainNetIn" | "amount" | "mainPct"; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${className}`}
      title="点击排序（首次点击为降序）"
    >
      {children}
      <span className="text-[9px] opacity-70" aria-hidden>{sortKey === k ? (sortDir === 1 ? "↓" : "↑") : "↕"}</span>
      {sortKey === k && <span className="sr-only">{sortDir === 1 ? "当前降序" : "当前升序"}</span>}
    </button>
  );

  const barOption = useMemo<EChartsOption>(() => {
    const rows = sortedSectors;
    const vals = rows.map((s) => s.mainNetIn / 1e8);
    const hasNeg = vals.some((v) => v < 0);
    const min = Math.min(0, ...vals);
    const max = Math.max(0, ...vals);
    return {
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const p = params?.[0];
          if (!p || !rows[p.dataIndex]) return "";
          const s = rows[p.dataIndex];
          return `${s.name}<br/>主力净流入：${s.mainNetIn >= 0 ? "+" : ""}${fmtMoney(s.mainNetIn)}<br/>涨跌幅：${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%`;
        },
      },
      xAxis: {
        type: "value",
        min: hasNeg ? min * 1.08 : 0,
        max: max * 1.08 || 1,
        axisLabel: { fontSize: 10, formatter: "{value} 亿" },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
      },
      yAxis: {
        type: "category",
        data: rows.map((s) => s.name),
        inverse: true,
        axisTick: { show: false },
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          barWidth: 13,
          data: vals.map((v) => ({
            value: Number(v.toFixed(2)),
            itemStyle: {
              borderRadius: v >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3],
              color:
                v >= 0
                  ? { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "rgba(220,38,38,0.3)" }, { offset: 1, color: "#c0392b" }] }
                  : { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "#1e8449" }, { offset: 1, color: "rgba(22,163,74,0.3)" }] },
            },
            // 负值标签放左侧、正值放右侧，避免与柱体/坐标轴重叠
            label: { position: v >= 0 ? ("right" as const) : ("left" as const) },
          })),
          label: {
            show: true,
            position: "right",
            fontSize: 10,
            color: "inherit",
            formatter: (p: any) => `${p.value >= 0 ? "+" : ""}${Number(p.value).toFixed(1)}亿`,
          },
        },
      ],
    };
  }, [sortedSectors]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
          <h2 className="font-bold">板块资金流排名</h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setView("table")}
                className={`px-2.5 py-1 ${view === "table" ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                表格
              </button>
              <button
                onClick={() => setView("bar")}
                className={`px-2.5 py-1 ${view === "bar" ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                条形图
              </button>
            </div>
            <button onClick={load} disabled={refreshing} className="text-xs px-2 py-1 rounded-md border border-border hover:border-primary/50 disabled:opacity-50">
              {refreshing ? "刷新中…" : "刷新"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">
          东财行业板块共 {universe?.total ?? "—"} 个，本表取主力净流入前 {universe?.returned ?? "—"} 个
          {universe && universe.deduped < universe.returned && `，跨层级去重后显示 ${universe.deduped} 个`}。
          板块间存在父子层级与 Ⅱ/Ⅲ 分册，<span className="font-medium text-foreground">不可跨板块求和</span>。
        </p>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={hideSubtier}
              onChange={(e) => setHideSubtier(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            隐藏 Ⅱ/Ⅲ 细分分册
          </label>
          <span className="text-[11px] text-muted">当前显示 {visibleSectors.length} 个板块</span>
        </div>
        {err && <ErrorState message={err} onRetry={load} compact />}

        {loading ? (
          <LoadingRegion rows={8} />
        ) : view === "bar" ? (
          sortedSectors.length ? (
            <EChart option={barOption} height={Math.max(480, sortedSectors.length * 20 + 60)} />
          ) : (
            <EmptyState title="暂无板块资金数据" hint="可点击上方「刷新」重新拉取" />
          )
        ) : sortedSectors.length ? (
          <CollapsibleOnMobile collapsedHeight={520} moreLabel="展开全部板块">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm table-stripe">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th scope="col" className="text-left py-2 pr-2">板块</th>
                  <th scope="col" className="text-right px-2"><SortTh k="changePct">涨跌幅</SortTh></th>
                  <th scope="col" className="text-right px-2"><SortTh k="mainNetIn">主力净流入</SortTh></th>
                  <th scope="col" className="text-right px-2 hidden sm:table-cell"><SortTh k="mainPct">净占比</SortTh></th>
                  <th scope="col" className="text-right px-2 hidden md:table-cell"><SortTh k="amount">成交额</SortTh></th>
                  <th scope="col" className="text-left px-2 hidden lg:table-cell">领涨股</th>
                  <th scope="col" className="text-right pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedSectors.map((s, i) => (
                  <SectorRowComp
                    key={s.code}
                    s={s}
                    index={i}
                    has={has}
                    toggle={toggle}
                    onToggleStar={() => {
                      toggle({ secid: s.code, code: s.code, name: s.name, kind: "sector" });
                      setToast(has(s.code) ? `已移出「${s.name}」自选` : `已加入「${s.name}」自选`);
                    }}
                    expanded={expanded === s.code}
                    detailLoading={detailLoading === s.code}
                    details={detailMap[s.code]}
                    onToggleExpand={() => toggleExpand(s.code)}
                    onOpenDrawer={(st) => setDrawer(st)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </CollapsibleOnMobile>
        ) : (
          <EmptyState title="暂无板块资金数据" hint="可点击上方「刷新」重新拉取" />
        )}
      </div>

      <div className="space-y-4">
        {north && (
          <div className="card p-4">
            {/* 2024-08 起交易所停止披露北向净买入，此处只展示「披露状态」，不把今天日期挂在陈旧数据上 */}
            <h3 className="font-bold text-sm mb-2">
              北向资金{north.stopped ? "" : `（${north.date || "—"}）`}
            </h3>
            {north.stopped ? (
              <p className="text-xs text-muted leading-relaxed">
                沪深交易所自 2024 年 8 月 18 日起<span className="font-medium text-foreground">停止实时披露北向净买入金额</span>
                ，目前仅披露成交总额。本站不虚构该数值，历史日度走势可在
                <Link href="/analysis/bullbear" className="text-primary underline underline-offset-2 hover:text-primary/80"> 牛熊深度分析 </Link>
                中结合市场阶段查看。
              </p>
            ) : (
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted">沪股通</span><span className={`font-mono font-medium ${north.shIn >= 0 ? "up" : "down"}`}>{fmtMoney(north.shIn)}</span></div>
                <div className="flex justify-between"><span className="text-muted">深股通</span><span className={`font-mono font-medium ${north.szIn >= 0 ? "up" : "down"}`}>{fmtMoney(north.szIn)}</span></div>
                <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted">合计净流入</span><span className={`font-mono font-bold ${north.totalIn >= 0 ? "up" : "down"}`}>{fmtMoney(north.totalIn)}</span></div>
              </div>
            )}
          </div>
        )}

        {stockWatch.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-2">我的自选（{stockWatch.length}）</h3>
            <div className="space-y-1">
              {stockWatch.map((w) => (
                <div key={w.secid} className="flex items-center gap-2 text-xs">
                  <Link href={`/stock?q=${encodeURIComponent(w.name)}`} className="font-medium hover:text-primary flex-1">{w.name}</Link>
                  <span className="text-[10px] text-muted font-mono">{w.code}</span>
                  <button onClick={() => toggle(w)} className="text-muted hover:text-red-500" aria-label={`移出「${w.name}」自选`}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {sectorWatch.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-2">自选板块（{sectorWatch.length}）</h3>
            <div className="flex flex-wrap gap-2">
              {sectorWatch.map((w) => (
                <span key={w.secid} className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2 py-1">
                  <Link href={`/sector?bk=${w.code}`} className="hover:text-primary">{w.name}</Link>
                  <button onClick={() => toggle(w)} className="text-muted hover:text-red-500" aria-label={`移出「${w.name}」自选`}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="card p-4 bg-primary/5 border-primary/20">
          <p className="text-xs text-muted leading-relaxed">
            <span className="font-semibold">下钻路径：</span>
            大盘指数 → 板块资金流 → 个股评分 → 产业链全景。
            点击板块名或个股可直达对应分析页；板块资金流约 2 分钟延迟。
          </p>
        </div>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-md bg-foreground text-background px-3 py-1.5 text-xs shadow-lg">
          {toast}
        </div>
      )}

      {/* 仅在真正打开抽屉时才挂载：StockDrawer 无条件挂载会立刻触发其动态导入，
          连带把 EChart → ECharts（263KB）拉进首屏，使按需加载形同虚设 */}
      {drawer && <StockDrawer stock={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function SectorRowComp({
  s,
  index,
  has,
  toggle,
  onToggleStar,
  expanded,
  detailLoading,
  details,
  onToggleExpand,
  onOpenDrawer,
}: {
  s: SectorRow;
  index: number;
  has: (code: string) => boolean;
  toggle: (w: WatchItem) => void;
  onToggleStar: () => void;
  expanded: boolean;
  detailLoading: boolean;
  details?: SectorStock[];
  onToggleExpand: () => void;
  onOpenDrawer: (st: DrawerStock) => void;
}) {
  return (
    <>
      <tr onClick={onToggleExpand} className="border-b border-border/50 last:border-0 cursor-pointer">
        <th scope="row" className="py-1.5 pr-2 text-left font-normal">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted font-mono w-5">{index + 1}</span>
            <Link
              href={`/sector?bk=${s.code}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium hover:text-primary whitespace-nowrap"
            >
              {s.name}
            </Link>
            {s.tier ? (
              <span className="text-[9px] text-muted border border-border/60 rounded px-1" title="东财细分分册，与母板块成分重叠">分册</span>
            ) : null}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar();
              }}
              className={`text-[10px] ${has(s.code) ? "text-red-500" : "text-muted hover:text-primary"}`}
              title="自选板块"
              aria-label={has(s.code) ? `移出「${s.name}」自选` : `将「${s.name}」加入自选`}
              aria-pressed={has(s.code)}
            >
              {has(s.code) ? "★" : "☆"}
            </button>
            <span className={`text-[10px] text-muted transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden>▸</span>
          </div>
        </th>
        <td className={`num text-right px-2 font-mono ${s.changePct >= 0 ? "up" : "down"}`}>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%</td>
        <td className={`num text-right px-2 font-mono font-medium ${s.mainNetIn >= 0 ? "up" : "down"}`}>{s.mainNetIn >= 0 ? "+" : ""}{fmtMoney(s.mainNetIn)}</td>
        <td className="num text-right px-2 font-mono hidden sm:table-cell text-muted">{s.mainPct.toFixed(2)}%</td>
        <td className="num text-right px-2 font-mono hidden md:table-cell text-muted">{s.amount >= 1e8 ? `${(s.amount / 1e8).toFixed(1)}亿` : fmtMoney(s.amount)}</td>
        <td className="px-2 hidden lg:table-cell">
          {s.leader ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDrawer({ name: s.leader!.name, secid: s.leader!.secid });
              }}
              className="text-left hover:text-primary"
              title="板块内当日涨幅第一的个股"
            >
              <span className="text-xs font-medium">{s.leader.name}</span>
              {s.leader.pct != null && (
                <span className={`block text-[10px] font-mono ${s.leader.pct >= 0 ? "up" : "down"}`}>
                  {s.leader.pct >= 0 ? "+" : ""}{s.leader.pct.toFixed(2)}%
                </span>
              )}
            </button>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </td>
        <td className="text-right pl-2">
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/sector?bk=${s.code}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-muted hover:text-primary border border-border/60 rounded px-1.5 py-0.5"
              title="板块中心：K 线 + 资金流联动 + 成分股"
            >
              走势
            </Link>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/50">
          <td colSpan={7} className="py-2 pl-8 pr-2">
            <p className="text-[10px] text-muted mb-1.5">板块成分股主力净流入 Top10（点击个股进入分析页）</p>
            {detailLoading ? (
              <LoadingRegion rows={3} />
            ) : details && details.length ? (
              <div className="divide-y divide-border/50">
                {details.map((st, i) => (
                  <Link
                    key={st.secid}
                    href={`/stock?q=${encodeURIComponent(st.name)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 py-1 text-xs hover:text-primary"
                  >
                    <span className="w-4 text-[10px] text-muted font-mono">{i + 1}</span>
                    <span className="font-medium flex-1">{st.name}</span>
                    <span className={`font-mono ${st.pct >= 0 ? "up" : "down"}`}>{st.pct >= 0 ? "+" : ""}{st.pct.toFixed(2)}%</span>
                    <span className={`font-mono font-medium ${st.mainNet >= 0 ? "up" : "down"}`}>{st.mainNet >= 0 ? "+" : ""}{fmtMoney(st.mainNet)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="该板块暂无个股明细" className="py-4" />
            )}
          </td>
        </tr>
      )}
    </>
  );
}