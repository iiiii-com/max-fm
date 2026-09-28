import { getRiskIndicators } from "@/lib/data/risk";
import { Card, SectionTitle, Badge } from "@/components/ui";

const LEVEL_META: Record<
  "low" | "mid" | "high" | "unknown",
  { label: string; tone: "green" | "amber" | "red" | "gray" }
> = {
  low: { label: "风险低", tone: "green" },
  mid: { label: "中性", tone: "amber" },
  high: { label: "高风险", tone: "red" },
  unknown: { label: "不可用", tone: "gray" },
};

export default async function RiskIndicators() {
  const indicators = await getRiskIndicators();
  return (
    <section>
      <SectionTitle
        title="宏观危机预警指标"
        sub="VIX 恐慌指数 · 美债收益率曲线 · 铜金比 · 中国国债收益率。取不到真实数值时显示「不可用」并指明权威来源，本站不以占位数字或推导值充当数据；等级判定与阈值说明使用同一套规则。"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {indicators.map((ind) => {
          const meta = LEVEL_META[ind.level];
          const hasValue = ind.value != null && Number.isFinite(ind.value);
          return (
            <Card key={ind.key} className="p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="font-bold text-sm">{ind.label}</h3>
                <Badge tone={hasValue ? meta.tone : "gray"}>{hasValue ? meta.label : "不可用"}</Badge>
              </div>
              <p className="text-2xl font-bold font-mono">
                {hasValue ? (
                  <>
                    {ind.value}
                    <span className="text-sm text-muted font-normal ml-1">{ind.unit}</span>
                  </>
                ) : (
                  <span className="text-base text-muted font-normal">数据源不可达</span>
                )}
              </p>
              <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{ind.note}</p>
              <p className="text-[10px] text-muted/80 mt-auto pt-2 leading-relaxed">
                来源：{ind.source}
              </p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
