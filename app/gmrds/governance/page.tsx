import Link from "next/link";
import { ArrowRight, GitBranch, ShieldCheck, Handshake, Landmark } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { GOVERNANCE } from "@/lib/data/gmrds-deep";
import { DECISION_FLOW, FLOW_STAGES } from "@/lib/data/gmrds";
import GovernanceTree from "@/components/gmrds/GovernanceTree";

export const metadata = { title: "治理架构 | 研究体系 GMRDS" };

const STAGE_COLORS = ["#0ea5e9", "#10b981", "#ec4899", "#eab308"];

export default function GovernancePage() {
  const academies = GOVERNANCE.filter((g) => g.kind === "academy");
  const committee = GOVERNANCE.find((g) => g.kind === "committee")!;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">治理架构</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">「十二大学院 + 决策委员会」双层级治理架构</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          第一层级：十二大学院按四大阶段分工研究，各自负责数据采集、分析与输出，互相以数据为纽带协作；
          第二层级：决策委员会作为唯一统筹机构，汇集全部学院信号、交叉验证并输出最终决策。
          学院无最终裁量权，委员会不参与数据细节——职责分离、边界清晰、协作有据。
        </p>
      </section>

      {/* 架构图 */}
      <section>
        <h2 className="font-bold text-lg tracking-tight mb-3">治理架构总览</h2>
        <GovernanceTree />
      </section>

      {/* 阶段 → 学院 → 环节映射 */}
      <section>
        <h2 className="font-bold text-lg tracking-tight mb-3">阶段 · 学院 · 环节 映射</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {FLOW_STAGES.map((s) => {
            const units = academies.filter((g) => g.stage === s.no);
            const flows = DECISION_FLOW.filter((f) => f.stage === s.no);
            return (
              <Card key={s.no} className="p-4 border-l-4" style={{ borderLeftColor: STAGE_COLORS[s.no - 1] }}>
                <p className="text-[10px] font-bold tracking-wider" style={{ color: STAGE_COLORS[s.no - 1] }}>阶段 {s.no} · {s.label}</p>
                <div className="mt-2 space-y-1">
                  {units.map((u) => (
                    <div key={u.no} className="text-xs font-medium">{u.no} {u.name}</div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-border/60 flex flex-wrap gap-1">
                  {flows.map((f) => (
                    <span key={f.no} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">环节 {f.no}</span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 十二大学院职责 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <GitBranch className="w-4.5 h-4.5 text-primary" /> 十二大学院 · 职责分工与组织边界
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {academies.map((a) => (
            <Card key={a.no} className="p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Badge tone="blue">{a.no}</Badge>
                <h3 className="font-bold text-sm">{a.name}</h3>
                <span className="ml-auto text-[10px] text-muted">阶段 {a.stage} · 环节 {a.flowNos.join("/")}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-semibold text-primary mb-1">职责分工</p>
                  <ul className="space-y-0.5 text-muted">
                    {a.responsibility.map((r) => <li key={r}>· {r}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-muted mb-1 inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> 组织边界</p>
                  <p className="text-muted leading-relaxed">{a.boundary}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 决策委员会 */}
      <section className="rounded-xl border p-6" style={{ borderColor: `${committee ? "#c8102e" : ""}55`, background: "#c8102e08" }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white">
            <Landmark className="w-4.5 h-4.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-muted uppercase">{committee.no} · 统筹机构</p>
            <h2 className="font-bold text-lg">{committee.name}</h2>
          </div>
          <span className="ml-auto text-[10px] text-muted">环节 {committee.flowNos.join("/")}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="font-semibold text-primary mb-1">职责分工</p>
            <ul className="space-y-0.5 text-muted">
              {committee.responsibility.map((r) => <li key={r}>· {r}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-muted mb-1 inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> 组织边界</p>
            <p className="text-muted leading-relaxed">{committee.boundary}</p>
          </div>
          <div>
            <p className="font-semibold text-muted mb-1 inline-flex items-center gap-1"><Handshake className="w-3 h-3" /> 协作机制</p>
            <ul className="space-y-0.5 text-muted">
              {committee.collaboration.map((c) => <li key={c}>· {c}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* 协作机制总表 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <Handshake className="w-4.5 h-4.5 text-primary" /> 协作机制一览
        </h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pl-4 pr-3 font-medium w-24">单位</th>
                <th className="text-left px-3 font-medium">协作机制（数据纽带 / 输出输入）</th>
                <th className="text-left px-3 pr-4 font-medium">对应决策环节</th>
              </tr>
            </thead>
            <tbody>
              {GOVERNANCE.map((g) => (
                <tr key={g.no} className="border-b border-border/50 last:border-0 align-top">
                  <td className="py-2.5 pl-4 pr-3 font-medium whitespace-nowrap">{g.no} {g.name}</td>
                  <td className="py-2.5 px-3 text-muted leading-relaxed">
                    <ul className="space-y-0.5">
                      {g.collaboration.map((c) => <li key={c}>· {c}</li>)}
                    </ul>
                  </td>
                  <td className="py-2.5 px-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {g.flowNos.map((n) => (
                        <Link key={n} href={`/gmrds/flow#step-${n}`} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15">
                          环节 {n}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link href="/gmrds/flow" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            查看十一环节详解（方法论 + 真实数据实操） <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/gmrds" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
            返回体系总览
          </Link>
        </div>
      </section>
    </div>
  );
}
