import Link from "next/link";
import { ArrowLeft, ArrowRight, Database, Scale } from "lucide-react";
import { Card } from "@/components/ui";
import MarketCompareChart from "@/components/gmrds/MarketCompareChart";
import TransferChain from "@/components/gmrds/TransferChain";
import { TRANSFER_CASE } from "@/lib/data/gmrds-deep";
import shIndex from "@/data/sh-index.json";
import usMarket from "@/data/us-market.json";

export const metadata = { title: "真实数据传导案例 | 研究体系 GMRDS" };

/** 上证年度数据（真实） */
function shanghaiAnnual(): { year: string; close: number; pct: number }[] {
  const years: Record<string, number> = {};
  for (const b of shIndex as [string, number, number, number, number][]) {
    if (b[0] >= "2021-01-01") years[b[0].slice(0, 4)] = b[2];
  }
  const keys = Object.keys(years);
  return keys.slice(1).map((y, i) => {
    const prev = years[keys[i]];
    const cur = years[y];
    return { year: y, close: cur, pct: ((cur - prev) / prev) * 100 };
  });
}

/** 标普500 年度数据（真实） */
function spxAnnual(): { year: string; close: number; pct: number }[] {
  const spx = (usMarket as any).spx as Array<{ year: number; close: number | null }>;
  return spx
    .filter((r) => r.year >= 2021 && r.close != null)
    .map((r, i, arr) => ({
      year: String(r.year),
      close: r.close!,
      pct: i > 0 && arr[i - 1].close ? ((r.close! - arr[i - 1].close!) / arr[i - 1].close!) * 100 : 0,
    }));
}

export default function TransferCasePage() {
  const cn = shanghaiAnnual();
  const us = spxAnnual();

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
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
          title="上证综指 vs 标普500 · 年度涨跌（真实数据）"
        />
        <p className="text-[11px] text-muted mt-3 leading-relaxed">
          <b className="text-foreground">解读</b>：2022 年全球风险资产同步回撤（上证 -15.1% / 标普 -19.4%）——宏观紧缩 + 流动性收紧共振；
          2024-2025 年 A 股政策反转与美股 AI 行情分化上行。宏观与流动性的方向判断（环节 1/2）先行，直接决定资产配置偏好（环节 4）。
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
                <span className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold text-white shrink-0"
                  style={{ background: s.layer.startsWith("L1") ? "#0ea5e9" : s.layer.startsWith("L2") ? "#10b981" : s.layer.startsWith("L3") ? "#ec4899" : "#c8102e" }}>
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
  );
}
