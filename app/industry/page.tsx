import BoardTabs from "@/components/BoardTabs";
import { getChains, getChainNodes, getChainMetrics } from "@/lib/data/queries";
import { Card, SectionTitle } from "@/components/ui";
import ChainFlowExplorer from "@/components/chain/ChainFlowExplorer";
import ChainEcosystem, { ECOSYSTEM_COVERAGE } from "@/components/chain/ChainEcosystem";
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
  const metrics = await getChainMetrics(chains.map((c: any) => c.slug));

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
              title="产业链分层"
              sub="按上游 / 中游 / 下游三层呈现环节与代表公司。环节之间的供应关系需要逐条核实，尚未建立，因此不绘制连线"
            />
            <Card className="p-0">
              <ChainFlowExplorer chains={chains} nodes={nodes as any} metrics={metrics} />
            </Card>
          </div>

          {/* 跨链关联图：关联关系来自静态图谱且只覆盖部分链条，信息完整度不足以当主视觉，
              因此放在次要位置并显式标注覆盖度，而不是让读者以为 25 条链都有关系网络。 */}
          <details className="group">
            <summary className="cursor-pointer list-none marker:content-[''] flex items-baseline gap-2 py-2">
              <span className="text-sm font-bold">跨链关联图</span>
              <span className="text-[11px] text-muted">
                展开查看 · 数据建设中，当前绘制 {ECOSYSTEM_COVERAGE.drawn} / {ECOSYSTEM_COVERAGE.total} 条链
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </summary>
            <div className="pt-2">
              <Card>
                <ChainEcosystem />
              </Card>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                连线来自静态图谱的人工标注，尚无来源与时点校验；节点可拖拽，点击进入对应产业链。
              </p>
            </div>
          </details>
        </section>
      )}

      {active === "chains" && (
        <ChainHost dbChains={chains as any} nodeCounts={nodeCounts} initialChain={chain} />
      )}
    </div>
  );
}