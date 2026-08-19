import Link from "next/link";
import { notFound } from "next/navigation";
import { getHistoryEvent, getHistoryEvents } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import Markdown from "@/components/markdown";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "历史事件详情" };

const CAT_TONE: Record<string, string> = {
  债务危机: "amber", 金融危机: "red", 泡沫破裂: "purple", 股市崩盘: "red",
  政策冲击: "blue", 供给冲击: "green", 黑天鹅: "gray",
};

export default async function HistoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await bootstrap();
  const [e, events] = await Promise.all([getHistoryEvent(slug), getHistoryEvents()]);
  if (!e) notFound();
  const keyData = JSON.parse(e.dataLinks ?? "[]") as Array<{ label: string; value: string }>;
  const tags = JSON.parse(e.tags ?? "[]") as string[];
  const idx = events.findIndex((x: any) => x.id === e.id);
  const prev = idx > 0 ? events[idx - 1] : null;
  const next = idx >= 0 && idx < events.length - 1 ? events[idx + 1] : null;
  const sameCat = events
    .filter((x: any) => x.category === e.category && x.id !== e.id)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Link href="/history" className="text-sm text-primary hover:underline">← 历史回顾</Link>
          <Badge tone={(CAT_TONE[e.category] ?? "gray") as any}>{e.category || "事件"}</Badge>
          <Badge tone="gray">{e.region}</Badge>
          <span className="text-sm text-muted ml-auto font-mono">{e.date}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">{e.title}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{e.summary}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((t) => <Badge key={t} tone="gray">{t}</Badge>)}
        </div>
      </header>

      <section>
        <SectionTitle title="关键数据" sub="事件核心数字一览" />
        {keyData.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {keyData.map((d) => (
              <Card key={d.label} className="p-4">
                <p className="text-xs text-muted">{d.label}</p>
                <p className="font-bold text-lg mt-1">{d.value}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card><p className="text-sm text-muted">本事件暂无结构化数据，详见下方事件回放。</p></Card>
        )}
      </section>

      {sameCat.length > 0 && (
        <section>
          <SectionTitle title={`同类事件 · ${e.category}`} sub="同一类风险的历史参照" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sameCat.map((s: any) => (
              <Link key={s.id} href={`/history/${s.slug}`} className="hover:shadow-md transition-shadow">
                <Card className="p-4 h-full">
                  <div className="flex items-center justify-between mb-1">
                    <Badge tone={(CAT_TONE[s.category] ?? "gray") as any}>{s.category}</Badge>
                    <span className="text-[11px] text-muted font-mono">{s.date}</span>
                  </div>
                  <h3 className="font-bold text-sm leading-snug">{s.title}</h3>
                  <p className="text-xs text-muted mt-1 line-clamp-2">{s.summary}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="事件回放" sub="背景 · 经过 · 影响 · 启示" />
        <Card className="p-6">
          <article className="prose prose-sm max-w-none">
            <Markdown content={e.content} />
          </article>
        </Card>
      </section>

      <section>
        <div className="flex justify-between items-center">
          {prev ? (
            <Link href={`/history/${prev.slug}`} className="text-sm text-muted hover:text-primary transition-colors">
              ← 更早：{prev.title}
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/history/${next.slug}`} className="text-sm text-muted hover:text-primary transition-colors">
              更晚：{next.title} →
            </Link>
          ) : <span />}
        </div>
      </section>
    </div>
  );
}