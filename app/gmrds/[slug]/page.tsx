import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Globe, Landmark, Droplets, Waves, Network, Building2, Scale, CandlestickChart,
  Calculator, PieChart, Shield, Sparkles, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Database, Target, FlaskConical,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ACADEMIES, DECISION_FLOW, FLOW_STAGES, academyBySlug } from "@/lib/data/gmrds";

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

export function generateStaticParams() {
  return ACADEMIES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = academyBySlug(slug);
  return { title: a ? `${a.name} | 研究体系` : "学院 | 研究体系" };
}

export default async function AcademyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = academyBySlug(slug);
  if (!a) notFound();
  const Icon = ICONS[a.icon] ?? Globe;
  const stage = FLOW_STAGES[a.stage - 1];
  const idx = ACADEMIES.findIndex((x) => x.slug === a.slug);
  const prev = idx > 0 ? ACADEMIES[idx - 1] : null;
  const next = idx < ACADEMIES.length - 1 ? ACADEMIES[idx + 1] : null;
  const flowSteps = DECISION_FLOW.filter((f) => f.sourceAcademies.includes(a.slug));

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      {/* 面包屑式导航 */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{a.name}</span>
      </div>

      {/* 学院头部 */}
      <section className="rounded-xl border border-border p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${a.tone}14, transparent 60%)` }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center justify-center w-12 h-12 rounded-xl text-white" style={{ background: a.tone }}>
            <Icon className="w-6 h-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-muted uppercase">{a.no} · {a.en}</p>
            <h1 className="font-black text-xl sm:text-2xl tracking-tight">{a.name}</h1>
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Badge tone="blue">阶段 {a.stage} · {stage.label}</Badge>
            <Badge tone="gray">{a.upstream.length} 上游 · {a.downstream.length} 下游</Badge>
          </div>
        </div>
        <p className="text-sm leading-relaxed mt-4 max-w-3xl"><span className="font-semibold">职责：</span>{a.role}</p>
        {flowSteps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {flowSteps.map((s) => (
              <span key={s.no} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted bg-card">
                决策环节 {s.no} · {s.title}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 核心研究问题 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-base mb-3">
          <Target className="w-4 h-4 text-primary" /> 核心研究问题
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {a.questions.map((q, i) => (
            <Card key={i} className="flex items-start gap-2.5 p-3.5 text-sm">
              <span className="flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-bold text-white shrink-0 mt-0.5" style={{ background: a.tone }}>
                {i + 1}
              </span>
              <span className="leading-relaxed">{q}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* 指标体系 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-base mb-3">
          <Database className="w-4 h-4 text-primary" /> 指标体系
          <span className="text-[10px] font-normal text-muted">数据来源可溯源 · 与站点现有数据同源</span>
        </h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pl-4 pr-3 font-medium">关键指标</th>
                <th className="text-left px-3 font-medium">说明</th>
                <th className="text-left px-3 pr-4 font-medium">数据来源</th>
              </tr>
            </thead>
            <tbody>
              {a.indicators.map((ind) => (
                <tr key={ind.name} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pl-4 pr-3 font-medium whitespace-nowrap">{ind.name}</td>
                  <td className="py-2 px-3 text-muted leading-relaxed">{ind.desc}</td>
                  <td className="py-2 px-3 pr-4 text-[11px] text-muted whitespace-nowrap">{ind.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* 研究方法 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-base mb-3">
          <FlaskConical className="w-4 h-4 text-primary" /> 研究方法
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {a.methods.map((m, i) => (
            <Card key={i} className="p-3.5">
              <p className="text-sm font-semibold mb-1">
                <span className="text-[11px] font-bold text-white rounded px-1.5 py-0.5 mr-1.5" style={{ background: a.tone }}>{i + 1}</span>
                {m.title}
              </p>
              <p className="text-xs text-muted leading-relaxed">{m.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 关联逻辑 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-base mb-3">
          <ArrowUp className="w-4 h-4 text-primary" /> 学院关联 · 研究传导
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-[11px] font-semibold text-muted mb-2 flex items-center gap-1"><ArrowUp className="w-3.5 h-3.5 text-sky-500" /> 上游输入（本学院依赖）</p>
            {a.upstream.length === 0 ? (
              <p className="text-xs text-muted">研究体系的起点，直接对接全球与宏观数据底座</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {a.upstream.map((slug) => {
                  const u = academyBySlug(slug);
                  if (!u) return null;
                  const UIcon = ICONS[u.icon] ?? Globe;
                  return (
                    <Link key={slug} href={`/gmrds/${slug}`} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/40 transition-colors">
                      <UIcon className="w-3.5 h-3.5" style={{ color: u.tone }} /> {u.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
          <Card className="p-4 border-primary/30" style={{ borderColor: `${a.tone}55` }}>
            <p className="text-[11px] font-semibold mb-2 flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: a.tone }} /> 决策输出物
            </p>
            <div className="flex flex-wrap gap-1.5">
              {a.outputs.map((o) => (
                <span key={o} className="text-[11px] px-2 py-0.5 rounded border border-border bg-background/60">{o}</span>
              ))}
            </div>
            <p className="text-[11px] font-semibold mt-3 mb-1 flex items-center gap-1 text-muted">连通逻辑</p>
            <p className="text-[11px] text-muted leading-relaxed">{a.connectivity}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] font-semibold text-muted mb-2 flex items-center gap-1"><ArrowDown className="w-3.5 h-3.5 text-green-500" /> 下游承接（消费本学院）</p>
            {a.downstream.length === 0 ? (
              <p className="text-xs text-muted">研究体系的末端：结论沉淀为交易纪律与知识库</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {a.downstream.map((slug) => {
                  const d = academyBySlug(slug);
                  if (!d) return null;
                  const DIcon = ICONS[d.icon] ?? Globe;
                  return (
                    <Link key={slug} href={`/gmrds/${slug}`} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/40 transition-colors">
                      <DIcon className="w-3.5 h-3.5" style={{ color: d.tone }} /> {d.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* 站点功能关联 + 版本演进 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">本站已落地的研究工具</h3>
          <div className="space-y-2">
            {a.siteModules.map((m) => (
              <Link key={m.href + m.label} href={m.href} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm hover:border-primary/40 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.tone }} />
                <span className="font-medium">{m.label}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted" />
              </Link>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3">能力演进路线</h3>
          <div className="space-y-2.5">
            {[
              { v: "V1.0 基础版", text: a.roadmap.v1, tone: "#94a3b8" },
              { v: "V2.0 专业版", text: a.roadmap.v2, tone: "#3b82f6" },
              { v: "V3.0 研究平台版", text: a.roadmap.v3, tone: "#a855f7" },
            ].map((r) => (
              <div key={r.v} className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0 mt-0.5" style={{ background: r.tone }}>{r.v}</span>
                <p className="text-xs text-muted leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 上/下一学院 */}
      <nav className="flex items-center justify-between gap-3">
        {prev ? (
          <Link href={`/gmrds/${prev.slug}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
            <ArrowLeft className="w-3.5 h-3.5" /> {prev.no} {prev.name}
          </Link>
        ) : <span />}
        <Link href="/gmrds" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          返回研究体系总览
        </Link>
        {next ? (
          <Link href={`/gmrds/${next.slug}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
            {next.no} {next.name} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
