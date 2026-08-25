import Link from "next/link";
import { ArrowLeft, BookOpenCheck, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";
import { CASES, caseById } from "@/lib/data/gmrds-practical";
import { academyBySlug } from "@/lib/data/gmrds";

export const metadata = { title: "真实案例库 | 研究体系 GMRDS" };

const FLOW_TITLES: Record<number, string> = {
  1: "宏观研判", 2: "流动性评估", 3: "周期定位", 4: "行业景气", 5: "盈利评估",
  6: "估值判断", 7: "技术确认", 8: "情绪评估", 9: "风险评估", 10: "仓位决策", 11: "复盘优化",
};

export default function CasesPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">真实案例库</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">案例驱动的实操教学库</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          以真实著名事件佐证各环节方法论：财务造假（安然/瑞幸）、杠杆与流动性危机（雷曼）、
          长期价值（可口可乐）、情绪与做空（特斯拉）、行业转型（微软）。
          每个案例标注对应的决策环节与学院，让抽象理论落地为可复用的判断标准。
        </p>
      </section>

      {/* 案例卡片 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CASES.map((c) => (
          <Card key={c.id} className="p-5 flex flex-col">
            <div className="flex items-start gap-3 mb-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                <BookOpenCheck className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-base">{c.name}</h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted">{c.period}</span>
                </div>
                <p className="text-[11px] text-primary font-medium mt-0.5">{c.topic}</p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed mb-3">{c.story}</p>

            <div className="rounded-lg border border-border bg-background/60 p-3 mb-3">
              <p className="text-[11px] font-bold text-primary mb-1.5">关键数据</p>
              <ul className="space-y-1">
                {c.keyData.map((d) => (
                  <li key={d} className="text-[11px] text-muted flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" /> {d}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/4 p-3 mb-3">
              <p className="text-[11px] font-bold text-primary mb-1">方法论教训</p>
              <p className="text-[11px] text-muted leading-relaxed">{c.lesson}</p>
            </div>

            <div className="mt-auto space-y-2">
              <p className="text-[11px] font-semibold text-muted">关联环节与方法论应用</p>
              <div className="flex flex-wrap gap-1">
                {c.flowNos.map((n) => (
                  <Link key={n} href={`/gmrds/flow#step-${n}`} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15">
                    环节 {n} · {FLOW_TITLES[n]}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {c.academySlugs.map((s) => {
                  const a = academyBySlug(s);
                  return a ? (
                    <Link key={s} href={`/gmrds/${s}`} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted hover:border-primary/40">
                      {a.name}
                    </Link>
                  ) : null;
                })}
              </div>
              <p className="text-[11px] text-muted leading-relaxed pt-1 border-t border-border/60">{c.applyTo}</p>
            </div>
          </Card>
        ))}
      </section>

      {/* 案例 → 环节 索引 */}
      <section>
        <h2 className="font-bold text-base mb-3">案例 ↔ 环节 索引</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pl-4 pr-3 font-medium">决策环节</th>
                <th className="text-left px-3 font-medium">可参考案例</th>
                <th className="text-left px-3 pr-4 font-medium">核心启示</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => {
                const related = CASES.filter((c) => c.flowNos.includes(n));
                return (
                  <tr key={n} className="border-b border-border/50 last:border-0 align-top">
                    <td className="py-2.5 pl-4 pr-3 font-medium whitespace-nowrap">环节 {n} · {FLOW_TITLES[n]}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {related.length ? related.map((c) => (
                          <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">{c.name}</span>
                        )) : <span className="text-[10px] text-muted">方法论为主</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 pr-4 text-xs text-muted leading-relaxed">
                      {related.map((c) => c.lesson.slice(0, 36) + "…").join("；")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/gmrds/toolkit" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 实操工具箱
        </Link>
        <p className="text-[10px] text-muted">案例为公开真实事件，具体数值以权威披露/史料为准（核验日期 2026-08-25）</p>
      </div>
    </div>
  );
}
