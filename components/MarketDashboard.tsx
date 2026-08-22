"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import StockDrawer, { type DrawerStock } from "@/components/StockDrawer";
import SectorDrawer, { type DrawerSector } from "@/components/SectorDrawer";
import { useWatchlist, type WatchItem } from "@/lib/hooks/useWatchlist";
import { useRefresh } from "@/lib/hooks/refresh";

interface SectorLeader {
  name: string;
  secid: string;
  pct: number;
  mainNet: number;
}

interface SectorRow {
  code: string;
  name: string;
  price: number;
  changePct: number;
  mainNetIn: number;
  mainPct: number;
  amount: number;
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
  const [north, setNorth] = useState<Northbound | null>(null);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"table" | "bar">("table");
  const [sortKey, setSortKey] = useState<"changePct" | "mainNetIn" | "amount" | "mainPct">("mainNetIn");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, SectorStock[]>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerStock | null>(null);
  const [sectorDrawer, setSectorDrawer] = useState<DrawerSector | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/sector/flow", { cache: "no-store" });
      const j = await res.json();
      if (j?.ok) {
        setSectors(j.sectors || []);
        setNorth(j.northbound);
      } else setErr(j?.error ?? "加载失败");
    } catch {
      setErr("资金流数据暂不可用");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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

  const sortedSectors = useMemo(() => {
    return [...sectors].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return (vb - va) * sortDir;
    });
  }, [sectors, sortKey, sortDir]);

  const toggleSort = (key: "changePct" | "mainNetIn" | "amount" | "mainPct") => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "changePct" ? -1 : -1);
    }
  };

  const SortTh = ({ k, children, className = "" }: { k: "changePct" | "mainNetIn" | "amount" | "mainPct"; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${className}`}
      title="点击排序"
    >
      {children}
      <span className="text-[9px] opacity-70">{sortKey === k ? (sortDir === -1 ? "↓" : "↑") : "↕"}</span>
    </button>
  );

  const barOption = useMemo<EChartsOption>(() => {
    const vals = sectors.map((s) => s.mainNetIn / 1e8);
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
          if (!p || !sectors[p.dataIndex]) return "";
          const s = sectors[p.dataIndex];
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
        data: sectors.map((s) => s.name),
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
              borderRadius: [0, 3, 3, 0],
              color:
                v >= 0
                  ? { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "rgba(220,38,38,0.3)" }, { offset: 1, color: "#dc2626" }] }
                  : { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: "rgba(22,163,74,0.3)" }, { offset: 1, color: "#16a34a" }] },
            },
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
  }, [sectors]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">板块资金流 Top 30</h2>
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
        {err && <p className="text-xs text-red-600 mb-2">{err}</p>}

        {view === "bar" ? (
          sectors.length ? (
            <EChart option={barOption} height={Math.max(480, sectors.length * 20 + 60)} />
          ) : (
            <p className="text-xs text-muted">暂无数据</p>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th className="text-left py-1.5 pr-2">板块</th>
                  <th className="text-right px-2"><SortTh k="changePct">涨跌幅</SortTh></th>
                  <th className="text-right px-2"><SortTh k="mainNetIn">主力净流入</SortTh></th>
                  <th className="text-right px-2 hidden sm:table-cell"><SortTh k="mainPct">净占比</SortTh></th>
                  <th className="text-right px-2 hidden md:table-cell"><SortTh k="amount">成交额</SortTh></th>
                  <th className="text-left px-2 hidden lg:table-cell">龙头</th>
                  <th className="text-right pl-2"></th>
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
                    expanded={expanded === s.code}
                    detailLoading={detailLoading === s.code}
                    details={detailMap[s.code]}
                    onToggleExpand={() => toggleExpand(s.code)}
                    onOpenDrawer={(st) => setDrawer(st)}
                    onOpenKline={() => setSectorDrawer({ name: s.name, code: s.code, changePct: s.changePct, mainNetIn: s.mainNetIn })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {north && (
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-2">北向资金（{north.date}）</h3>
            <div className="text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-muted">沪股通</span><span className={`font-mono font-medium ${north.shIn >= 0 ? "up" : "down"}`}>{fmtMoney(north.shIn)}</span></div>
              <div className="flex justify-between"><span className="text-muted">深股通</span><span className={`font-mono font-medium ${north.szIn >= 0 ? "up" : "down"}`}>{fmtMoney(north.szIn)}</span></div>
              <div className="flex justify-between border-t border-border pt-1.5"><span className="text-muted">合计净流入</span><span className={`font-mono font-bold ${north.totalIn >= 0 ? "up" : "down"}`}>{fmtMoney(north.totalIn)}</span></div>
            </div>
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
                  <button onClick={() => toggle(w)} className="text-muted hover:text-red-500">×</button>
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
                  <Link href={`/stock?q=${encodeURIComponent(w.name)}`} className="hover:text-primary">{w.name}</Link>
                  <button onClick={() => toggle(w)} className="text-muted hover:text-red-500">×</button>
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

      <StockDrawer stock={drawer} onClose={() => setDrawer(null)} />
      <SectorDrawer sector={sectorDrawer} onClose={() => setSectorDrawer(null)} />
    </div>
  );
}

function SectorRowComp({
  s,
  index,
  has,
  toggle,
  expanded,
  detailLoading,
  details,
  onToggleExpand,
  onOpenDrawer,
  onOpenKline,
}: {
  s: SectorRow;
  index: number;
  has: (code: string) => boolean;
  toggle: (w: WatchItem) => void;
  expanded: boolean;
  detailLoading: boolean;
  details?: SectorStock[];
  onToggleExpand: () => void;
  onOpenDrawer: (st: DrawerStock) => void;
  onOpenKline: () => void;
}) {
  return (
    <>
      <tr onClick={onToggleExpand} className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30">
        <td className="py-1.5 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted font-mono w-5">{index + 1}</span>
            <Link
              href={`/stock?q=${encodeURIComponent(s.name)}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium hover:text-primary"
            >
              {s.name}
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle({ secid: s.code, code: s.code, name: s.name, kind: "sector" });
              }}
              className={`text-[10px] ${has(s.code) ? "text-red-500" : "text-muted hover:text-primary"}`}
              title="自选板块"
            >
              {has(s.code) ? "★" : "☆"}
            </button>
            <span className={`text-[10px] text-muted transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
          </div>
        </td>
        <td className={`text-right px-2 font-mono ${s.changePct >= 0 ? "up" : "down"}`}>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%</td>
        <td className={`text-right px-2 font-mono font-medium ${s.mainNetIn >= 0 ? "up" : "down"}`}>{fmtMoney(s.mainNetIn)}</td>
        <td className="text-right px-2 font-mono hidden sm:table-cell text-muted">{s.mainPct.toFixed(2)}%</td>
        <td className="text-right px-2 font-mono hidden md:table-cell text-muted">{s.amount >= 1e8 ? `${(s.amount / 1e8).toFixed(1)}亿` : fmtMoney(s.amount)}</td>
        <td className="px-2 hidden lg:table-cell">
          {s.leader ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDrawer({ name: s.leader!.name, secid: s.leader!.secid });
              }}
              className="text-left hover:text-primary"
              title="查看龙头详情"
            >
              <span className="text-xs font-medium">{s.leader.name}</span>
              <span className={`block text-[10px] font-mono ${s.leader.pct >= 0 ? "up" : "down"}`}>
                {s.leader.pct >= 0 ? "+" : ""}{s.leader.pct.toFixed(2)}% · {fmtMoney(s.leader.mainNet)}
              </span>
            </button>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </td>
        <td className="text-right pl-2">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenKline();
              }}
              className="text-[10px] text-muted hover:text-primary border border-border/60 rounded px-1.5 py-0.5"
              title="板块 K 线 + 资金流联动"
            >
              走势
            </button>
            <Link
              href={`/stock?q=${encodeURIComponent(s.name)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-muted hover:text-primary"
            >
              查看个股 →
            </Link>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/50">
          <td colSpan={7} className="py-2 pl-8 pr-2">
            <p className="text-[10px] text-muted mb-1.5">板块个股主力净流入 Top10（点击个股进入分析页）</p>
            {detailLoading ? (
              <p className="text-xs text-muted">加载中…</p>
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
                    <span className={`font-mono font-medium ${st.mainNet >= 0 ? "up" : "down"}`}>{fmtMoney(st.mainNet)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">暂无数据</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}