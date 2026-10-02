import { ALL_CHAIN_INSIGHTS } from "@/lib/data/chainInsightsAll";
import { Card, SectionTitle } from "@/components/ui";

/**
 * 产业解读与专业指导区块。
 *
 * 此前 /industry/[slug] 只有结构（环节数、泳道、指标卡），
 * 没有任何解读层 —— 这是"产业地图内容太少"的直接原因：
 * 结构画得再清楚，也不回答"这条链靠什么赚钱、看什么、风险在哪、怎么跟踪"。
 *
 * 内容全部来自 lib/data/chainInsightsAll.ts 汇总的两份数据
 * （chainInsights.ts 原有 25 条 + chainInsightsExtra.ts 补入库的 9 条）。
 * 「关注指标」只列指标名称，不列数值 —— 数值由 chain_metrics 在满足
 * 「单位 + 时点 + 来源 + 口径」四件套校验后才展示，避免两处数字打架。
 */
export default function ChainInsightPanel({ slug }: { slug: string }) {
  const ins = ALL_CHAIN_INSIGHTS[slug];
  if (!ins) return null;

  return (
    <section>
      <SectionTitle
        title="产业解读与跟踪指导"
        sub="本链的盈利本质、价值传导路径与风险结构。关注指标只列指标名称 —— 数值仅在满足「单位 + 时点 + 来源 + 口径」校验后才在本页展示"
      />

      <div className="space-y-4">
        <Card className="p-5">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-1.5">盈利本质</p>
          <p className="text-sm leading-relaxed text-foreground/90">{ins.economics}</p>
        </Card>

        <Card className="p-5">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-1.5">价值传导路径</p>
          <p className="text-sm leading-relaxed text-foreground/90">{ins.transmission}</p>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-2.5">关键环节</p>
            <ol className="space-y-2">
              {ins.chokepoints.map((c, i) => (
                <li key={c} className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[11px] text-muted w-4 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium">{c}</span>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
              瓶颈环节决定整链的议价能力与超额利润来源；非瓶颈环节的景气度通常只是跟随。
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-2.5">关注指标</p>
            <ul className="space-y-1.5">
              {ins.watch.map((w) => (
                <li key={w} className="text-[13px] leading-relaxed text-foreground/85 pl-3 border-l-2 border-primary/30">
                  {w}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
              这些是公开可查的指标名称，不是本页数据；对应的已核验数值见上方指标卡。
            </p>
          </Card>
        </div>

        <Card className="p-5">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-2.5">风险结构</p>
          <ul className="space-y-2">
            {ins.risks.map((r) => (
              <li key={r} className="text-[13px] leading-relaxed text-foreground/85 flex gap-2">
                <span className="text-muted shrink-0" aria-hidden>
                  —
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 bg-primary/[0.03] border-primary/20">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-1.5">怎么跟踪</p>
          <p className="text-sm leading-relaxed text-foreground/90">{ins.tracking}</p>
        </Card>
      </div>
    </section>
  );
}
