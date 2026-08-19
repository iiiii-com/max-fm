import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug, getArticles } from "@/lib/data/queries";
import { Badge, AIFlag } from "@/components/ui";
import Markdown from "@/components/markdown";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "文章" };

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await bootstrap();
  const [article, others] = await Promise.all([getArticleBySlug(slug), getArticles(undefined, 5)]);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-3">
          <Badge>{article.type === "daily" ? "每日复盘" : article.type === "monthly" ? "月度报告" : article.type === "weekly" ? "每周周报" : "温差报告"}</Badge>
          <AIFlag />
          <span className="text-sm text-muted ml-auto">{fmtDate(article.publish_date)}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">{article.title}</h1>
        <p className="text-muted mt-3">{article.summary}</p>
      </header>
      <article>
        <Markdown content={article.content} />
      </article>
      <p className="text-xs text-muted border-t border-border pt-4">
        本文由 AI 基于公开数据自动生成，仅供参考，不构成任何投资建议。数据可能存在延迟或误差。
      </p>
      <section>
        <h2 className="font-bold mb-3">相关阅读</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {others.filter((a: any) => a.slug !== slug).slice(0, 4).map((a: any) => (
            <Link key={a.id} href={`/article/${a.slug}`}>
              <div className="card p-4 hover:shadow-md transition-shadow h-full">
                <h3 className="font-medium text-sm line-clamp-2 leading-snug">{a.title}</h3>
                <p className="text-xs text-muted mt-2">{fmtDate(a.publish_date)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}