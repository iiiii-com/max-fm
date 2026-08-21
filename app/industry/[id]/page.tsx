import Link from "next/link";
import { notFound } from "next/navigation";
import { getChainBySlug, getChains, getChainNodes } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import ChainGraph from "@/components/charts/ChainGraph";
import { CHAIN_LEVEL_COLORS } from "@/components/charts/palette";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "产业链详情" };

const ROLE_ORDER: Record<string, number> = { 上游: 0, 中游: 1, 下游: 2 };
const ROLE_COLOR = CHAIN_LEVEL_COLORS;
const SENTIMENT: Record<string, string> = { high: "景气高位", medium: "景气中性", low: "景气低位" };

/** 每层解读：取各环节 description 首句，拼成有实质内容的段落 */
function roleSummary(nodes: any[], role: string): string {
  const list = nodes.filter((n: any) => n.level === role);
  if (!list.length) return "";
  const points = list.slice(0, 3).map((n: any) => {
    const d = (n.description || "").split("，")[0].split("。")[0].trim();
    return d && d.length > 4 ? `${n.name}：${d}` : `${n.name}：${(n.companies ? JSON.parse(n.companies ?? "[]") : []).slice(0, 2).join("、") || "关键环节"}`;
  });
  const more = list.length > 3 ? `。另有 ${list.length - 3} 个环节详见下方` : "";
  return points.join("；") + more;
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

  const realNodes = nodes.filter((n: any) => !String(n.name).startsWith("关联："));
  const companyCount = new Set(
    realNodes.flatMap((n: any) => JSON.parse(n.companies ?? "[]") as string[])
  ).size;
  const roleCount: Record<string, number> = { 上游: 0, 中游: 0, 下游: 0 };
  realNodes.forEach((n: any) => { roleCount[n.level ?? ""] = (roleCount[n.level ?? ""] ?? 0) + 1; });
  const chainFlow = ["上游", "中游", "下游"].map((r) => ({ role: r, count: roleCount[r] ?? 0 }));

  const overview = [
    { label: "环节总数", value: `${realNodes.length}`, note: `${roleCount["上游"] ?? 0} 上游 · ${roleCount["中游"] ?? 0} 中游 · ${roleCount["下游"] ?? 0} 下游` },
    { label: "代表公司", value: `${companyCount}`, note: "去重后覆盖 A 股与港股" },
    { label: "链级规模", value: chain.detail ? chain.detail.split("，")[0] : "—", note: chain.detail ?? "规模数据整理中" },
    { label: "景气状态", value: SENTIMENT[chain.sentiment] ?? "—", note: "由行业库存、价格与订单综合判断" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Link href="/industry" className="text-sm text-primary hover:underline">← 产业链分析</Link>
          <Badge tone={chain.name.includes("AI") || chain.name.includes("半导体") ? "amber" : "red"}>{chain.name}</Badge>
          <Badge tone="gray">{SENTIMENT[chain.sentiment] ?? "景气中性"}</Badge>
          <Link href={`/stock?q=${encodeURIComponent(chain.name)}`} className="text-sm text-primary hover:underline">板块行情 →</Link>
          <Link href="/invest" className="text-sm text-muted hover:text-primary">大盘资金流</Link>
          <span className="text-sm text-muted ml-auto">{nodes.length} 个环节 · 上下游解剖</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">{chain.name}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{chain.description}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {overview.map((o) => (
          <Card key={o.label} className="p-4">
            <p className="text-xs text-muted">{o.label}</p>
            <p className="font-bold text-lg mt-1 truncate">{o.value}</p>
            <p className="text-[11px] text-muted mt-0.5 truncate">{o.note}</p>
          </Card>
        ))}
      </section>

      <section className="card p-4">
        <p className="text-xs text-muted mb-2">传导路径：上游供给与成本 → 中游加工与性能 → 下游需求反馈</p>
        <div className="flex items-center gap-2 flex-wrap">
          {chainFlow.map((f, i) => (
            <span key={f.role} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: `${ROLE_COLOR[f.role]}1a`, color: ROLE_COLOR[f.role] }}>
                <span className="w-2 h-2 rounded-full" style={{ background: ROLE_COLOR[f.role] }} />
                {f.role} {f.count} 环节
              </span>
              {i < chainFlow.length - 1 && <span className="text-muted">→</span>}
            </span>
          ))}
        </div>
      </section>

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
              <p className="text-xs text-muted mb-3 leading-relaxed">{roleSummary(nodes, g.role)}</p>
              <div className="space-y-2">
                {g.nodes.map((n: any) => {
                  const companies = JSON.parse(n.companies ?? "[]") as string[];
                  return (
                    <details key={n.id} className="group border border-border rounded-lg px-3 py-2 open:bg-border/20 transition-colors">
                      <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
                        {n.name}
                        <span className="text-xs font-mono text-muted">{n.value ? `规模 ${n.value} 亿` : ""}</span>
                        <span className={`text-xs font-mono ${(n.growth ?? 0) >= 0 ? "up" : "down"}`}>
                          {n.growth != null ? `增速 ${n.growth >= 0 ? "+" : ""}${n.growth}%` : ""}
                        </span>
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