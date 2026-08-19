import Link from "next/link";
import { notFound } from "next/navigation";
import { getPolicyWithAnalysis, getPolicies } from "@/lib/data/queries";
import { Card, Badge, AIFlag } from "@/components/ui";
import Markdown from "@/components/markdown";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "政策详情" };

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await bootstrap();
  const [row, others] = await Promise.all([getPolicyWithAnalysis(id), getPolicies()]);
  if (!row) notFound();
  const { policy: p, analysis } = row;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-2">
          <Badge>{p.category || "政策"}</Badge>
          <span className="text-sm text-muted">{fmtDate(p.publishDate)}</span>
          <span className="text-sm text-muted ml-auto">发布机构：{p.department || "—"}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">{p.title}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{p.summary}</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">普通人怎么看</h2>
            <AIFlag />
          </div>
          {analysis?.popular ? (
            <div className="prose-sm"><Markdown content={analysis.popular} /></div>
          ) : <p className="text-sm text-muted">分析生成中</p>}
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">专业解读</h2>
            <AIFlag />
          </div>
          {analysis?.professional ? (
            <div className="prose-sm"><Markdown content={analysis.professional} /></div>
          ) : <p className="text-sm text-muted">分析生成中</p>}
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">关联数据</h2>
          </div>
          {analysis?.dataLinks ? (
            <>
              <p className="text-sm text-muted mb-2">政策解读涉及的关联指标：</p>
              <div className="flex flex-wrap gap-2">
                {(JSON.parse(analysis.dataLinks) as string[]).map((d: any) => (
                  <Badge key={d} tone="gray">{d}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted mt-4">数据由 Max 数据管道自动关联，分析由 AI 生成。</p>
            </>
          ) : <p className="text-sm text-muted">数据关联生成中</p>}
        </Card>
      </section>

      <section>
        <Card>
          <h2 className="font-bold mb-3">政策原文要点</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted leading-relaxed">{p.content}</pre>
        </Card>
      </section>

      <section>
        <h2 className="font-bold mb-3">其他政策</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {others.filter((o: any) => o.id !== p.id).slice(0, 6).map((o: any) => (
            <Link key={o.id} href={`/policy/${o.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <h3 className="font-medium text-sm line-clamp-2 leading-snug">{o.title}</h3>
                <p className="text-xs text-muted mt-2">{fmtDate(o.publishDate)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}