import Link from "next/link";
import BoardTabs from "@/components/BoardTabs";
import { getChains, getChainNodes, getChainMetrics } from "@/lib/data/queries";
import { Card, SectionTitle, Badge } from "@/components/ui";
import ChainFlowExplorer from "@/components/chain/ChainFlowExplorer";
import ChainEcosystem, { ECOSYSTEM_COVERAGE } from "@/components/chain/ChainEcosystem";
import ChainHost from "@/components/chain/ChainHost";
import ChainMatrix from "@/components/chain/ChainMatrix";
import ChainGraphInsights from "@/components/chain/ChainGraphInsights";
import { bootstrap } from "@/lib/db";
import { STATIC_CHAINS } from "@/lib/data/chains";
import { buildChainGraph } from "@/lib/data/chainGraph";

export const dynamic = "force-dynamic";
export const metadata = { title: "产业链分析" };

/**
 * 产业地图的多轴入口。
 *
 * 原先只有「按链」一个轴：全景图 + 链列表。但站内数据其实支持多个切入方向，
 * 而 38 条链 / 160 条有向标注的关系数据在力导向图里被压到只剩 23 个节点
 * 且丢掉了方向 —— 这是最大的闲置资产。
 *
 * 现在四个轴对应四种问题：
 *   全景图    —— 按环节层级看供给结构（这条链上中下游各有什么）
 *   关系网络  —— 跨链：一次看全所有标注关系，保留方向（矩阵 + 枢纽/单向/双向结论）
 *   按景气    —— 高/中/低/分化分组，找当前主线
 *   产业链列表 —— 按链逐条深入（含环节明细与代表公司）
 */

const TABS = [
  { key: "overview", label: "全景图" },
  { key: "network", label: "关系网络" },
  { key: "prosperity", label: "按景气" },
  { key: "chains", label: "产业链列表" },
];

const PROSPERITY_ORDER = ["高景气", "中景气", "分化", "低景气"] as const;
const PROSPERITY_TONE: Record<string, "red" | "amber" | "gray" | "blue"> = {
  高景气: "red",
  中景气: "amber",
  分化: "blue",
  低景气: "gray",
};
const PROSPERITY_NOTE: Record<string, string> = {
  高景气: "需求与产能利用率同步向上，站内定性判断",
  中景气: "供需大体平衡，缺乏明确的方向性驱动",
  分化: "链内环节冷热不均，需分环节看而不是看整条链",
  低景气: "需求或价格承压，注意产能出清进度",
};

export default async function IndustryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; chain?: string }>;
}) {
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

  // 图统计用静态图谱（38 条全量），而不是 DB 里的子集 —— 关系数据在 chains.ts 里
  const graph = buildChainGraph(STATIC_CHAINS);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">产业地图</h1>
        <p className="text-sm text-muted mt-1">
          {graph.nodes.length} 条产业链 · {graph.undirectedCount} 条跨链关联标注 ·
          按环节层级、跨链关系、景气状态三个方向切入，逐条深入到环节与代表公司
        </p>
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

          {/* 向外发散的入口：从"看结构"接到"看当下"——行情、资金、政策、宏观 */}
          <div>
            <SectionTitle
              title="从结构接到当下"
              sub="产业地图给的是供给结构，下面这几个入口给的是它此刻的状态"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: "/sector", label: "板块行情与资金", note: "东财行业板块的涨跌与主力净流入" },
                { href: "/policy", label: "政策解读", note: "政策原文 + 三层视角，含传导路径" },
                { href: "/macro", label: "宏观仪表盘", note: "GDP / CPI / PMI / M2 与宏观温度" },
                { href: "/gmrds/toolkit", label: "经典工具箱", note: "回撤实验室、买卖点扫描、估值带" },
              ].map((x) => (
                <Link key={x.href} href={x.href} className="hover:opacity-90 transition-opacity">
                  <Card className="p-4 h-full">
                    <p className="text-sm font-semibold">{x.label}</p>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">{x.note}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {active === "network" && (
        <section className="space-y-6">
          <div>
            <SectionTitle
              title="跨链关系矩阵"
              sub={`${graph.nodes.length} × ${graph.nodes.length} 全量关系，纵轴指向横轴。相比力导向图：一次看全 ${graph.undirectedCount} 条关联，且保留方向（双向 / 单向）`}
            />
            <Card className="p-0">
              <ChainMatrix />
            </Card>
          </div>

          <ChainGraphInsights />

          <div>
            <SectionTitle
              title="力导向关系图（子集）"
              sub={`关系矩阵看得全，力导向图看得清局部。此处只画有实际跨链供需的 ${ECOSYSTEM_COVERAGE.drawn} / ${ECOSYSTEM_COVERAGE.total} 条链 —— 超过 30 个节点会挤成毛线团`}
            />
            <Card>
              <ChainEcosystem />
            </Card>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              连线来自静态图谱的人工标注，尚无来源与时点校验；节点可拖拽，点击进入对应产业链。
              要一次看全所有关系请用上方的关系矩阵。
            </p>
          </div>
        </section>
      )}

      {active === "prosperity" && (
        <section className="space-y-6">
          <SectionTitle
            title="按景气状态分组"
            sub="景气是站内对链级的定性判断，非测算值。分组用来找当前主线，不代表投资建议"
          />
          {PROSPERITY_ORDER.map((p) => {
            const items = STATIC_CHAINS.filter((c) => c.prosperity === p);
            if (!items.length) return null;
            return (
              <div key={p}>
                <div className="flex items-baseline gap-2 mb-2">
                  <Badge tone={PROSPERITY_TONE[p]}>{p}</Badge>
                  <span className="text-[11px] text-muted">{items.length} 条</span>
                  <span className="text-[11px] text-muted">· {PROSPERITY_NOTE[p]}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((c) => (
                    <Link key={c.id} href={`/industry/${c.id}`} className="hover:opacity-90 transition-opacity">
                      <Card className="p-4 h-full">
                        <p className="text-sm font-semibold">{c.name}</p>
                        {c.marketSize && <p className="text-[11px] text-muted mt-1">{c.marketSize}</p>}
                        {c.outlook && (
                          <p className="text-[11px] text-muted mt-1.5 leading-relaxed line-clamp-2">{c.outlook}</p>
                        )}
                        <p className="text-[10px] text-muted mt-2">
                          {c.segments.length} 段环节 ·{" "}
                          {c.segments.reduce((s, x) => s + x.companies.length, 0)} 家代表公司 ·{" "}
                          {(c.relates ?? []).length} 条关联
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {active === "chains" && (
        <ChainHost dbChains={chains as any} nodeCounts={nodeCounts} initialChain={chain} />
      )}
    </div>
  );
}