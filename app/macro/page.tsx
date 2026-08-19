import Link from "next/link";
import { getIndicators, getArticles } from "@/lib/data/queries";
import { SectionTitle, Card, Badge, AIFlag } from "@/components/ui";
import { TrendCard } from "@/components/charts/IndicatorLine";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "宏观经济" };

export default async function MacroPage() {
  await bootstrap();
  const [inds, articles] = await Promise.all([getIndicators(), getArticles("monthly")]);
  const series = (type: string) =>
    inds.filter((x: any) => x.type === type).map((x: any) => ({ date: x.date, value: x.value ?? 0 }));
  const latest = (type: string) => {
    const s = series(type);
    return s[s.length - 1]?.value ?? 0;
  };
  const monthly = articles[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">宏观经济</h1>
        <p className="text-sm text-muted mt-1">数据来源：国家统计局 / 中国人民银行 / 海关总署 / 财政部</p>
      </header>

      <div className="flex gap-3 flex-wrap">
        <Link href="/macro/feeling" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">宏观温度 vs 个人体感</Link>
        <Link href="/macro#report" className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">AI 月度报告</Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrendCard title="GDP 同比增速" value={latest("gdp")} unit="%" data={series("gdp")} color="#4f46e5" />
        <TrendCard title="CPI 同比" value={latest("cpi")} unit="%" data={series("cpi")} color="#dc2626" />
        <TrendCard title="PPI 同比" value={latest("ppi")} unit="%" data={series("ppi")} color="#ea580c" />
        <TrendCard title="制造业 PMI" value={latest("pmi")} unit="" data={series("pmi")} color="#0891b2" />
        <TrendCard title="M2 同比增速" value={latest("m2")} unit="%" data={series("m2")} color="#2563eb" />
        <TrendCard title="社融增量" value={latest("tsf")} unit="万亿" data={series("tsf")} color="#0d9488" />
        <TrendCard title="出口同比" value={latest("export")} unit="%" data={series("export")} color="#7c3aed" />
        <TrendCard title="城镇调查失业率" value={latest("unemp")} unit="%" data={series("unemp")} color="#ca8a04" />
      </section>

      <section id="report">
        <SectionTitle title="AI 月度报告" sub="每月自动生成，数据解读 + 趋势研判" extra={<AIFlag />} />
        {monthly ? (
          <Link href={`/article/${monthly.slug}`}>
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Badge>月度报告</Badge>
                <span className="text-xs text-muted">{fmtDate(monthly.publish_date)}</span>
              </div>
              <h3 className="font-bold text-lg">{monthly.title}</h3>
              <p className="text-sm text-muted mt-1 line-clamp-2">{monthly.summary}</p>
            </Card>
          </Link>
        ) : (
          <Card><p className="text-sm text-muted">月报将在每月 1 日由 AI 自动生成</p></Card>
        )}
      </section>
    </div>
  );
}