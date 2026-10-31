import Link from "next/link";
import { getFeelingAggregates, getTemperatures, getTemperatureAnalysis, getArticles, buildTempDiffView, fmtTemp, fmtDiff, getMacroProvenance } from "@/lib/data/queries";
import { getFeelingMonthlyHistory, getFeelingDistribution } from "@/lib/data/feeling";
import { SectionTitle, Card, Badge, AIFlag } from "@/components/ui";
import { DualThermometer, FeelingBar } from "@/components/charts/Thermometer";
import { TempFeelingTrend, FeelingDistribution } from "@/components/macro/FeelingCharts";
import Markdown from "@/components/markdown";
import FeelingSurvey from "@/components/FeelingSurvey";
import { fmt } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "宏观温度 vs 个人体感" };

export default async function FeelingPage() {
  await bootstrap();
  const [feeling, temps, analysis, articles, history, distribution, provenance] = await Promise.all([
    getFeelingAggregates(),
    getTemperatures(),
    getTemperatureAnalysis(),
    getArticles("temperature"),
    getFeelingMonthlyHistory(12),
    getFeelingDistribution(),
    getMacroProvenance(),
  ]);
  // 宏观温度是用宏观指标序列算出来的；若指标还是种子数据，这一侧就不是「真实数据」。
  const macroSeed = provenance.seed;
  const lastTemp = temps[temps.length - 1];
  const tv = buildTempDiffView(lastTemp?.temperature, feeling.overall, feeling.sampleCount, lastTemp?.date ?? null);
  const tempReport = articles[0];
  // 真实双序列：宏观温度按月留存于 macroTemperatures；体感由问卷 createdAt 按月聚合。
  // 空月两边都留 null（图表断线），不做任何「用宏观推体感」的拟合。
  const macroByMonth = new Map<string, number>();
  temps.forEach((t: any) => {
    if (t?.date != null && t.temperature != null) macroByMonth.set(String(t.date), Number(t.temperature));
  });
  const feelingByMonth = new Map<string, { avg: number | null; count: number }>();
  history.forEach((h) => feelingByMonth.set(h.month, { avg: h.avg, count: h.count }));
  const monthSet = Array.from(new Set([...history.map((h) => h.month), ...Array.from(macroByMonth.keys())])).sort();
  const points = monthSet.slice(-12).map((month) => {
    const f = feelingByMonth.get(month);
    return {
      month,
      macro: macroByMonth.has(month) ? (macroByMonth.get(month) as number) : null,
      feeling: f?.avg ?? null,
      count: f?.count ?? 0,
    };
  });
  const distributionTotal = distribution.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">宏观温度 vs 个人体感</h1>
        <p className="text-sm text-muted mt-1">数据说经济在回暖，为什么很多人感觉不到？—— 温差从哪来，这里讲清楚</p>
        {macroSeed ? (
          <p
            className="text-xs mt-1 rounded-md border px-3 py-2 leading-relaxed"
            style={{ borderColor: "#d97706", background: "rgba(217,119,6,0.10)", color: "#b45309" }}
          >
            ⚠ 宏观温度由宏观指标序列计算，当前库中仍有 {macroSeed} 行指标是种子/示例数据
            （未完成真实报表同步），因此「宏观温度」这一侧的绝对值仅供参考，请勿据此判断经济冷热。
            体感数据来自真实提交的问卷样本。
          </p>
        ) : null}
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle
            title="双温度计"
            sub={
              tv.missing
                ? "宏观温度或体感数据缺失，温差暂不可计算"
                : `宏观 ${fmtTemp(tv.macro)}° vs 体感 ${fmtTemp(tv.feeling)}°，温差 ${fmtDiff(tv.diff)}°（体感基于 ${tv.sampleCount} 份问卷）`
            }
          />
          {tv.missing ? (
            <p className="text-sm text-muted py-6 text-center">
              {tv.missing === "feeling"
                ? "暂无体感问卷数据，请先在右侧提交体感问卷"
                : "暂无宏观温度数据"}
            </p>
          ) : (
            <DualThermometer macro={tv.macro!} feeling={tv.feeling!} />
          )}
        </Card>
        <Card>
          <SectionTitle title="填写你的体感" sub="8 项选择，10 秒完成，计入大众体感均值（与下方体感指数同源）" />
          <FeelingSurvey />
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="温差报告" sub={analysis ? `${analysis.date} 更新` : ""} extra={<AIFlag />} />
          {analysis ? (
            <Markdown content={analysis.content} />
          ) : (
            <p className="text-sm text-muted">
              暂无温差报告：报告由每日温度任务自动生成，需要「当月宏观温度」与「当月体感问卷」同时存在；
              样本不足时不会用推导值填充。可先在右侧提交体感问卷。
            </p>
          )}
          {tempReport && (
            <Link href={`/article/${tempReport.slug}`} className="mt-3 inline-block text-sm text-primary hover:underline">
              阅读完整《温差报告》→
            </Link>
          )}
        </Card>
        <TempFeelingTrend points={points} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FeelingDistribution buckets={distribution} total={distributionTotal} />
        <Card>
          <SectionTitle title="温差怎么读" sub="同一把 0–100 尺子：宏观温度来自 PMI/CPI/M2，体感来自问卷均分" />
          <ul className="text-sm text-muted space-y-3 leading-relaxed">
            <li>
              <b className="text-fg">温差 = 宏观温度 − 大众体感。</b>
              为正说明「数据比感受暖」，为负说明「感受比数据暖」，绝对值越大分歧越明显。
            </li>
            <li>
              <b className="text-fg">两类数据的口径不同：</b>宏观温度是加权合成指数（0.4 PMI + 0.35 CPI + 0.25 M2），
              体感是用户自评分的等权均值；它们不是同一个东西，只用于对照而非互相校验。
            </li>
            <li>
              <b className="text-fg">看趋势不看单点：</b>单月温差受样本结构影响较大；连续 3 个月同向的温差更有解释力。
            </li>
            <li>
              <b className="text-fg">样本会滚动：</b>问卷按月聚合，当月样本在月内持续累计，跨月后成为历史点。
            </li>
          </ul>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <SectionTitle title="按年龄" />
          <FeelingBar data={feeling.byAge.map((x: any) => ({ name: x.bucket, value: x.avgScore }))} />
        </Card>
        <Card>
          <SectionTitle title="按职业" />
          <FeelingBar data={feeling.byOccupation.map((x: any) => ({ name: x.bucket, value: x.avgScore }))} color="#1d4ed8" />
        </Card>
        <Card>
          <SectionTitle title="按地区" />
          <FeelingBar data={feeling.byRegion.map((x: any) => ({ name: x.bucket, value: x.avgScore }))} color="#0d9488" />
        </Card>
      </section>

      <section>
        <SectionTitle title="为什么宏观数据和个人感受可以同时为真？" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { t: "平均值掩盖结构差异", d: "CPI 是“平均”，但你的消费篮子可能和平均完全不同" },
            { t: "宏观增长 ≠ 个体增收", d: "GDP 来自高技术产业与出口，传统行业感受滞后" },
            { t: "指标滞后于感受", d: "官方指标反映过去，感受基于当下的房租、菜价与预期" },
            { t: "地区与行业分化", d: "广东体感与东北体感，可能是两个不同的经济" },
          ].map((x: any) => (
            <Card key={x.t}>
              <Badge tone="amber">{x.t}</Badge>
              <p className="text-sm text-muted mt-2">{x.d}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}