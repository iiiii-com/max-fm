import { getChains, getChainNodes } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import ChainGraph from "@/components/charts/ChainGraph";
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
        <p className="text-sm text-muted mt-1">6 条主线：新能源车 · 半导体 · 人工智能 · 医药生物 · 房地产 · 白酒消费，上下游关系一键看清</p>
      </header>

      <section>
        <SectionTitle title="产业链全景图" sub="力导向图：节点为环节，连线为上下游关系" />
        <Card>
          <ChainGraph nodes={nodes} links={links} />
        </Card>
      </section>

      <section>
        <SectionTitle title="六大主线" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chains.map((c: any) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <Badge tone={c.name.includes("AI") || c.name.includes("半导体") ? "amber" : "red"}>{c.name}</Badge>
                <span className="text-xs text-muted">更新于 {fmtDate(c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("zh-CN") : "—")}</span>
              </div>
              <p className="text-sm text-muted line-clamp-3">{c.description}</p>
              <p className="text-xs text-muted mt-2">{nodes.filter((n: any) => n.chainId === c.id).length} 个环节 · 持续跟踪中</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}