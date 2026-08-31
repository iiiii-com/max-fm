"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp, TrendingDown, Flame, LayoutGrid } from "lucide-react";
import SectorKlinePanel, { type DetailSector } from "./SectorKlinePanel";
import { useWatchlist } from "@/lib/hooks/useWatchlist";

interface BoardLeader {
  name: string;
  secid: string;
  pct: number;
  mainNet: number;
}

interface BoardSector {
  code: string;
  name: string;
  price: number;
  changePct: number;
  mainNetIn: number;
  mainPct: number;
  amount: number;
  up: number;
  down: number;
  flat: number;
  leader: BoardLeader | null;
}

interface RankItem {
  code: string;
  name: string;
  mainFlow: number;
  pct: number | null;
}

interface HotItem {
  code: string;
  name: string;
  pct: number | null;
  up: number;
  down: number;
  flat: number;
}

interface BoardResp {
  ok: boolean;
  updated?: string;
  source?: string;
  list?: BoardSector[];
  rankIn?: RankItem[];
  rankOut?: RankItem[];
  hot?: HotItem[];
}

interface SectorStock {
  name: string;
  secid: string;
  price: number;
  pct: number;
  mainNet: number;
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

type SortKey = "changePct" | "mainNetIn" | "mainPct" | "amount";

/** 板块中心：行情全列表 + 资金排行 + 热点 + 详情面板（K线/资金历史/成分股） */
export default function SectorCenter({ initialBk }: { initialBk?: string }) {
  const { toggle, has } = useWatchlist();
  const [data, setData] = useState<BoardResp | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("mainNetIn");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, SectorStock[]>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [active, setActive] = useState<DetailSector | null>(null);

  const load = () => {
    setLoading(true);
    setErr("");
    fetch("/api/sector/board?top=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setData(j) : setErr(j?.error ?? "加载失败")))
      .catch((e) => setErr(e?.message ?? "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // 深链 ?bk=BKxxxx：数据就绪后自动打开对应板块详情
  useEffect(() => {
    if (!initialBk || !data || active) return;
    const s = data.list?.find((x) => x.code === initialBk);
    if (s) setActive({ code: s.code, name: s.name, changePct: s.changePct, mainNetIn: s.mainNetIn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBk, data]);

  const loadDetail = async (code: string) => {
    if (detailMap[code]) return;
    setDetailLoading(code);
    try {
      const res = await fetch(`/api/sector/flow/detail?bk=${code}`, { cache: "no-store" });
      const j = await res.json();
      setDetailMap((m) => ({ ...m, [code]: Array.isArray(j?.list) ? j.list : [] }));
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

  const openDetail = (s: BoardSector) => {
    setActive({ code: s.code, name: s.name, changePct: s.changePct, mainNetIn: s.mainNetIn });
    if (typeof window !== "undefined") {
      document.getElementById("sector-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const sorted = useMemo(() => {
    const list = [...(data?.list ?? [])];
    const dir = sortDir;
    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return (va - vb) * dir;
    });
    return list;
  }, [data, sortKey, sortDir]);

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === -1 ? 1 : -1));
    else {
      setSortKey(k);
      setSortDir(-1);
    }
  };

  const list = data?.list ?? [];
  const upCount = list.filter((s) => s.changePct > 0).length;
  const downCount = list.filter((s) => s.changePct < 0).length;
  const sumFlow = list.reduce((acc, s) => acc + s.mainNetIn, 0);

  return (
    <div className="space-y-5">
      {/* 统计条 */}
      {!err && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3">
            <p className="text-[11px] text-muted">行业板块</p>
            <p className="text-lg font-bold font-mono mt-0.5">{list.length}</p>
          </div>
          <div className="card p-3">
            <p className="text-[11px] text-muted">上涨 / 下跌</p>
            <p className="text-lg font-bold font-mono mt-0.5">
              <span className="up">{upCount}</span>
              <span className="text-muted"> / </span>
              <span className="down">{downCount}</span>
            </p>
          </div>
          <div className="card p-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-muted">主力净流入合计</p>
            <p className={`text-lg font-bold font-mono mt-0.5 ${sumFlow >= 0 ? "up" : "down"}`}>
              {sumFlow >= 0 ? "+" : ""}{fmtMoney(sumFlow)}
            </p>
          </div>
          <div className="card p-3 col-span-2 sm:col-span-1 hidden sm:block">
            <p className="text-[11px] text-muted">数据源</p>
            <p className="text-xs text-muted mt-1.5 leading-snug truncate">{data.source ?? "东方财富"}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {data?.updated ? `更新 ${new Date(data.updated).toLocaleTimeString("zh-CN", { hour12: false })}` : "加载中…"}
        </p>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border text-muted hover:text-primary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
        </button>
      </div>

      {err ? (
        <p className="text-sm text-muted py-8 text-center">{err}</p>
      ) : loading && !data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-96 animate-pulse bg-muted/10 rounded-lg" />
          <div className="space-y-3">
            <div className="h-48 animate-pulse bg-muted/10 rounded-lg" />
            <div className="h-48 animate-pulse bg-muted/10 rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* 板块行情全列表 */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-sm">板块行情全列表</h2>
                <span className="text-[10px] text-muted">点击行展开成分股 · 走势进入详情</span>
              </div>
              <div className="relative">
                <div className="overflow-x-auto">
                <table className="w-full text-sm table-stripe">
                  <thead>
                    <tr className="text-xs text-muted border-b border-border">
                      <th scope="col" className="text-left py-2 pr-2">板块</th>
                      <th scope="col" className="text-right px-2 cursor-pointer hover:text-primary" onClick={() => setSort("changePct")}>
                        涨跌幅{sortKey === "changePct" ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                      </th>
                      <th scope="col" className="text-right px-2 cursor-pointer hover:text-primary" onClick={() => setSort("mainNetIn")}>
                        主力净流入{sortKey === "mainNetIn" ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                      </th>
                      <th scope="col" className="text-right px-2 hidden sm:table-cell cursor-pointer hover:text-primary" onClick={() => setSort("mainPct")}>
                        净占比{sortKey === "mainPct" ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                      </th>
                      <th scope="col" className="text-right px-2 hidden md:table-cell cursor-pointer hover:text-primary" onClick={() => setSort("amount")}>
                        成交额{sortKey === "amount" ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                      </th>
                      <th scope="col" className="text-right pl-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s, i) => {
                      const open = expanded === s.code;
                      const details = detailMap[s.code];
                      return (
                        <FragmentRow key={s.code} open={open}>
                          <tr
                            onClick={() => toggleExpand(s.code)}
                            className="border-b border-border/50 last:border-0 cursor-pointer"
                          >
                            <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted font-mono w-5">{i + 1}</span>
                                <Link
                                  href={`/sector?bk=${s.code}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-medium hover:text-primary whitespace-nowrap"
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
                                  aria-label={has(s.code) ? `移出「${s.name}」自选` : `将「${s.name}」加入自选`}
                                  aria-pressed={has(s.code)}
                                >
                                  {has(s.code) ? "★" : "☆"}
                                </button>
                                <span className={`text-[10px] text-muted transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
                              </div>
                            </th>
                            <td className={`text-right px-2 font-mono ${s.changePct >= 0 ? "up" : "down"}`}>
                              {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                            </td>
                            <td className={`text-right px-2 font-mono font-medium ${s.mainNetIn >= 0 ? "up" : "down"}`}>{fmtMoney(s.mainNetIn)}</td>
                            <td className="text-right px-2 font-mono hidden sm:table-cell text-muted">{s.mainPct.toFixed(2)}%</td>
                            <td className="text-right px-2 font-mono hidden md:table-cell text-muted">{s.amount >= 1e8 ? `${(s.amount / 1e8).toFixed(1)}亿` : fmtMoney(s.amount)}</td>
                            <td className="text-right pl-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetail(s);
                                }}
                                className="text-[10px] text-muted hover:text-primary border border-border/60 rounded px-1.5 py-0.5"
                                title="打开板块详情"
                              >
                                走势
                              </button>
                            </td>
                          </tr>
                          {open && (
                            <tr className="border-b border-border/50">
                              <td colSpan={6} className="py-2 pl-8 pr-2">
                                <p className="text-[10px] text-muted mb-1.5">板块个股主力净流入 Top10（点击进入个股深度页）</p>
                                {detailLoading === s.code ? (
                                  <p className="text-xs text-muted">加载中…</p>
                                ) : details && details.length ? (
                                  <div className="divide-y divide-border/50">
                                    {details.map((st, j) => (
                                      <Link
                                        key={st.secid}
                                        href={`/stock/${st.secid}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-2 py-1 text-xs hover:text-primary"
                                      >
                                        <span className="text-muted font-mono w-4 shrink-0">{j + 1}</span>
                                        <span className="font-medium truncate flex-1">{st.name}</span>
                                        <span className={`font-mono shrink-0 ${st.pct >= 0 ? "up" : "down"}`}>
                                          {st.pct >= 0 ? "+" : ""}{st.pct.toFixed(2)}%
                                        </span>
                                        <span className={`font-mono shrink-0 ${st.mainNet >= 0 ? "up" : "down"}`}>{fmtMoney(st.mainNet)}</span>
                                      </Link>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted">暂无成分股数据</p>
                                )}
                              </td>
                            </tr>
                          )}
                        </FragmentRow>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                {/* 移动端右侧渐隐遮罩：暗示可横向滑动 */}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent sm:hidden" aria-hidden />
                <p className="text-[10px] text-muted mt-1 sm:hidden">← 左右滑动查看完整表格 →</p>
              </div>
            </div>
          </div>

          {/* 右侧：资金排行 + 热点 */}
          <div className="space-y-4">
            <div className="card p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                <TrendingUp className="w-4 h-4" /> 板块资金流入 Top10
              </h3>
              <RankList items={data?.rankIn ?? []} />
            </div>
            <div className="card p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                <TrendingDown className="w-4 h-4" /> 板块资金流出 Top10
              </h3>
              <RankList items={data?.rankOut ?? []} />
            </div>
            <div className="card p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                <Flame className="w-4 h-4" /> 板块涨幅热点
              </h3>
              <div className="space-y-1">
                {(data?.hot ?? []).map((s, i) => (
                  <Link
                    key={s.code}
                    href={`/sector?bk=${s.code}`}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/20 text-xs"
                  >
                    <span className="text-muted font-mono w-4 shrink-0">{i + 1}</span>
                    <span className="font-medium truncate flex-1">{s.name}</span>
                    <span className={`font-mono font-bold shrink-0 ${(s.pct ?? 0) >= 0 ? "up" : "down"}`}>{fmtPct(s.pct)}</span>
                    <span className="text-[10px] text-muted font-mono shrink-0">
                      <span className="up">{s.up}</span>
                      {s.down > 0 ? <span className="down ml-1">{s.down}</span> : null}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 板块详情面板 */}
      <div id="sector-detail">
        {active && <SectorKlinePanel sector={active} onClose={() => setActive(null)} />}
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        口径：涨跌幅 / 主力净流入 = 超大单+大单净额（东财口径）；净占比 = 主力净流入占成交额比例；数据 20 秒级延迟，仅作研究参考，不构成投资建议。
      </p>
    </div>
  );
}

function FragmentRow({ children, open }: { children: React.ReactNode; open: boolean }) {
  return <>{children}</>;
}

function RankList({ items }: { items: RankItem[] }) {
  if (!items.length) return <p className="text-xs text-muted py-3 text-center">暂无数据</p>;
  return (
    <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
      {items.map((it, i) => (
        <Link
          key={it.code}
          href={`/sector?bk=${it.code}`}
          className="flex items-center gap-2 py-1.5 text-xs hover:bg-muted/20 rounded px-1"
        >
          <span className="text-muted font-mono w-4 shrink-0">{i + 1}</span>
          <span className="font-medium truncate flex-1">{it.name}</span>
          <span className={`font-mono font-bold shrink-0 ${it.mainFlow >= 0 ? "up" : "down"}`}>
            {it.mainFlow >= 0 ? "+" : ""}{(it.mainFlow / 1e8).toFixed(1)}亿
          </span>
        </Link>
      ))}
    </div>
  );
}
