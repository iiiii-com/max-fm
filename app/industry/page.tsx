import Link from "next/link";
import { getChains, getChainNodes } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import ChainGraphViewer from "@/components/ChainGraphViewer";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "产业链分析" };

const ROLE_ORDER: Record<string, number> = { 上游: 0, 中游: 1, 下游: 2 };

export default async function IndustryPage() {
  await bootstrap();
  const chains = await getChains();
  const nodes = await getChainNodes();

  const links: Array<{ source: string; target: string }> = [];
  for (const c of chains) {
    const inChain = nodes
      .filter((n: any) => n.chainId === c.id)
      .sort((a: any, b: any) => (ROLE_ORDER[a.level ?? ""] ?? 3) - (ROLE_ORDER[b.level ?? ""] ?? 3));
    for (let i = 0; i < inChain.length - 1; i++) {
      links.push({ source: inChain[i].name, target: inChain[i + 1].name });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">产业链分析</h1>
        <p className="text-sm text-muted mt-1">22 条主线产业链：新能源车 · 半导体 · AI · 光伏 · 低空经济 · 创新药等，点开查看上中下游解剖</p>
      </header>

      <section>
        <SectionTitle title="产业链全景图" sub="力导向图：节点为环节，连线为上下游关系；可聚焦单条链查看" />
        <Card>
          <ChainGraphViewer chains={chains} nodes={nodes} links={links} />
        </Card>
      </section>

      <section>
        <SectionTitle title="二十二条主线" sub="点击卡片查看上中下游解剖与代表公司" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chains.map((c: any) => (
            <Link key={c.id} href={`/industry/${c.slug}`}>
              <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone={c.name.includes("AI") || c.name.includes("半导体") ? "amber" : "red"}>{c.name}</Badge>
                  <span className="text-xs text-muted">更新于 {fmtDate(c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("zh-CN") : "—")}</span>
                </div>
                <p className="text-sm text-muted line-clamp-3">{c.description}</p>
                <p className="text-xs text-muted mt-2">{nodes.filter((n: any) => n.chainId === c.id).length} 个环节 · 查看上下游解剖 →</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}