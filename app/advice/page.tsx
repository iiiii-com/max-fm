import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getTemperatures, getFeelingAggregates, getUserAdvice } from "@/lib/data/queries";
import { SectionTitle, Card, Badge, AIFlag } from "@/components/ui";
import AdviceForm from "@/components/AdviceForm";
import Markdown from "@/components/markdown";
import { fmtDate } from "@/lib/utils";
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
  const macro = temps[temps.length - 1]?.temperature ?? 62;
  const latest = history[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">个人建议</h1>
        <p className="text-sm text-muted mt-1">3 分钟问卷 → AI 生成专属资产配置建议，结合宏观温度 {macro}° 与大众体感 {feeling.overall}°</p>
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
          <SectionTitle title={`最近一次建议（${fmtDate(new Date(latest.createdAt * 1000).toLocaleDateString("zh-CN"))}）`} extra={<AIFlag />} />
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Badge tone="amber">{latest.riskLevel}</Badge>
              <span className="text-xs text-muted">温差参考 {latest.temperatureDiff > 0 ? "+" : ""}{latest.temperatureDiff}°</span>
            </div>
            <Markdown content={latest.content} />
          </Card>
        </section>
      )}
    </div>
  );
}