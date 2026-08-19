import Link from "next/link";
import { searchAll } from "@/lib/data/queries";
import { Card, Badge } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { Search } from "lucide-react";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "搜索" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  await bootstrap();
  const results = q?.trim() ? await searchAll(q.trim()) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">全站搜索</h1>
        <p className="text-sm text-muted mt-1">搜索文章、政策、宏观指标与产业链</p>
      </header>
      <form action="/search" method="get" className="flex gap-2">
        <input
          name="q" defaultValue={q} placeholder="输入关键词，如：CPI、降准、人工智能…"
          className="input flex-1"
          autoFocus
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium flex items-center gap-1.5">
          <Search className="w-4 h-4" /> 搜索
        </button>
      </form>

      {q && !results?.articles.length && !results?.policies.length && !results?.indicators.length && !results?.chains.length && (
        <Card><p className="text-sm text-muted">没有找到与「{q}」相关的内容，换个关键词试试。</p></Card>
      )}

      {results?.articles.length ? (
        <section>
          <h2 className="font-bold mb-3">文章（{results.articles.length}）</h2>
          <div className="grid grid-cols-1 gap-3">
            {results.articles.map((a: any) => (
              <Link key={a.id} href={`/article/${a.slug}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge>{a.type}</Badge>
                    <span className="text-xs text-muted">{fmtDate(a.publishDate)}</span>
                  </div>
                  <h3 className="font-bold">{a.title}</h3>
                  <p className="text-sm text-muted mt-1 line-clamp-2">{a.summary}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {results?.policies.length ? (
        <section>
          <h2 className="font-bold mb-3">政策（{results.policies.length}）</h2>
          <div className="grid grid-cols-1 gap-3">
            {results.policies.map((p: any) => (
              <Link key={p.id} href={`/policy/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone="amber">{p.category || "政策"}</Badge>
                    <span className="text-xs text-muted">{fmtDate(p.publishDate)}</span>
                  </div>
                  <h3 className="font-bold">{p.title}</h3>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {results?.indicators.length ? (
        <section>
          <h2 className="font-bold mb-3">宏观指标（{results.indicators.length}）</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.indicators.map((x: any) => (
              <Link key={x.id} href="/macro">
                <Card className="hover:shadow-md transition-shadow">
                  <p className="font-bold">{x.name}</p>
                  <p className="text-sm text-muted mt-1">最新值：{x.value ?? "—"} {x.unit ?? ""}（{x.date}）</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {results?.chains.length ? (
        <section>
          <h2 className="font-bold mb-3">产业链（{results.chains.length}）</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.chains.map((c: any) => (
              <Link key={c.id} href="/industry">
                <Card className="hover:shadow-md transition-shadow">
                  <p className="font-bold">{c.name}</p>
                  <p className="text-sm text-muted mt-1 line-clamp-2">{c.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}