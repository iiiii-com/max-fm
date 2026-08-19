import Link from "next/link";
import { getPolicies } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "政策解读" };

export default async function PolicyPage() {
  await bootstrap();
  const policies = await getPolicies();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">政策解读</h1>
        <p className="text-sm text-muted mt-1">政策原文 + 三层 AI 解读（普通人视角 · 投资者视角 · 专业视角），覆盖 2018 年以来重大政策</p>
      </header>

      <section>
        <SectionTitle title="政策库" sub="按时间倒序，来源为政府公报与官方发布" />
        <div className="grid grid-cols-1 gap-4">
          {policies.map((p: any) => (
            <Link key={p.id} href={`/policy/${p.id}`}>
              <Card className="hover:shadow-md hover:border-primary/40 transition-all">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge>{p.category || "政策"}</Badge>
                  <span className="text-xs text-muted">{fmtDate(p.publishDate)}</span>
                  <span className="text-xs text-muted ml-auto">{p.department}</span>
                </div>
                <h3 className="font-bold text-lg leading-snug">{p.title}</h3>
                <p className="text-sm text-muted mt-1.5 line-clamp-2">{p.summary}</p>
                <div className="flex gap-2 mt-3">
                  <Badge tone="amber">普通人怎么看</Badge>
                  <Badge tone="green">投资者关注点</Badge>
                  <Badge tone="gray">专业解读</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}