import Link from "next/link";
import { getPolicies } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "政策解读" };

const CAT_ORDER = ["全部", "货币政策", "财政", "财税", "产业政策", "资本市场", "房地产", "消费促进", "对外开放", "改革", "民生"];

const ORG_BADGE: Record<string, string> = {
  "中国政府网": "中国政府网", "财政部": "财政部", "国家发展改革委": "发改委", "中国人民银行": "央行",
};

export default async function PolicyPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  await bootstrap();
  const all = await getPolicies();
  const policies = cat && cat !== "全部" ? all.filter((p: any) => p.category === cat) : all;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">政策解读</h1>
        <p className="text-sm text-muted mt-1">政策原文 + 三层 AI 解读（普通人视角 · 投资者视角 · 专业视角），实时同步自中国政府网、财政部、国家发展改革委、中国人民银行官网</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {CAT_ORDER.map((c) => (
          <Link
            key={c}
            href={c === "全部" ? "/policy" : `/policy?cat=${encodeURIComponent(c)}`}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              (cat ?? "全部") === c ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      <section>
        <SectionTitle title="政策库" sub="按发布时间倒序，每日自动同步官方发布（含原文链接）" />
        <div className="grid grid-cols-1 gap-4">
          {policies.map((p: any) => (
            <Link key={p.id} href={`/policy/${p.id}`}>
              <Card className="hover:shadow-md hover:border-primary/40 transition-all">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge>{p.category || "政策"}</Badge>
                  {p.source && <Badge tone="green">{ORG_BADGE[p.source] ?? p.source}</Badge>}
                  <span className="text-xs text-muted">{fmtDate(p.publishDate)}</span>
                  <span className="text-xs text-muted ml-auto">{p.department}</span>
                </div>
                <h3 className="font-bold text-lg leading-snug">{p.title}</h3>
                <p className="text-sm text-muted mt-1.5 line-clamp-2">{p.summary}</p>
                <div className="flex gap-2 mt-3 items-center flex-wrap">
                  <Badge tone="amber">普通人怎么看</Badge>
                  <Badge tone="green">投资者关注点</Badge>
                  <Badge tone="gray">专业解读</Badge>
                  {p.sourceUrl && <span className="ml-auto text-xs text-primary">官方原文 ↗</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}