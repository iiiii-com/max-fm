import BoardTabs from "@/components/BoardTabs";
import { getChains, getChainNodes } from "@/lib/data/queries";
import { Card, SectionTitle } from "@/components/ui";
import ChainFlowExplorer from "@/components/chain/ChainFlowExplorer";
import ChainEcosystem from "@/components/chain/ChainEcosystem";
import ChainHost from "@/components/chain/ChainHost";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "产业链分析" };


const TABS = [
  { key: "overview", label: "全景图" },
  { key: "chains", label: "产业链列表" },
];

export default async function IndustryPage({ searchParams }: { searchParams: Promise<{ tab?: string; chain?: string }> }) {
  const { tab, chain } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "overview";

  await bootstrap();
  const chains = await getChains();
  const nodes = await getChainNodes();

  const nodeCounts: Record<string, number> = {};
  for (const c of chains) {
    nodeCounts[c.id] = nodes.filter((n: any) => n.chainId === c.id).length;
  }

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">产业链分析</h1>
        <p className="text-sm text-muted mt-1">主线产业链：新能源车 · 半导体 · AI · 光伏 · 低空经济 · 创新药等，点开查看上中下游解剖</p>
      </header>

      <BoardTabs tabs={TABS} active={active} />

      {active === "overview" && (
        <section className="space-y-8">
          <div>
            <SectionTitle
              title="产业链分层流向图"
              sub="按「上游 → 中游 → 下游」分层呈现每条链的环节构成；点击上方链名切换，点击环节展开说明与相关公司"
            />
            <Card>
              <ChainFlowExplorer chains={chains} nodes={nodes as any} />
            </Card>
          </div>
          <div>
            <SectionTitle title="产业链生态关联图" sub="热门产业链之间的供需与协同关系 · 点击节点打开对应链详情" />
            <Card>
              <ChainEcosystem />
            </Card>
          </div>
        </section>
      )}

      {active === "chains" && (
        <ChainHost dbChains={chains as any} nodeCounts={nodeCounts} initialChain={chain} />
      )}
    </div>
  );
}