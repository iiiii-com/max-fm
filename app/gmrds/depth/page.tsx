import Link from "next/link";
import { ArrowLeft, Target, GitBranch, Wrench, BookOpen, Eye, Database, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { DEPTH_STEPS, DEPTH_VIZ_TYPES } from "@/lib/data/gmrds-depth";
import DecisionGantt from "@/components/gmrds/DecisionGantt";
import MacroHeatmap from "@/components/gmrds/MacroHeatmap";
import RotationMatrix from "@/components/gmrds/RotationMatrix";
import AttributionChart from "@/components/gmrds/AttributionChart";
import RadarChart from "@/components/gmrds/RadarChart";

export const metadata = { title: "环节深度研究 | 研究体系 GMRDS" };

const STAGE_COLORS = ["#3b82f6", "#16a34a", "#e11d48", "#f59e0b"];
const STAGE_BG: Record<string, string> = {
  "宏观研判": "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "资产与行业": "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "标的研究": "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "执行与优化": "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

/** 按 viz.type 渲染对应可视化（供环节卡使用） */
function VizByType({ type, label }: { type: string; label: string }) {
  if (type === "macro-heatmap") return <MacroHeatmap />;
  if (type === "rotation-matrix") return <RotationMatrix />;
  if (type === "attribution") return <AttributionChart year={2024} />;
  if (type === "score-radar") {
    // 环节 5 财务质量雷达（真实/教学标注）
    if (label.includes("财务")) {
      return (
        <RadarChart
          dims={[
            { name: "盈利能力", max: 10 }, { name: "成长性", max: 10 }, { name: "现金流质量", max: 10 },
            { name: "财务稳健", max: 10 }, { name: "盈利真实性", max: 10 },
          ]}
          series={[
            { name: "贵州茅台（真实指标映射）", values: [9, 6, 9, 8, 9], color: "#16a34a" },
            { name: "宁德时代（真实指标映射）", values: [7, 9, 6, 7, 8], color: "#3b82f6" },
          ]}
          title="标的财务质量雷达 · 茅台 vs 宁德（真实指标映射）"
          caption="图注：数值由真实财务指标（ROE/毛利率/现金流/负债率）归一化映射，茅台 ROE 16.75%/毛利率 89.56%、宁德 ROE 12.1%/毛利率 23.9%（东财 F10 2026 中报）。"
        />
      );
    }
    // 环节 10 九环节评分雷达（真实自算）
    return (
      <RadarChart
        dims={[
          { name: "宏观", max: 5 }, { name: "流动性", max: 5 }, { name: "周期", max: 5 },
          { name: "行业", max: 5 }, { name: "盈利", max: 5 }, { name: "估值", max: 5 },
          { name: "技术", max: 5 }, { name: "情绪", max: 5 }, { name: "风险", max: 5 },
        ]}
        series={[
          { name: "2024-09 共振（进攻）", values: [4, 4, 4, 3, 3, 4, 3, 2, 2], color: "#d7000b" },
          { name: "2022 紧缩（防守）", values: [1, 2, 1, 2, 3, 2, 1, 3, 4], color: "#0aa06e" },
        ]}
        title="九环节评分雷达 · 进攻 vs 防守情景（真实数据映射）"
        caption="图注：环节 1-9 评分（-5~5）按宏观/流动性与风险敞口映射；进攻情景对应 2024-09 反转（上证 2702.19→3968.84），防守情景对应 2022 紧缩（-15.1%）。"
      />
    );
  }
  return null;
}

export default function DepthPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">环节深度研究</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">十一环节深度研究 · 目标 · 工具 · 案例 · 可视化</h1>
        <p className="text-sm text-muted leading-relaxed max-w-4xl">
          每一环节的<b className="text-foreground">核心目标、输入输出、方法工具</b>，配<b className="text-foreground">真实案例解剖</b>（数据 → 决策应用路径）
          与<b className="text-foreground">可视化方案</b>（图表承载的信息与决策价值）。全部数据可溯源（腾讯/东财/新浪真实行情与财报）；案例为方法论演示，不构成投资建议。
        </p>
        {/* 锚点导航 */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {DEPTH_STEPS.map((s) => (
            <a key={s.no} href={`#step-${s.no}`} className="px-2.5 py-1 rounded-md border border-border text-[11px] hover:border-primary/50 hover:text-primary transition-colors">
              {s.no} {s.title}
            </a>
          ))}
        </div>
      </section>

      {/* 总览：决策流程甘特图 */}
      <section>
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <GitBranch className="w-4.5 h-4.5 text-primary" /> 决策闭环总览 · 十一环节甘特图
        </h2>
        <Card className="p-4 sm:p-5">
          <DecisionGantt />
        </Card>
      </section>

      {/* 每环节深度解读 */}
      {DEPTH_STEPS.map((s, idx) => (
        <section key={s.no} id={`step-${s.no}`} className="scroll-mt-20">
          <Card className="p-5 sm:p-6 overflow-hidden">
            {/* 环节头 */}
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg text-white font-bold shrink-0" style={{ background: STAGE_COLORS[s.no - 1] }}>
                {s.no}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg leading-tight">{s.title}</h2>
                <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${STAGE_BG[s.stage] ?? "bg-muted/20 text-muted"}`}>{s.stage}</span>
              </div>
            </div>

            {/* 核心目标 */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 mb-4">
              <p className="flex items-start gap-2 text-sm">
                <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><b>核心目标：</b>{s.goal}</span>
              </p>
            </div>

            {/* 输入输出 + 方法工具 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-border px-3 py-2.5">
                <p className="text-xs font-bold text-primary mb-1.5">输入 → 分析 → 输出</p>
                <div className="space-y-1 text-[12px] text-muted leading-relaxed">
                  <p><b className="text-foreground">输入：</b>{s.inputs.join("；")}</p>
                  <p><b className="text-foreground">输出：</b>{s.outputs.join("；")}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border px-3 py-2.5">
                <p className="flex items-center gap-1 text-xs font-bold text-primary mb-1.5"><Wrench className="w-3.5 h-3.5" /> 方法工具</p>
                <div className="space-y-1">
                  {s.methods.map((m) => (
                    <p key={m.name} className="text-[12px]"><b className="text-foreground">{m.name}</b> <span className="text-muted">— {m.usage}</span></p>
                  ))}
                </div>
              </div>
            </div>

            {/* 案例解剖 */}
            <div className="mb-4">
              <p className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                <BookOpen className="w-4 h-4" /> 真实案例解剖 · 数据 → 决策路径
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {s.cases.map((c) => (
                  <div key={c.title} className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm font-bold">{c.title}</p>
                    <p className="text-[12px] text-muted leading-relaxed">{c.background}</p>
                    <div className="rounded bg-muted/15 px-2.5 py-1.5 space-y-0.5">
                      {c.data.map((d, i) => (
                        <p key={i} className="text-[11px] font-mono text-muted leading-relaxed">· {d}</p>
                      ))}
                    </div>
                    <p className="text-[12px] leading-relaxed"><b className="text-foreground">决策路径：</b>{c.decision}</p>
                    <p className="text-[11px] text-muted leading-relaxed"><b>环节联动：</b>{c.linkage}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 可视化配套 */}
            {s.viz.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
                  <Eye className="w-4 h-4" /> 可视化方案
                </p>
                <div className="space-y-3">
                  {s.viz.map((v) => (
                    <div key={v.title}>
                      <VizByType type={v.type} label={v.title} />
                      <p className="text-[10px] text-muted mt-1">
                        <b className="text-foreground">{DEPTH_VIZ_TYPES[v.type]?.icon} {v.title}：</b>{v.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </section>
      ))}

      {/* 数据可信声明 */}
      <section>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-sm font-bold mb-2"><ShieldCheck className="w-4 h-4 text-primary" /> 数据可信与溯源</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted leading-relaxed">
            <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" /> 行情/指数：腾讯/东财/新浪真实日线（sh-index.json / us-market.json）</span>
            <span>· 个股财务：东财 F10 真实财报（茅台 ROE 16.75% 等）</span>
            <span>· 行业资金：东财 f62 实时</span>
            <span>· 宏观：东财数据中心 24 指标</span>
            <span>· 案例教学值已标注（宏观β 为真实年度收益，α 为方法演示）</span>
          </div>
          <p className="text-[10px] text-muted mt-2">本页为研究框架与决策方法演示，不构成投资建议。来源核对详见 /gmrds/sources。</p>
        </Card>
      </section>
    </div>
  );
}
