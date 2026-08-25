import Link from "next/link";
import { ArrowLeft, ArrowRight, Flag, Database, Cpu, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui";
import { IMPLEMENTATION } from "@/lib/data/gmrds-deep";
import { ROADMAP } from "@/lib/data/gmrds";

export const metadata = { title: "实施路线图 | 研究体系 GMRDS" };

const PHASE_COLORS = ["#0ea5e9", "#8b5cf6", "#c8102e"];

export default function ImplementationPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">实施路线图</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">可落地实施路线图</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          三阶段递进：P0 数据底座（V1.0）→ P1 量化联动（V2.0）→ P2 平台与 AI（V3.0）。
          每阶段含阶段目标、里程碑、数据治理与质量保障、系统工具与技术选型。
        </p>
      </section>

      {/* 阶段总览 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {IMPLEMENTATION.map((p, i) => (
          <Card key={p.phase} className="p-5 relative overflow-hidden" style={{ borderTop: `3px solid ${PHASE_COLORS[i]}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black px-2 py-0.5 rounded text-white" style={{ background: PHASE_COLORS[i] }}>{p.phase}</span>
              <span className="font-bold text-sm">{p.name.split("（")[1]?.replace("）", "") ?? p.name}</span>
            </div>
            <p className="text-xs text-muted leading-relaxed mt-1">{p.goal}</p>
            <div className="mt-2 text-[11px] text-muted">
              里程碑：{p.milestones.length} 项
            </div>
            {i < 2 && (
              <div className="hidden md:flex absolute top-1/2 -right-3 translate-x-1/2 -translate-y-1/2 z-10 items-center justify-center w-6 h-6 rounded-full bg-card border border-border text-primary">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            )}
          </Card>
        ))}
      </section>

      {/* 阶段详情 */}
      {IMPLEMENTATION.map((p, i) => (
        <section key={p.phase}>
          <h2 className="flex items-center gap-2 font-bold text-base mb-3">
            <span className="text-xs font-black px-2 py-0.5 rounded text-white" style={{ background: PHASE_COLORS[i] }}>{p.phase}</span>
            {p.name}
          </h2>
          <Card className="p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1">
                <p className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary"><Flag className="w-4 h-4" /> 阶段目标</p>
                <p className="text-sm text-muted leading-relaxed">{p.goal}</p>
                <p className="flex items-center gap-1.5 text-sm font-bold mt-4 mb-2 text-primary"><CheckCircle2 className="w-4 h-4" /> 里程碑</p>
                <ul className="space-y-1.5">
                  {p.milestones.map((m) => (
                    <li key={m} className="text-sm text-muted leading-relaxed flex items-start gap-2">
                      <span className="text-primary mt-0.5">▸</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary"><Database className="w-4 h-4" /> 数据治理与质量保障</p>
                <p className="text-sm text-muted leading-relaxed">{p.dataGovernance}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary"><Cpu className="w-4 h-4" /> 系统工具与技术选型</p>
                <p className="text-sm text-muted leading-relaxed">{p.techStack}</p>
              </div>
            </div>
          </Card>
        </section>
      ))}

      {/* 版本对应 */}
      <section>
        <h2 className="font-bold text-base mb-3">阶段 ↔ 版本对应</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pl-4 pr-3 font-medium">阶段</th>
                <th className="text-left px-3 font-medium">版本</th>
                <th className="text-left px-3 pr-4 font-medium">模块边界</th>
              </tr>
            </thead>
            <tbody>
              {IMPLEMENTATION.map((p, i) => (
                <tr key={p.phase} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pl-4 pr-3 font-medium">{p.phase} {p.name}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-primary text-white">{ROADMAP[i].version}</span> {ROADMAP[i].name}
                  </td>
                  <td className="py-2.5 px-3 pr-4 text-muted text-xs">{ROADMAP[i].boundary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 底部 */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/gmrds/data-platform" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 数据互通机制
        </Link>
        <Link href="/gmrds/roadmap" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          查看迭代路线图 →
        </Link>
      </div>
    </div>
  );
}
