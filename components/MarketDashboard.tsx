"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWatchlist } from "@/lib/hooks/useWatchlist";

interface SectorRow {
  code: string;
  name: string;
  price: number;
  changePct: number;
  mainNetIn: number;
  mainPct: number;
  amount: number;
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
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [north, setNorth] = useState<Northbound | null>(null);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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
  }, []);

  const stockWatch = items.filter((i) => i.kind === "stock" || i.kind === "index" || i.kind === "etf");
  const sectorWatch = items.filter((i) => i.kind === "sector");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">板块资金流 Top 30</h2>
          <button onClick={load} disabled={refreshing} className="text-xs px-2 py-1 rounded-md border border-border hover:border-primary/50 disabled:opacity-50">
            {refreshing ? "刷新中…" : "刷新"}
          </button>
        </div>
        {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-1.5 pr-2">板块</th>
                <th className="text-right px-2">涨跌幅</th>
                <th className="text-right px-2">主力净流入</th>
                <th className="text-right px-2 hidden sm:table-cell">净占比</th>
                <th className="text-right px-2 hidden md:table-cell">成交额</th>
                <th className="text-right pl-2"></th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((s, i) => (
                <tr key={s.code} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted font-mono w-5">{i + 1}</span>
                      <Link href={`/stock?q=${encodeURIComponent(s.name)}`} className="font-medium hover:text-primary">
                        {s.name}
                      </Link>
                      <button
                        onClick={() => toggle({ secid: s.code, code: s.code, name: s.name, kind: "sector" })}
                        className={`text-[10px] ${has(s.code) ? "text-red-500" : "text-muted hover:text-primary"}`}
                        title="自选板块"
                      >
                        {has(s.code) ? "★" : "☆"}
                      </button>
                    </div>
                  </td>
                  <td className={`text-right px-2 font-mono ${s.changePct >= 0 ? "up" : "down"}`}>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%</td>
                  <td className={`text-right px-2 font-mono font-medium ${s.mainNetIn >= 0 ? "up" : "down"}`}>{fmtMoney(s.mainNetIn)}</td>
                  <td className="text-right px-2 font-mono hidden sm:table-cell text-muted">{s.mainPct.toFixed(2)}%</td>
                  <td className="text-right px-2 font-mono hidden md:table-cell text-muted">{s.amount >= 1e8 ? `${(s.amount / 1e8).toFixed(1)}亿` : fmtMoney(s.amount)}</td>
                  <td className="text-right pl-2">
                    <Link href={`/stock?q=${encodeURIComponent(s.name)}`} className="text-[10px] text-muted hover:text-primary">查看个股 →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}