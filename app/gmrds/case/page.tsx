import Link from "next/link";
import { ArrowLeft, ArrowRight, Database, Scale } from "lucide-react";
import { Card } from "@/components/ui";
import MarketCompareChart from "@/components/gmrds/MarketCompareChart";
import TransferChain from "@/components/gmrds/TransferChain";
import { TRANSFER_CASE } from "@/lib/data/gmrds-deep";
import shIndex from "@/data/sh-index.json";
import usMarket from "@/data/us-market.json";
import GmrdsShell from "@/components/gmrds/GmrdsShell";

export const metadata = { title: "真实数据传导案例 | 研究体系 GMRDS" };

/** 比较窗口：最近 N 个「两边都有同比」的年份 */
const COMPARE_YEARS = 5;

type AnnualPoint = { year: string; close: number; pct: number };

/** 把「年度最后收盘价」序列换算成年涨跌幅（首年只作基期，不返回） */
function toAnnualReturns(closes: { year: string; close: number }[]): AnnualPoint[] {
  const sorted = closes
    .filter((c) => Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.year.localeCompare(b.year));
  const out: AnnualPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    out.push({ year: cur.year, close: cur.close, pct: ((cur.close - prev.close) / prev.close) * 100 });
  }
  return out;
}

/**
 * 上证年度收盘（data/sh-index.json）。
 * 元组结构为 [日期, 开, 收, 高, 低, 量]，收盘价在索引 2（此前误当 3 会让所有点位错位）。
 * 日线按日期升序，逐条写入后最后保留的就是该年最后一个交易日收盘。
 */
function shanghaiAnnualCloses(): { year: string; close: number }[] {
  const last: Record<string, number> = {};
  for (const b of shIndex as unknown as Array<[string, number, number, number, number, number]>) {
    const date = String(b[0] ?? "");
    const close = Number(b[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(close)) continue;
    last[date.slice(0, 4)] = close;
  }
  return Object.entries(last).map(([year, close]) => ({ year, close }));
}

/**
 * 标普500 年度收盘（data/us-market.json）。
 * 注意：`spx` 是对象 `{ name, code, daily, annual }`，不是数组 ——
 * 旧代码直接 `(usMarket as any).spx.filter(...)` 会抛 TypeError，整页内容渲染失败（只剩导航壳）。
 */
function spxAnnualCloses(): { year: string; close: number }[] {
  const spx = (usMarket as { spx?: { annual?: Array<{ year: number; close: number | null }> } }).spx;
  return (spx?.annual ?? [])
    .filter((r) => r.close != null && Number.isFinite(r.close))
    .map((r) => ({ year: String(r.year), close: r.close as number }));
}

/**
 * 两条序列按「年份」对齐：取双方都有同比的年份交集，再取最近 COMPARE_YEARS 年。
 * 不按数组位置对齐，也不允许某一边缺年份时补 0%（那会把「没有数据」画成「持平」）。
 */
function alignedAnnual(): { cn: AnnualPoint[]; us: AnnualPoint[] } {
  const cnAll = toAnnualReturns(shanghaiAnnualCloses());
  const usAll = toAnnualReturns(spxAnnualCloses());
  const usByYear = new Map(usAll.map((d) => [d.year, d]));
  const common = cnAll.filter((d) => usByYear.has(d.year)).slice(-COMPARE_YEARS);
  const years = new Set(common.map((d) => d.year));
  return { cn: common, us: usAll.filter((d) => years.has(d.year)) };
}

export default function TransferCasePage() {
  const { cn, us } = alignedAnnual();
  const cnByYear = new Map(cn.map((d) => [d.year, d]));
  const usByYear = new Map(us.map((d) => [d.year, d]));
  const fmt = (v?: number) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

  const crashCn = cnByYear.get("2022");
  const crashUs = usByYear.get("2022");
  const latest = cn[cn.length - 1];
  const latestIsYtd = latest?.year === String(new Date().getFullYear());
  const recent = ["2024", "2025"]
    .map((y) => {
      const c = cnByYear.get(y);
      const u = usByYear.get(y);
      return c && u ? `${y} 上证 ${fmt(c.pct)} / 标普 ${fmt(u.pct)}` : null;
    })
    .filter(Boolean) as string[];

  return (
    <GmrdsShell>
      <div className="space-y-8">
        {/* 头部 */}
        <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs text-muted mb-3">
            <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
            <span>/</span>
            <span className="text-foreground font-medium">真实数据传导案例</span>
          </div>
          <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">{TRANSFER_CASE.title}</h1>
          <p className="text-sm text-muted leading-relaxed max-w-3xl">
            用本站真实数据演示「宏观 → 行业 → 标的 → 决策」的完整传导链：
            数据均为可溯源真实数值（上证综指日线、标普500 年度、个股前复权 K 线），标注来源与口径。
          </p>
        </section>

        {/* 近5年全球市场真实对比 */}
        <section>
          <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
            <Database className="w-4.5 h-4.5 text-primary" /> 近 5 年真实市场数据 · 上证综指 vs 标普500
          </h2>
          <MarketCompareChart
            cn={cn}
            us={us}
            title="上证综指 vs 标普500 · 年度涨跌（真实数据，按年份对齐）"
            note={latestIsYtd ? `其中 ${latest!.year} 年柱为年内涨跌（截至数据最新交易日，非全年）。` : undefined}
          />

          {/* 数据核对表：图上的每个数都能在此逐项核对，避免"图看错了"和"数据错了"混在一起 */}
          <Card className="overflow-x-auto p-0 mt-3">
            <table className="w-full text-xs min-w-[420px]">
              <thead>
                <tr className="text-muted border-b border-border">
                  <th className="text-left py-2 pl-3 pr-2 font-medium">年份</th>
                  <th className="text-right px-2 py-2 font-medium">上证综指收盘</th>
                  <th className="text-right px-2 py-2 font-medium">上证同比</th>
                  <th className="text-right px-2 py-2 font-medium">标普500 收盘</th>
                  <th className="text-right pr-3 pl-2 py-2 font-medium">标普同比</th>
                </tr>
              </thead>
              <tbody>
                {cn.map((c) => {
                  const u = usByYear.get(c.year);
                  return (
                    <tr key={c.year} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pl-3 pr-2 font-medium tabular-nums">
                        {c.year}
                        {latestIsYtd && c.year === latest!.year && <span className="ml-1 text-[10px] text-muted">年内</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted">{c.close.toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${c.pct >= 0 ? "text-[#c0392b]" : "text-[#1e8449]"}`}>
                        {fmt(c.pct)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted">{u ? u.close.toFixed(2) : "—"}</td>
                      <td className={`pl-2 pr-3 py-1.5 text-right tabular-nums font-medium ${u && u.pct >= 0 ? "text-[#1d4ed8]" : "text-[#6b6862]"}`}>
                        {u ? fmt(u.pct) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <p className="text-[11px] text-muted mt-3 leading-relaxed">
            <b className="text-foreground">解读</b>：
            {crashCn && crashUs ? (
              <>2022 年全球风险资产同步回撤（上证 {fmt(crashCn.pct)} / 标普500 {fmt(crashUs.pct)}）—— 宏观紧缩 + 流动性收紧共振；</>
            ) : null}
            {recent.length > 0 ? <>{recent.join("，")}，A 股政策反转与美股 AI 行情分化上行；</> : null}
            宏观与流动性的方向判断（环节 1/2）先行，直接决定资产配置偏好（环节 4）。
            {latestIsYtd ? `（${latest!.year} 年尚未结束，该年数值为年内涨跌。）` : null}
          </p>
        </section>

        {/* 传导链 */}
        <section>
          <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
            <Scale className="w-4.5 h-4.5 text-primary" /> 宏观 → 行业 → 标的 → 决策 传导链
          </h2>
          <TransferChain />
          <div className="space-y-0 mt-4">
            {TRANSFER_CASE.steps.map((s, i) => (
              <div key={s.no} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold text-white shrink-0"
                    style={{
                      background: s.layer.startsWith("L1")
                        ? "#0284c7"
                        : s.layer.startsWith("L2")
                          ? "#1e8449"
                          : s.layer.startsWith("L3")
                            ? "#be185d"
                            : "#c0392b",
                    }}
                  >
                    {s.no}
                  </span>
                  {i < TRANSFER_CASE.steps.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                </div>
                <Card className="flex-1 mb-4 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">{s.layer}</span>
                    <h3 className="font-bold text-sm">{s.title}</h3>
                  </div>
                  <p className="text-xs text-muted leading-relaxed mb-2">{s.detail}</p>
                  <ul className="space-y-0.5">
                    {s.data.map((d) => (
                      <li key={d} className="text-[11px] text-muted flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">▸</span> {d}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted leading-relaxed">{TRANSFER_CASE.note}</p>
        </section>

        {/* 底部导航 */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Link href="/gmrds/flow" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
            <ArrowLeft className="w-3.5 h-3.5" /> 十一环节详解
          </Link>
          <Link href="/gmrds/data-platform" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            数据互通机制 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </GmrdsShell>
  );
}
