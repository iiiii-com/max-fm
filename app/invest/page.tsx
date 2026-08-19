import Link from "next/link";
import { fetchQuotes, fetchSectors } from "@/lib/data/quotes";
import { getArticles } from "@/lib/data/queries";
import { SectionTitle, Badge, AIFlag } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import MarketView from "@/components/MarketView";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "投资分析" };

export default async function InvestPage() {
  await bootstrap();
  const [quotes, sectors, articles] = await Promise.all([fetchQuotes(), fetchSectors(), getArticles(undefined, 6)]);
  const reviews = articles.filter((a: any) => a.type === "daily" || a.type === "weekly");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">投资分析</h1>
        <p className="text-sm text-muted mt-1">实时行情来自东方财富公开接口 · 复盘报告由 AI 每日自动生成 · 不构成投资建议</p>
      </header>

      <MarketView initialQuotes={quotes} initialSectors={sectors} />

      <section>
        <SectionTitle title="AI 复盘报告" sub="每日收盘后自动生成" extra={<AIFlag />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((a: any) => (
            <Link key={a.id} href={`/article/${a.slug}`}>
              <div className="card p-4 hover:shadow-md transition-shadow h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{a.type === "daily" ? "每日复盘" : "每周周报"}</Badge>
                  <span className="text-xs text-muted ml-auto">{fmtDate(a.publish_date)}</span>
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