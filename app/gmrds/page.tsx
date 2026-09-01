import Link from "next/link";
import {
  Globe, Landmark, Droplets, Waves, Network, Building2, Scale, CandlestickChart,
  Calculator, PieChart, Shield, Sparkles, ArrowRight, GitBranch, Rocket, Workflow,
  Database, FlaskConical, Users, Layers,
} from "lucide-react";
import { Card } from "@/components/ui";
import { ACADEMIES, DECISION_FLOW, FLOW_STAGES, ROADMAP, INTEGRATION_PILLARS, academyBySlug } from "@/lib/data/gmrds";
import FlowCycle from "@/components/gmrds/FlowCycle";

const DEEP_ENTRIES = [
  { href: "/gmrds/governance", icon: Users, title: "治理架构", desc: "十二学院 + 决策委员会 · 职责分工 / 组织边界 / 协作机制" },
  { href: "/gmrds/flow", icon: FlaskConical, title: "环节详解", desc: "十一环节 · 方法论 + 真实数据实操（来源 / 口径 / 频率）" },
  { href: "/gmrds/case", icon: GitBranch, title: "传导案例", desc: "宏观 → 行业 → 标的 → 决策 · 近 5 年真实数据演示" },
  { href: "/gmrds/data-platform", icon: Database, title: "数据互通", desc: "宏观 / 行业 / 标的三层数据映射与字段标准" },
  { href: "/gmrds/implementation", icon: Rocket, title: "实施路线图", desc: "P0/P1/P2 · 里程碑 · 数据治理 · 技术选型" },
  { href: "/gmrds/roadmap", icon: Workflow, title: "迭代版本", desc: "V1.0 基础版 → V2.0 专业版 → V3.0 研究平台版" },
];

const ICONS: Record<string, typeof Globe> = {
  globe: Globe,
  landmark: Landmark,
  droplets: Droplets,
  waves: Waves,
  network: Network,
  building: Building2,
  scale: Scale,
  candlestick: CandlestickChart,
  calculator: Calculator,
  "pie-chart": PieChart,
  shield: Shield,
  sparkles: Sparkles,
};

export const metadata = { title: "研究体系 GMRDS" };

export default function GmrdsPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* Hero */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-widest text-primary uppercase mb-2">Global Markets Research & Decision System</p>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">
          全球资本市场研究与投资决策体系
          <span className="ml-2 align-middle text-xs font-bold text-primary border border-primary/40 rounded px-1.5 py-0.5">GMRDS</span>
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          以十二大学院 + 决策委员会覆盖「宏观 → 资产与行业 → 标的研究 → 执行与优化」四大阶段，
          以十一环节决策闭环串联从宏观研判到复盘优化的完整链条。
          每一环节建立在可溯源的真实数据之上，层层递进、互相支撑，构成可长期承载与持续演进的投资研究体系。
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="#flow" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium">
            <Workflow className="w-3.5 h-3.5" /> 决策流程链
          </Link>
          <Link href="#academies" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:border-primary/50">
            <GitBranch className="w-3.5 h-3.5" /> 十二大学院
          </Link>
          <Link href="/gmrds/roadmap" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:border-primary/50">
            <Rocket className="w-3.5 h-3.5" /> 迭代路线图
          </Link>
        </div>
      </section>

      {/* 深化模块入口 */}
      <section>
        <SectionTitle title="深化模块" desc="治理架构 · 环节实操 · 数据互通 · 实施路线图" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {DEEP_ENTRIES.map((e) => {
            const Icon = e.icon;
            return (
              <Link key={e.href} href={e.href} className="group">
                <Card className="flex items-start gap-3 p-3.5 h-full transition-all group-hover:border-primary/40">
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{e.title}</p>
                    <p className="text-[11px] text-muted leading-relaxed mt-0.5">{e.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted shrink-0 group-hover:text-primary" />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 四大阶段总览 */}
      <section>
        <SectionTitle id="stages" title="四大研究阶段" desc="从环境到决策的传导路径" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FLOW_STAGES.map((s) => (
            <Card key={s.no} className="p-4 border-l-4" style={{ borderLeftColor: ["#0ea5e9", "#10b981", "#ec4899", "#eab308"][s.no - 1] }}>
              <p className="text-[10px] text-muted font-semibold tracking-wider">STAGE {s.no}</p>
              <h3 className="font-bold text-sm mt-0.5">{s.label}</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 11 环节决策闭环 */}
      <section id="flow">
        <SectionTitle title="统一决策流程 · 十一环节闭环" desc="宏观 → 决策 → 复盘，逐级传递评分，每步明确输入 / 分析 / 输出" />
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          <FlowCycle />
          <Card className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {DECISION_FLOW.map((step) => {
              const stageColor = ["#0ea5e9", "#10b981", "#ec4899", "#eab308"][step.stage - 1];
              return (
                <div key={step.no} className="relative rounded-lg border border-border p-3 bg-background/60 hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold text-black shrink-0"
                      style={{ background: stageColor }}
                    >
                      {step.no}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-tight">{step.title}</p>
                      <p className="text-[11px] text-muted mt-1 leading-relaxed">
                        <span className="inline-block text-[10px] font-semibold text-sky-600">输入</span> {step.input}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                        <span className="inline-block text-[10px] font-semibold text-amber-600">分析</span> {step.analysis}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                        <span className="inline-block text-[10px] font-semibold text-green-600">输出</span> {step.output}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {step.sourceAcademies.map((slug) => {
                          const a = academyBySlug(slug);
                          if (!a) return null;
                          return (
                            <Link
                              key={slug}
                              href={`/gmrds/${slug}`}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted hover:border-primary/50 hover:text-primary transition-colors"
                            >
                              {a.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted mt-3">
            闭环链路：宏观 → 流动性 → 周期 → 行业 → 盈利 → 估值 → 技术 → 情绪 → 风险 → 仓位 → 复盘，形成可追溯、可复盘的完整决策闭环。
          </p>
          </Card>
        </div>
      </section>

      {/* 十二大学院 */}
      <section id="academies">
        <SectionTitle title="十二大学院 + 决策委员会" desc="每所学院独立成模块：职责 · 核心问题 · 数据字段 · 方法 · 输出物 · 连通" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {ACADEMIES.filter((a) => a.slug !== "committee").map((a) => {
            const Icon = ICONS[a.icon] ?? Globe;
            const stageLabel = FLOW_STAGES[a.stage - 1].label;
            return (
              <Link key={a.slug} href={`/gmrds/${a.slug}`} className="group">
                <Card className="h-full p-4 transition-all group-hover:border-primary/40 group-hover:shadow-sm">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg text-white shrink-0" style={{ background: a.tone }}>
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-wider text-muted">{a.no} · {a.en}</p>
                      <h3 className="font-bold text-sm leading-tight">{a.name}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-muted leading-relaxed line-clamp-3 min-h-[3.6em]">{a.role}</p>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary font-medium">{stageLabel}</span>
                    <span className="text-[10px] text-muted inline-flex items-center gap-0.5 group-hover:text-primary">
                      进入学院 <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
          {/* 决策委员会（统筹） */}
          {(() => {
            const c = academyBySlug("committee")!;
            const CIcon = ICONS[c.icon] ?? Globe;
            return (
              <Link key={c.slug} href={`/gmrds/${c.slug}`} className="group">
                <Card className="h-full p-4 border-dashed transition-all group-hover:border-primary/60 group-hover:shadow-sm" style={{ borderColor: `${c.tone}66` }}>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg text-white shrink-0" style={{ background: c.tone }}>
                      <CIcon className="w-4.5 h-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-wider text-muted">C01 · 统筹机构</p>
                      <h3 className="font-bold text-sm leading-tight">{c.name}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-muted leading-relaxed line-clamp-3 min-h-[3.6em]">{c.role}</p>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/60">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary font-medium">统筹决策 · 复盘</span>
                    <span className="text-[10px] text-muted inline-flex items-center gap-0.5 group-hover:text-primary">
                      进入委员会 <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })()}
        </div>
      </section>

      {/* 关联传导路径 */}
      <section>
        <SectionTitle title="学院关联 · 从宏观到决策" desc="上游产出输入，下游承接输出，层层递进" />
        <Card className="p-4 sm:p-5 overflow-x-auto">
          <div className="flex items-stretch gap-2 min-w-[760px]">
            {FLOW_STAGES.map((s) => {
              const stageAcademies = ACADEMIES.filter((a) => a.stage === s.no);
              const color = ["#0ea5e9", "#10b981", "#ec4899", "#eab308"][s.no - 1];
              return (
                <div key={s.no} className="flex-1">
                  <div className="rounded-lg border p-3 h-full" style={{ borderColor: `${color}55`, background: `${color}0d` }}>
                    <p className="text-[10px] font-bold tracking-wider" style={{ color }}>阶段 {s.no} · {s.label}</p>
                    <div className="mt-2 space-y-1.5">
                      {stageAcademies.map((a) => (
                        <Link
                          key={a.slug}
                          href={`/gmrds/${a.slug}`}
                          className="block rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium hover:border-primary/40 transition-colors"
                        >
                          {a.no} {a.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                  {s.no < FLOW_STAGES.length && (
                    <div className="flex items-center justify-center py-1.5 text-muted/60">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted mt-3">
            箭头方向表示研究流的传导：宏观与全球 → 资产与行业 → 标的研究 → 执行与优化；量化与 AI 中心作为横向支撑贯穿全程。
          </p>
        </Card>
      </section>

      {/* 跨版本整合核心 */}
      <section>
        <SectionTitle title="跨版本整合 · 五大核心" desc="统一数据底座 · 共享工具箱 · 决策闭环 · AI 中台 · 版本平滑升级" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {INTEGRATION_PILLARS.map((p, i) => (
            <Card key={p.title} className="p-3.5">
              <p className="text-[11px] font-black text-white rounded px-1.5 py-0.5 inline-block mb-1.5" style={{ background: ["#0ea5e9", "#10b981", "#ec4899", "#a855f7", "#f59e0b"][i] }}>
                {i + 1}
              </p>
              <p className="text-[13px] font-bold leading-tight">{p.title}</p>
              <p className="text-[11px] text-muted leading-relaxed mt-1">{p.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 路线图入口 */}
      <section>
        <SectionTitle title="迭代路线图" desc="V1.0 基础版 → V2.0 专业版 → V3.0 研究平台版" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ROADMAP.map((v) => (
            <Card key={v.version} className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-black px-2 py-0.5 rounded bg-primary text-white">{v.version}</span>
                <span className="font-bold text-sm">{v.name}</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed border-l-2 border-primary/40 pl-2">{v.boundary}</p>
            </Card>
          ))}
        </div>
        <Link href="/gmrds/roadmap" className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-primary hover:underline">
          查看完整路线图与能力演进 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    </div>
  );
}

function SectionTitle({ id, title, desc }: { id?: string; title: string; desc?: string }) {
  return (
    <div id={id} className="mb-3">
      <h2 className="font-bold text-lg tracking-tight">{title}</h2>
      {desc && <p className="text-xs text-muted mt-0.5">{desc}</p>}
    </div>
  );
}
