import BoardTabs from "@/components/BoardTabs";
import { getChains, getChainNodes } from "@/lib/data/queries";
import { Card, SectionTitle } from "@/components/ui";
import ChainGraphViewer from "@/components/ChainGraphViewer";
import IndustryHeatCard from "@/components/IndustryHeatCard";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "产业链分析" };

const ROLE_ORDER: Record<string, number> = { 上游: 0, 中游: 1, 下游: 2 };

const TABS = [
  { key: "overview", label: "全景图" },
  { key: "chains", label: "二十二条主线" },
];

export default async function IndustryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "overview";

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

      <BoardTabs tabs={TABS} active={active} />

      {active === "overview" && (
        <section>
          <SectionTitle title="产业链全景图" sub="力导向图：节点为环节，连线为上下游关系；可聚焦单条链查看" />
          <Card>
            <ChainGraphViewer chains={chains} nodes={nodes} links={links} />
          </Card>
        </section>
      )}

      {active === "chains" && (
        <section>
          <SectionTitle title="二十二条主线" sub="点击卡片查看上中下游解剖与代表公司，底部标注板块当日热度与主力资金" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chains.map((c: any) => (
              <IndustryHeatCard
                key={c.id}
                name={c.name}
                slug={c.slug}
                description={c.description}
                updatedAt={c.updatedAt}
                nodeCount={nodes.filter((n: any) => n.chainId === c.id).length}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}