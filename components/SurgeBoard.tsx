"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Flame, RefreshCw, Zap } from "lucide-react";
import { toNum } from "@/lib/utils";

interface SurgeItem {
  code: string;
  name: string;
  market: string;
  price: number | null;
  pct: number | null;
  mainFlow: number | null;
  turnover: number | null;
  reason: string;
}

interface SectorItem {
  code: string;
  name: string;
  pct: number | null;
  up: number;
  down: number;
  flat: number;
}

const fmtFlow = (v: number | null) => (v == null ? "—" : `${(v / 1e8).toFixed(1)}亿`);
const fmtTurnover = (v: number | null) => (v == null ? "—" : `${(v / 1e8).toFixed(0)}亿`);

/** 异动速报 + 热点追踪（东财实时，A股为主） */
export default function SurgeBoard() {
  const [surges, setSurges] = useState<SurgeItem[]>([]);
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [dataAt, setDataAt] = useState("");
  const [stale, setStale] = useState<{ since?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true);
    setErr("");
    fetch("/api/market/surge", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          // 东财接口数值字段类型不稳定（可能是字符串），统一归一化后再渲染，
          // 否则 s.pct?.toFixed() 会因「字符串无 toFixed」抛错崩掉整块面板
          setSurges(
            (j.surges ?? []).map((s: any) => ({
              ...s,
              pct: toNum(s.pct),
              price: toNum(s.price),
              mainFlow: toNum(s.mainFlow),
              turnover: toNum(s.turnover),
            }))
          );
          setSectors(
            (j.sectors ?? []).map((s: any) => ({
              ...s,
              pct: toNum(s.pct),
            }))
          );
          // dataAt 是服务端落库快照里的抓取时间；上游失败时返回的是旧快照，
          // 必须显示这份数据的时间，而不是浏览器收到响应的时间。
          setDataAt(j.dataAt ?? j.updated ?? "");
          // 服务端在上游不可用时会返回最近一次成功快照并标 stale，
          // 这里必须显式提示，否则用户会把陈旧榜单当成实时数据
          setStale(j.stale === true ? { since: j.staleSince } : null);
        } else setErr(j?.error ?? "速报加载失败");
      })
      .catch((e) => setErr(e?.message ?? "加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          数据源：东方财富实时行情（A股为主）{dataAt ? `· 数据时间 ${new Date(dataAt).toLocaleTimeString("zh-CN", { hour12: false })}` : ""}
          {stale ? (
            <span
              className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: "rgba(217,119,6,0.12)", color: "#b45309" }}
              title="上游数据源暂不可用，当前展示的是最近一次成功获取的快照"
            >
              数据陈旧{stale.since ? ` · ${new Date(stale.since).toLocaleTimeString("zh-CN", { hour12: false })} 快照` : ""}
            </span>
          ) : null}
        </p>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border text-muted hover:text-primary hover:border-primary/50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新
        </button>
      </div>

      {err ? (
        <p className="text-sm text-muted py-6 text-center">{err}</p>
      ) : loading && !surges.length ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-3 animate-pulse">
                <div className="h-3 bg-muted/40 rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted/30 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 异动速报 */}
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
              <Zap className="w-4 h-4" /> 异动速报 · 涨幅/资金/成交额异常标的
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {surges.slice(0, 12).map((s) => (
                <Link
                  key={s.code}
                  href={`/stock/${s.market === "沪" ? "1" : s.market === "深" || s.market === "创业板" ? "0" : "1"}.${s.code}`}
                  className="rounded-lg border border-border p-3 hover:border-primary/50 hover:bg-muted/10 transition-colors block"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate">{s.name}</span>
                    <span className="text-[10px] text-muted shrink-0">{s.market}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-sm font-mono font-bold ${(s.pct ?? 0) >= 0 ? "up" : "down"}`}>
                      {(s.pct ?? 0) >= 0 ? "+" : ""}
                      {s.pct?.toFixed(2) ?? "—"}%
                    </span>
                    <span className="text-[10px] text-muted">主力 {fmtFlow(s.mainFlow)}</span>
                    <span className="text-[10px] text-muted">额 {fmtTurnover(s.turnover)}</span>
                  </div>
                  <span
                    className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded ${
                      s.reason.includes("跌") ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {s.reason}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* 热点追踪 */}
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
              <Flame className="w-4 h-4" /> 热点追踪 · 行业板块涨幅榜
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted border-b border-border bg-muted/20">
                    <th className="text-left py-2 pl-3 pr-2 font-medium">板块</th>
                    <th className="text-right py-2 px-2 font-medium">涨跌幅</th>
                    <th className="text-right py-2 pr-3 font-medium">上涨家数</th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s, i) => (
                    <tr key={s.code} className="border-b border-border/40 last:border-0">
                      <td className="py-1.5 pl-3 pr-2 font-medium">
                        <span className="text-muted text-[10px] mr-1">{i + 1}</span>
                        <Link href={`/sector?bk=${s.code}`} className="hover:text-primary">{s.name}</Link>
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono font-bold ${(s.pct ?? 0) >= 0 ? "up" : "down"}`}>
                        {(s.pct ?? 0) >= 0 ? "+" : ""}
                        {s.pct?.toFixed(2) ?? "—"}%
                      </td>
                      <td className="py-1.5 pr-3 text-right text-muted font-mono">
                        <span className="up">{s.up}</span>
                        {s.down > 0 ? <span className="down ml-1">{s.down}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-muted flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            口径：涨跌幅为当日实时；主力净流入 = 超大单+大单净额（东财口径）；数据 20 秒级延迟，仅作研究参考，不构成投资建议。
          </p>
        </>
      )}
    </div>
  );
}
