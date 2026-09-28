import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTemperatures, getFeelingAggregates, getUserAdvice, buildTempDiffView, fmtTemp, fmtDiff } from "@/lib/data/queries";
import { SectionTitle, Card, Badge, AIFlag } from "@/components/ui";
import AdviceForm from "@/components/AdviceForm";
import Markdown from "@/components/markdown";
import { fmtDateTime } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "个人建议" };

export default async function AdvicePage() {
  await bootstrap();
  const session = await getSession();
  const [temps, feeling, history] = await Promise.all([
    getTemperatures(),
    getFeelingAggregates(),
    session ? getUserAdvice(session.id) : Promise.resolve([]),
  ]);
  const lastTemp = temps[temps.length - 1];
  const tv = buildTempDiffView(lastTemp?.temperature, feeling.overall, feeling.sampleCount, lastTemp?.date ?? null);
  const latest = history[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">个人建议</h1>
        <p className="text-sm text-muted mt-1">
          问卷 → AI 生成专属资产配置建议
          {tv.missing
            ? "。宏观温度或体感数据缺失，报告将不含温差结论。"
            : `，结合宏观温度 ${fmtTemp(tv.macro)}° 与大众体感 ${fmtTemp(tv.feeling)}°（温差 ${fmtDiff(tv.diff)}°）`}
        </p>
      </header>

      {!session && (
        <div className="card p-4 border-primary/30 bg-primary/5">
          <p className="text-sm">
            <span className="font-semibold">需要登录才能生成建议并保存历史。</span>{" "}
            <Link href="/login" className="text-primary hover:underline">去登录 →</Link>
          </p>
        </div>
      )}

      <section>
        <SectionTitle title="体感与配置问卷" sub="数据仅用于生成你的专属建议" />
        <Card>
          <AdviceForm />
        </Card>
      </section>

      {latest && (
        <section>
          {/* createdAt 已是毫秒时间戳（now() = Date.now()），旧实现又乘了 1000 导致年份变成 58710 */}
          <SectionTitle title={`最近一次建议（${fmtDateTime(latest.createdAt)}）`} extra={<AIFlag />} />
          <Card>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge tone="amber">{latest.riskLevel}</Badge>
              {latest.temperatureDiff != null ? (
                <span className="text-xs text-muted">
                  温差参考 {Number(latest.temperatureDiff) > 0 ? "+" : ""}{Math.round(Number(latest.temperatureDiff))}°
                </span>
              ) : (
                <span className="text-xs text-muted">温差参考：生成时无体感问卷数据</span>
              )}
            </div>
            <Markdown content={latest.content} />
          </Card>
        </section>
      )}
    </div>
  );
}