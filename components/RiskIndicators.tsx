import { getRiskIndicators } from "@/lib/data/risk";
import { Card, SectionTitle, Badge } from "@/components/ui";

const LEVEL_META: Record<"low" | "mid" | "high", { label: string; tone: "green" | "amber" | "red" }> = {
  low: { label: "风险低", tone: "green" },
  mid: { label: "需警惕", tone: "amber" },
  high: { label: "高风险", tone: "red" },
};

export default async function RiskIndicators() {
  const indicators = await getRiskIndicators();
  return (
    <section>
      <SectionTitle
        title="宏观危机预警指标"
        sub="VIX 恐慌指数 · 美债收益率曲线 · 铜金比 · 中国国债收益率；实时拉取失败时自动降级为最新已知值（标记缓存）"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {indicators.map((ind) => (
          <Card key={ind.key} className="p-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h3 className="font-bold text-sm">{ind.label}</h3>
              {ind.stale && <Badge tone="gray">缓存</Badge>}
            </div>
            <p className="text-2xl font-bold font-mono">
              {ind.value}
              <span className="text-sm text-muted font-normal ml-1">{ind.unit}</span>
            </p>
            <div className="mt-2">
              <Badge tone={LEVEL_META[ind.level].tone}>{LEVEL_META[ind.level].label}</Badge>
            </div>
            <p className="text-xs text-muted mt-2 leading-relaxed">{ind.note}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}