import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Database, FlaskConical, ListChecks, Table2, Wrench } from "lucide-react";
import { Card } from "@/components/ui";
import { FLOW_PRACTICES } from "@/lib/data/gmrds-deep";
import { FLOW_PRAXIS, caseById } from "@/lib/data/gmrds-practical";
import { DECISION_FLOW, academyBySlug } from "@/lib/data/gmrds";

export const metadata = { title: "十一环节详解 | 研究体系 GMRDS" };

const STAGE_COLORS = ["#0ea5e9", "#10b981", "#ec4899", "#eab308"];

export default function FlowPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">十一环节详解</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">十一环节 · 方法论 + 真实数据实操</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          每个决策环节给出「方法论步骤」与「真实数据实操」双层呈现：数据来源、指标口径、采集频率与更新机制一一标注，
          全部建立在可溯源、可验证的真实数据之上。
        </p>
        {/* 环节导航 */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {FLOW_PRACTICES.map((f) => (
            <a key={f.no} href={`#step-${f.no}`} className="text-[11px] px-2 py-1 rounded border border-border text-muted hover:border-primary/50 hover:text-primary transition-colors">
              {f.no} {f.title}
            </a>
          ))}
        </div>
      </section>

      {/* 环节详解 */}
      {FLOW_PRACTICES.map((f) => {
        const flow = DECISION_FLOW.find((d) => d.no === f.no)!;
        const praxis = FLOW_PRAXIS[f.no];
        const cases = praxis.caseRefs.map(caseById).filter(Boolean);
        return (
          <section key={f.no} id={`step-${f.no}`} className="scroll-mt-20">
            <Card className="p-5 overflow-hidden">
              {/* 环节头 */}
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg text-white font-bold shrink-0" style={{ background: STAGE_COLORS[f.no - 1] }}>
                  {f.no}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-lg leading-tight">{f.title}</h2>
                  <p className="text-[11px] text-muted mt-0.5">
                    输入：{flow.input} → 输出：{flow.output}
                    <span className="ml-2">
                      {flow.sourceAcademies.map((s) => {
                        const a = academyBySlug(s);
                        return a ? (
                          <Link key={s} href={`/gmrds/${s}`} className="text-primary hover:underline">{a.name}</Link>
                        ) : null;
                      })}
                    </span>
                  </p>
                </div>
              </div>

              {/* 实操：操作步骤 + 判断标准 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                    <ListChecks className="w-4 h-4" /> 操作步骤（可落地）
                  </h3>
                  <ol className="space-y-1.5">
                    {praxis.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                        <span className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ background: STAGE_COLORS[f.no - 1] }}>{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                    <FlaskConical className="w-4 h-4" /> 判断标准（阈值 / 规则）
                  </h3>
                  <ul className="space-y-1.5">
                    {praxis.criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                        <span className="text-primary mt-0.5">▸</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold mt-4 mb-2 text-primary">
                    <Wrench className="w-4 h-4" /> 执行工具
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {praxis.tools.map((t) => (
                      <span key={t.name} className="text-[11px] px-2 py-1 rounded border border-border bg-background/60" title={t.usage}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 方法论 + 数据来源 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 方法论 */}
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                    <FlaskConical className="w-4 h-4" /> 方法论
                  </h3>
                  <ol className="space-y-1.5">
                    {f.methodology.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                        <span className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ background: STAGE_COLORS[f.no - 1] }}>{i + 1}</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 数据来源 */}
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                    <Database className="w-4 h-4" /> 数据来源 · 口径 · 频率
                  </h3>
                  <div className="space-y-2">
                    {f.dataSources.map((d) => (
                      <div key={d.name} className="rounded-lg border border-border px-3 py-2">
                        <p className="text-[13px] font-semibold">{d.name}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          来源：{d.source} · 频率：{d.freq} · 更新：{d.update}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 真实数据实操 */}
              <div className="mt-4">
                <h3 className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                  <Table2 className="w-4 h-4" /> 真实数据实操 · {f.demo.title}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-xs text-muted border-b border-border bg-muted/20">
                        {f.demo.headers.map((h) => (
                          <th key={h} className="text-left py-2 pl-3 pr-3 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {f.demo.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className={`py-1.5 px-3 ${j === 0 ? "font-medium" : "text-muted"}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
                  数据源：{f.demo.source} · {f.demo.note}
                </p>
              </div>

              {/* 案例引用 */}
              {cases.length > 0 && (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/4 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-primary mb-2">
                    <BookOpenCheck className="w-3.5 h-3.5" /> 真实案例佐证
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cases.map((c) => c && (
                      <Link key={c.id} href="/gmrds/cases" className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-card hover:border-primary/40 transition-colors">
                        <b>{c.name}</b>
                        <span className="text-muted">· {c.lesson.slice(0, 30)}…</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </section>
        );
      })}

      {/* 底部 */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/gmrds/governance" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 治理架构
        </Link>
        <Link href="/gmrds/case" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <BookOpenCheck className="w-3.5 h-3.5" /> 查看真实数据传导案例 →
        </Link>
      </div>
    </div>
  );
}
