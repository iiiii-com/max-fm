import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui";
import { ROADMAP, type DeliverableItem } from "@/lib/data/gmrds";
import VersionTimeline from "@/components/gmrds/VersionTimeline";
import GmrdsShell from "@/components/gmrds/GmrdsShell";

export const metadata = { title: "迭代路线图 | 研究体系 GMRDS" };

/** 交付状态徽标：颜色只表状态，不表涨跌 */
function StatusBadge({ status }: { status: DeliverableItem["status"] }) {
  const map = {
    已交付: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
    部分交付: "border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400",
    待接入: "border-border bg-border/40 text-muted",
  } as const;
  return (
    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}

export default function GmrdsRoadmapPage() {
  return (
    <GmrdsShell>
      <div className="space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">迭代路线图</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">研究体系迭代路线图</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          三个阶段递进演进：<b className="text-foreground">V1.0 基础版</b> 建立研究骨架与数据底座，
          <b className="text-foreground">V2.0 专业版</b> 引入量化验证与跨市场联动，
          <b className="text-foreground">V3.0 研究平台版</b> 以 AI 贯穿全流程实现自适应进化。
          量化统计、跨市场联动与 AI 辅助研究三条能力主线贯穿始终、逐级增强。
        </p>
        <p className="text-xs text-muted leading-relaxed max-w-3xl mt-3 border-l-2 border-primary/50 pl-3">
          下方每项交付都写明<b className="text-foreground">范围、可核对的验收标准、落地的站内模块与上游数据依赖</b>，
          状态按站内当前实现标注——<b className="text-foreground">已交付</b>指能力已可用，
          <b className="text-foreground">部分交付</b>指主体可用但仍有环节依赖未接通，
          <b className="text-foreground">待接入</b>指上游数据尚未到位。状态随迭代更新，不做时间承诺。
        </p>
      </section>

      {/* 三版本总览 */}
      <section>
        <VersionTimeline />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {ROADMAP.map((v, i) => (
          <Card key={v.version} className="p-5 relative overflow-hidden">
            <div className="absolute -right-3 -top-3 text-[56px] font-black opacity-5">{v.version.replace("V", "V")}</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black px-2 py-0.5 rounded bg-primary text-white">{v.version}</span>
              <span className="font-bold">{v.name}</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed mb-3 border-l-2 border-primary/40 pl-2">{v.boundary}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["量化", "跨市场", "AI"].map((f) => (
                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">{f}</span>
              ))}
            </div>
            {i < 2 && (
              <div className="hidden md:flex absolute top-1/2 -right-3 translate-x-1/2 -translate-y-1/2 z-10 items-center justify-center w-6 h-6 rounded-full bg-card border border-border">
                <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
          </Card>
        ))}
        </div>
      </section>

      {/* 能力主线演进 */}
      <section>
        <h2 className="font-bold text-lg tracking-tight mb-1">三大能力主线 · 逐版演进</h2>
        <p className="text-xs text-muted mb-4">量化统计 / 跨市场联动 / AI 辅助研究在各阶段的升级路径</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pl-4 pr-3 font-medium w-36">能力主线</th>
                {ROADMAP.map((v) => (
                  <th key={v.version} className="text-left px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-primary text-white">{v.version}</span>
                      {v.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 align-top">
                <td className="py-3 pl-4 pr-3 font-semibold">量化统计</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed">{ROADMAP[0].quantLevel}</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed bg-primary/4">{ROADMAP[1].quantLevel}</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed">{ROADMAP[2].quantLevel}</td>
              </tr>
              <tr className="border-b border-border/50 align-top">
                <td className="py-3 pl-4 pr-3 font-semibold">跨市场联动</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed">{ROADMAP[0].linkageLevel}</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed bg-primary/4">{ROADMAP[1].linkageLevel}</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed">{ROADMAP[2].linkageLevel}</td>
              </tr>
              <tr className="align-top">
                <td className="py-3 pl-4 pr-3 font-semibold">AI 辅助研究</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed">{ROADMAP[0].aiLevel}</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed bg-primary/4">{ROADMAP[1].aiLevel}</td>
                <td className="py-3 px-3 text-muted text-xs leading-relaxed">{ROADMAP[2].aiLevel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 版本交付明细 */}
      {ROADMAP.map((v) => {
        const done = v.deliverables.filter((d) => d.status === "已交付").length;
        const part = v.deliverables.filter((d) => d.status === "部分交付").length;
        const todo = v.deliverables.filter((d) => d.status === "待接入").length;
        return (
          <section key={v.version}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-bold text-base">
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-primary text-white">{v.version}</span>
                  {v.name} · 交付内容
                </span>
              </h2>
              {/* 真实进度：按站内当前实现统计，不做预期承诺 */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded border border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 font-semibold">
                  已交付 {done}
                </span>
                <span className="px-1.5 py-0.5 rounded border border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400 font-semibold">
                  部分 {part}
                </span>
                <span className="px-1.5 py-0.5 rounded border border-border text-muted font-semibold">
                  待接入 {todo}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {v.deliverables.map((d) => (
                <Card key={d.name} className="p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm leading-snug">{d.name}</h3>
                    <StatusBadge status={d.status} />
                  </div>

                  <p className="text-xs text-muted leading-relaxed mb-2.5">{d.scope}</p>

                  <div className="rounded-lg bg-border/30 border border-border/60 px-2.5 py-2 mb-2.5">
                    <p className="text-[10px] font-bold tracking-wider text-primary mb-1">验收标准</p>
                    <p className="text-[11px] leading-relaxed text-foreground/85">{d.acceptance}</p>
                  </div>

                  <div className="mt-auto space-y-1.5 pt-1">
                    <div className="flex items-start gap-1.5 text-[10px]">
                      <span className="shrink-0 text-muted font-semibold w-14">落地模块</span>
                      <span className="flex flex-wrap gap-1">
                        {d.modules.map((m) => (
                          <Link
                            key={m}
                            href={m}
                            className="px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
                          >
                            {m}
                          </Link>
                        ))}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[10px]">
                      <span className="shrink-0 text-muted font-semibold w-14">数据依赖</span>
                      <span className="text-muted leading-relaxed">{d.deps}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {/* 底部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Link href="/gmrds" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回研究体系总览
        </Link>
        <p className="text-[10px] text-muted">路线图随研究体系持续演进更新 · 每版交付以真实数据与可验证方法为前提</p>
      </div>
    </div>
    </GmrdsShell>
  );
}
