"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import SectorFundHistory from "@/components/SectorFundHistory";
import { toNum } from "@/lib/utils";

interface RankItem { code: string; name: string; mainFlow: number | null; pct: number | null }
interface RankData {
  ok: boolean;
  sectorIn?: RankItem[];
  sectorOut?: RankItem[];
  stockIn?: RankItem[];
  updated?: string;
  /** 数据抓取时间（服务端落库快照里的 dataAt）：只用来标注「这份榜单是什么时候的」 */
  dataAt?: string;
  /** 上游不可用时的陈旧快照标记（服务端显式给出，绝不冒充实时） */
  stale?: boolean;
  staleSince?: string;
}

// 东财资金流接口对缺失数值返回字符串 "-"（不是 null）。旧实现直接 v.toFixed(2)，
// 遇到 "-" 会抛 TypeError: v.toFixed is not a function，整块资金流面板被 React 卸载。
// 现在数值一律先 toNum 归一化：null 就渲染「—」，绝不补 0（补 0 会被误读成真实资金流为 0）。
const fmtFlow = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v / 1e8).toFixed(1)}亿`);
const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

const normalizeRank = (rows: unknown): RankItem[] =>
  Array.isArray(rows)
    ? rows.map((it: any) => ({ code: String(it?.code ?? ""), name: String(it?.name ?? ""), mainFlow: toNum(it?.mainFlow), pct: toNum(it?.pct) }))
    : [];

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
                <th scope="row" className="py-1 pl-3 pr-1 text-muted text-[10px] font-mono w-5 text-left font-normal">{i + 1}</th>
                <td className="py-1 pr-2">
                  <Link href={it.code.startsWith("BK") ? `/sector?bk=${it.code}` : `/stock/${it.code.startsWith("6") ? "1" : "0"}.${it.code}`} className="text-[12px] font-medium hover:text-primary">
                    {it.name}
                  </Link>
                </td>
                <td className="py-1 px-2 text-right font-mono text-[12px] font-bold hidden sm:table-cell">{fmtPct(it.pct)}</td>
                <td className={`py-1 pr-3 text-right font-mono text-[12px] font-bold ${(it.mainFlow ?? 0) >= 0 ? "up" : "down"}`}>{fmtFlow(it.mainFlow)}</td>
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
      .then((j) =>
        j?.ok
          ? setD({
              ok: true,
              updated: j.updated,
              dataAt: j.dataAt,
              stale: j.stale === true,
              staleSince: j.staleSince,
              sectorIn: normalizeRank(j.sectorIn),
              sectorOut: normalizeRank(j.sectorOut),
              stockIn: normalizeRank(j.stockIn),
            })
          : setErr(j?.error ?? "加载失败")
      )
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
          主力资金 = 超大单+大单（东财口径）
          {/* 数据时间一律取自服务端的 dataAt（落库快照时间），而不是浏览器收到响应的时间：
              上游失败时服务端会返回带 dataAt 的陈旧快照，这里必须显示那份数据的时间。 */}
          {(d?.dataAt ?? d?.updated) ? `· 数据时间 ${new Date(d?.dataAt ?? d!.updated!).toLocaleTimeString("zh-CN", { hour12: false })}` : ""}
          {d?.stale ? (
            <span
              className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: "rgba(217,119,6,0.12)", color: "#b45309" }}
              title="上游数据源暂不可用，当前展示的是最近一次成功获取的榜单"
            >
              数据陈旧{d.staleSince ? ` · ${new Date(d.staleSince).toLocaleTimeString("zh-CN", { hour12: false })} 快照` : ""}
            </span>
          ) : null}
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
      <p className="text-[10px] text-muted">数据源：东方财富实时资金流 · 20 秒级延迟 · 上游不可用时展示最近一次成功快照并标注「数据陈旧」及快照时间 · 点击个股进入深度页（板块跳转产业链）</p>
    </div>
  );
}
