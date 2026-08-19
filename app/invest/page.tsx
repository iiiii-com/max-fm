import Link from "next/link";
import { fetchQuotes, fetchGlobalQuotes, fetchSectors } from "@/lib/data/quotes";
import { getArticles } from "@/lib/data/queries";
import { SectionTitle, Badge, AIFlag } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import MarketView from "@/components/MarketView";
import MarketDashboard from "@/components/MarketDashboard";
import NewsPanel from "@/components/NewsPanel";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "投资分析" };

export default async function InvestPage() {
  await bootstrap();
  const [quotes, global, sectors, articles] = await Promise.all([fetchQuotes(), fetchGlobalQuotes(), fetchSectors(), getArticles(undefined, 6)]);
  const reviews = articles.filter((a: any) => a.type === "daily" || a.type === "weekly");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">投资分析</h1>
        <p className="text-sm text-muted mt-1">实时行情来自东方财富公开接口 · 复盘报告由 AI 每日自动生成 · 不构成投资建议</p>
      </header>

      <MarketView initialQuotes={quotes} initialGlobal={global} initialSectors={sectors} />

      <section>
        <SectionTitle title="资金流总览" sub="板块主力资金流向 · 北向资金 · 自选标的快捷下钻" />
        <MarketDashboard />
      </section>

      <section>
        <SectionTitle title="市场快讯" sub="财经要闻滚动 · 点击阅读原文" />
        <NewsPanel />
      </section>

      <div className="flex gap-3 flex-wrap">
        <Link href="/stock" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">个股行情 & K 线</Link>
        <Link href="/industry" className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">产业链全景</Link>
        <Link href="/macro" className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">宏观指标对比</Link>
      </div>

      <section>
        <SectionTitle title="AI 复盘报告" sub="每日收盘后自动生成" extra={<AIFlag />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((a: any) => (
            <Link key={a.id} href={`/article/${a.slug}`}>
              <div className="card p-4 hover:shadow-md transition-shadow h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{a.type === "daily" ? "每日复盘" : "每周周报"}</Badge>
                  <span className="text-xs text-muted ml-auto">{fmtDate(a.publishDate)}</span>
                </div>
                <h3 className="font-bold leading-snug line-clamp-2">{a.title}</h3>
                <p className="text-sm text-muted mt-1.5 line-clamp-2">{a.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="card bg-primary/5 border-primary/20">
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">风险提示：</span>
          本站全部内容（含 AI 生成报告）仅为信息展示与数据分析，不构成任何投资建议。投资有风险，入市需谨慎。
        </p>
      </div>
    </div>
  );
}