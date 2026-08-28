"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import SectorFundHistory from "@/components/SectorFundHistory";

interface RankItem { code: string; name: string; mainFlow: number; pct: number | null }
interface RankData {
  ok: boolean;
  sectorIn?: RankItem[];
  sectorOut?: RankItem[];
  stockIn?: RankItem[];
  updated?: string;
}

const fmt = (v: number) => `${v >= 0 ? "+" : ""}${(v / 1e8).toFixed(1)}亿`;
const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

function RankTable({ title, items, tone, icon }: { title: string; items: RankItem[]; tone: "in" | "out"; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <p className={`text-[11px] font-bold px-3 py-1.5 border-b border-border bg-muted/20 flex items-center gap-1 ${tone === "in" ? "up" : "down"}`}>
        {icon}{title}
      </p>
      <div className="max-h-56 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {items.map((it, i) => (
              <tr key={it.code} className="border-b border-border/40 last:border-0">
                <td className="py-1 pl-3 pr-1 text-muted text-[10px] font-mono w-5">{i + 1}</td>
                <td className="py-1 pr-2">
                  <Link href={it.code.startsWith("BK") ? `/industry` : `/stock/${it.code.startsWith("6") ? "1" : "0"}.${it.code}`} className="text-[12px] font-medium hover:text-primary">
                    {it.name}
                  </Link>
                </td>
                <td className="py-1 px-2 text-right font-mono text-[12px] font-bold hidden sm:table-cell">{fmtPct(it.pct)}</td>
                <td className={`py-1 pr-3 text-right font-mono text-[12px] font-bold ${it.mainFlow >= 0 ? "up" : "down"}`}>{fmt(it.mainFlow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 板块/个股主力资金流入流出排名（东财实时） */
export default function FundRank() {
  const [d, setD] = useState<RankData | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setErr("");
    fetch("/api/market/fund-rank", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setD(j) : setErr(j?.error ?? "加载失败")))
      .catch((e) => setErr(e?.message ?? "加载失败"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (err) return <p className="text-sm text-muted py-4 text-center">{err}</p>;
  if (loading && !d) return <div className="h-40 animate-pulse bg-muted/10 rounded-lg" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          主力资金 = 超大单+大单（东财口径）{d?.updated ? `· 更新 ${new Date(d.updated).toLocaleTimeString("zh-CN", { hour12: false })}` : ""}
        </p>
        <button onClick={load} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border text-muted hover:text-primary transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RankTable title="板块流入 Top10" items={d?.sectorIn ?? []} tone="in" icon={<TrendingUp className="w-3.5 h-3.5" />} />
        <RankTable title="板块流出/最弱 Top10" items={d?.sectorOut ?? []} tone="out" icon={<TrendingDown className="w-3.5 h-3.5" />} />
        <RankTable title="个股流入 Top10" items={d?.stockIn ?? []} tone="in" icon={<TrendingUp className="w-3.5 h-3.5" />} />
      </div>
      <SectorFundHistory sectors={(d?.sectorIn ?? []).map((s) => ({ code: s.code, name: s.name, mainFlow: s.mainFlow }))} />
      <p className="text-[10px] text-muted">数据源：东方财富实时资金流 · 20 秒级延迟 · 点击个股进入深度页（板块跳转产业链）</p>
    </div>
  );
}
