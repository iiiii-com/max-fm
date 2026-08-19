import Link from "next/link";
import { notFound } from "next/navigation";
import { getChainBySlug, getChains, getChainNodes } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import ChainGraph from "@/components/charts/ChainGraph";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "产业链详情" };

const ROLE_ORDER: Record<string, number> = { 上游: 0, 中游: 1, 下游: 2 };
const ROLE_COLOR: Record<string, string> = { 上游: "#0891b2", 中游: "#c8102e", 下游: "#4f46e5" };
const SENTIMENT: Record<string, string> = { high: "景气高位", medium: "景气中性", low: "景气低位" };

function roleSummary(nodes: any[], role: string, chainName: string): string {
  const list = nodes.filter((n: any) => n.level === role);
  if (!list.length) return "";
  const first = list[0];
  const names = list.slice(0, 3).map((n: any) => n.name).join("、");
  const tail = list.length > 3 ? ` 等 ${list.length} 个环节` : "";
  return `${chainName}的${role}环节包含${names}${tail}，是整条链的${role === "上游" ? "成本与供给起点，其价格波动沿链向下游传导" : role === "中游" ? "价值加工核心，决定产品性能与毛利率" : "需求终端，直接面对消费者并向上游反馈订单"}。`;
}

export default async function ChainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await bootstrap();
  const chain = await getChainBySlug(id);
  if (!chain) notFound();
  const [nodes, chains] = await Promise.all([getChainNodes(chain.id), getChains()]);

  const sorted = [...nodes].sort(
    (a: any, b: any) => (ROLE_ORDER[a.level ?? ""] ?? 3) - (ROLE_ORDER[b.level ?? ""] ?? 3)
  );
  const links: Array<{ source: string; target: string }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    links.push({ source: sorted[i].name, target: sorted[i + 1].name });
  }

  const groups = ["上游", "中游", "下游"].map((role) => ({
    role,
    nodes: sorted.filter((n: any) => n.level === role),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Link href="/industry" className="text-sm text-primary hover:underline">← 产业链分析</Link>
          <Badge tone={chain.name.includes("AI") || chain.name.includes("半导体") ? "amber" : "red"}>{chain.name}</Badge>
          <Badge tone="gray">{SENTIMENT[chain.sentiment] ?? "景气中性"}</Badge>
          <span className="text-sm text-muted ml-auto">{nodes.length} 个环节 · 上下游解剖</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">{chain.name}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{chain.description}</p>
      </header>

      <section>
        <SectionTitle title="上下游结构图" sub="力导向图：节点为环节，连线为供需传导关系" />
        <Card>
          <ChainGraph nodes={nodes} links={links} />
        </Card>
      </section>

      <section>
        <SectionTitle title="上中下游解剖" sub="点击环节查看代表公司与作用" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Card key={g.role} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ background: ROLE_COLOR[g.role] }} />
                <h3 className="font-bold">{g.role}</h3>
                <span className="text-xs text-muted ml-auto">{g.nodes.length} 个环节</span>
              </div>
              <p className="text-xs text-muted mb-3 leading-relaxed">{roleSummary(nodes, g.role, chain.name)}</p>
              <div className="space-y-2">
                {g.nodes.map((n: any) => {
                  const companies = JSON.parse(n.companies ?? "[]") as string[];
                  return (
                    <details key={n.id} className="group border border-border rounded-lg px-3 py-2 open:bg-border/20 transition-colors">
                      <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
                        {n.name}
                        <span className="text-xs text-muted font-normal ml-auto">{companies.length ? `${companies.length} 家公司` : ""}</span>
                      </summary>
                      <div className="mt-2">
                        <p className="text-xs text-muted leading-relaxed">{n.description || "环节说明整理中。"}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {companies.map((c) => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded bg-border/40">{c}</span>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="关联产业链" sub="跨链供需联动" />
        <div className="flex flex-wrap gap-2">
          {chains.filter((c: any) => c.id !== chain.id).slice(0, 6).map((c: any) => (
            <Link key={c.id} href={`/industry/${c.slug}`} className="hover:opacity-70 transition-opacity">
              <Badge tone="gray">{c.name}</Badge>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}