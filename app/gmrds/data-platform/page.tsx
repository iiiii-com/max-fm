import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowDown, Database, Layers, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui";
import { DATA_LAYERS, DATA_STANDARDS } from "@/lib/data/gmrds-deep";
import DataLayersDiagram from "@/components/gmrds/DataLayersDiagram";

export const metadata = { title: "数据互通机制 | 研究体系 GMRDS" };

const LAYER_COLORS: Record<string, string> = { L1: "#0ea5e9", L2: "#10b981", L3: "#ec4899" };

export default function DataPlatformPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">数据互通机制</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">跨板块数据互通 · 统一数据口径与字段标准</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          宏观 / 行业 / 标的三层数据通过统一字段标准与映射规则互联：
          任一板块数据更新自动联动下游决策节点，实现「一次录入、多学院复用、全链路联动」。
        </p>
      </section>

      {/* 三层架构 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <Layers className="w-4.5 h-4.5 text-primary" /> 三层数据架构与映射
        </h2>
        <DataLayersDiagram />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
          {DATA_LAYERS.map((l, i) => (
            <Card key={l.layer} className="p-4" style={{ borderTop: `3px solid ${LAYER_COLORS[l.layer]}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: LAYER_COLORS[l.layer] }}>{l.layer}</span>
                <h3 className="font-bold text-sm">{l.name}</h3>
              </div>
              <p className="text-[11px] font-semibold text-muted mb-1">数据字段</p>
              <div className="flex flex-wrap gap-1 mb-2.5">
                {l.fields.map((f) => (
                  <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30">{f}</span>
                ))}
              </div>
              <p className="text-[11px] font-semibold text-muted mb-1">统一字段标准</p>
              <p className="text-[11px] text-muted leading-relaxed mb-2.5">{l.standard}</p>
              <p className="text-[11px] font-semibold text-muted mb-1">映射联动</p>
              <ul className="space-y-1">
                {l.mapTo.map((m) => (
                  <li key={m.layer + m.how} className="text-[11px] text-muted leading-relaxed flex items-start gap-1.5">
                    <ArrowDown className="w-3 h-3 mt-0.5 shrink-0" style={{ color: LAYER_COLORS[m.layer] }} />
                    <span><b style={{ color: LAYER_COLORS[m.layer] }}>{m.layer}</b> {m.how}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        {/* 联动示意 */}
        <Card className="p-4 mt-3">
          <p className="text-xs text-muted leading-relaxed">
            <RefreshCw className="w-3.5 h-3.5 inline text-primary mr-1" />
            <b>联动示意</b>：宏观利率更新（L1）→ 自动重算估值折现率（L3 标的估值锚）→ 联动行业景气基准（L2）→
            标的池优先级重排（L3）→ 决策委员会评分卡刷新（C01）。任一节点数据更新，下游决策节点级联刷新。
          </p>
        </Card>
      </section>

      {/* 字段标准 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <Database className="w-4.5 h-4.5 text-primary" /> 统一数据口径与质量保障
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {DATA_STANDARDS.map((s, i) => (
            <Card key={i} className="p-3.5 flex items-start gap-2.5 text-sm leading-relaxed">
              <span className="flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-bold text-white shrink-0 mt-0.5 bg-primary">{i + 1}</span>
              <span className="text-muted">{s}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* 底部 */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/gmrds/case" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 传导案例
        </Link>
        <Link href="/gmrds/implementation" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          实施路线图 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
