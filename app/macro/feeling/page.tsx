import Link from "next/link";
import { getFeelingAggregates, getTemperatures, getTemperatureAnalysis, getArticles, buildTempDiffView, fmtTemp, fmtDiff } from "@/lib/data/queries";
import { SectionTitle, Card, Badge, AIFlag } from "@/components/ui";
import { DualThermometer, TempTrendChart, FeelingBar } from "@/components/charts/Thermometer";
import Markdown from "@/components/markdown";
import FeelingSurvey from "@/components/FeelingSurvey";
import { fmt } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "宏观温度 vs 个人体感" };

export default async function FeelingPage() {
  await bootstrap();
  const [feeling, temps, analysis, articles] = await Promise.all([
    getFeelingAggregates(),
    getTemperatures(),
    getTemperatureAnalysis(),
    getArticles("temperature"),
  ]);
  const lastTemp = temps[temps.length - 1];
  const tv = buildTempDiffView(lastTemp?.temperature, feeling.overall, feeling.sampleCount, lastTemp?.date ?? null);
  const tempReport = articles[0];
  // 体感没有按月的时间序列（问卷只在提交时记一条当日分），旧实现用
  // `45 + (macro-62)*0.6` 把体感线**由宏观线推导**出来——那不是体感数据。
  // 现只画真实的宏观温度序列，体感以「当前均值参考线」呈现并明确标注无历史序列。
  const trend = temps.slice(-12).map((t: any) => ({ date: t.date, macro: t.temperature ?? 0 }));

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">宏观温度 vs 个人体感</h1>
        <p className="text-sm text-muted mt-1">数据说经济在回暖，为什么很多人感觉不到？—— 温差从哪来，这里讲清楚</p>
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
            <p className="text-sm text-muted">温差报告将在温差超过 10° 时由 AI 自动生成</p>
          )}
          {tempReport && (
            <Link href={`/article/${tempReport.slug}`} className="mt-3 inline-block text-sm text-primary hover:underline">
              阅读完整《温差报告》→
            </Link>
          )}
        </Card>
        <Card>
          <SectionTitle
            title="近 12 个月宏观温度走势"
            sub="体感问卷不保留按月历史序列，故此处只绘制真实的宏观温度；当前体感均值以参考线标注"
          />
          <TempTrendChart data={trend} feelingRef={tv.feeling} />
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