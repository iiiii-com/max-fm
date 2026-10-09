import Link from "next/link";
import { notFound } from "next/navigation";
import { getChainBySlug, getChains, getChainNodes, getChainMetrics, getPoliciesForChain } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import ChainSwimlane from "@/components/chain/ChainSwimlane";
import ChainInsightPanel from "@/components/chain/ChainInsightPanel";
import ChainPositionPanel from "@/components/chain/ChainPositionPanel";
import ChainCityProsPanel from "@/components/chain/ChainCityProsPanel";
import ChainDeepDivePanel from "@/components/chain/ChainDeepDivePanel";
import ChainIndexPanel from "@/components/chain/ChainIndexPanel";
import ChainNodeDetailPanel from "@/components/chain/ChainNodeDetailPanel";
import { LEVELS, levelOrder, realNodes } from "@/lib/data/chainLevels";
import { safeJsonArray } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "产业链详情" };

const SENTIMENT: Record<string, string> = { high: "景气高位", medium: "景气中性", low: "景气低位" };

export default async function ChainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await bootstrap();
  const chain = await getChainBySlug(id);
  if (!chain) notFound();
  const [nodesRaw, chains, relatedPolicies] = await Promise.all([
    getChainNodes(chain.id),
    getChains(),
    getPoliciesForChain(chain.slug, 6),
  ]);
  // 只取通过「单位 + 时点 + 来源 + 口径」四件套校验的指标，其余不进 UI
  const metrics = await getChainMetrics([chain.slug]);

  // 单一计数口径：全页所有"环节数"都从 nodes 一处派生。
  // 旧实现概览卡用 realNodes.length（6）、头部用 nodes.length（9），
  // 同屏出现两个互相矛盾的数字，且无处解释差异。
  const nodes = nodesRaw as any[];
  const real = realNodes(nodes);
  const linkCount = nodes.length - real.length;

  const sorted = [...real].sort((a, b) => levelOrder(a.level) - levelOrder(b.level));
  const groups = LEVELS.map((role) => ({
    role,
    nodes: sorted.filter((n) => n.level === role),
  }));

  const companyCount = new Set(real.flatMap((n) => safeJsonArray<string>(n.companies))).size;
  const roleCount: Record<string, number> = { 上游: 0, 中游: 0, 下游: 0 };
  real.forEach((n) => { roleCount[n.level ?? ""] = (roleCount[n.level ?? ""] ?? 0) + 1; });
  const chainFlow = LEVELS.map((r) => ({ role: r, count: roleCount[r] ?? 0 }));

  const overview = [
    { label: "环节总数", value: `${real.length}`, note: LEVELS.map((r) => `${roleCount[r] ?? 0} ${r}`).join(" · ") },
    { label: "代表公司", value: `${companyCount}`, note: "去重后覆盖 A 股与港股" },
    { label: "已核验指标", value: `${metrics.length}`, note: metrics.length ? "每项均含单位/时点/来源/口径" : "暂无可核验的公开口径" },
    { label: "景气状态", value: SENTIMENT[chain.sentiment] ?? "—", note: "链级定性判断，非测算值" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Link href="/industry" className="text-sm text-primary hover:underline">← 产业链分析</Link>
          <Badge tone={chain.name.includes("AI") || chain.name.includes("半导体") ? "amber" : "red"}>{chain.name}</Badge>
          <Badge tone="gray">{SENTIMENT[chain.sentiment] ?? "景气中性"}</Badge>
          <Link href={`/stock?q=${encodeURIComponent(chain.name)}`} className="text-sm text-primary hover:underline">板块行情 →</Link>
          <Link href="/invest" className="text-sm text-muted hover:text-primary">大盘资金流</Link>
          <span className="text-sm text-muted ml-auto">
            {real.length} 个环节 · {companyCount} 家公司
            {linkCount > 0 ? ` · 另有 ${linkCount} 条跨链关联` : ""}
          </span>
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
        <p className="text-xs text-muted mb-2">供给方向</p>
        {/* 层级改用排版 + 发丝线表意，不再用色块。
            此处曾用 CHAIN_LEVEL_COLORS 给三档上色，而那份色板里「中游」被映射成涨跌红 ——
            一个结构字段占用了语义色通道，读者会误以为它在表达涨跌。 */}
        <ol className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          {chainFlow.map((f, i) => (
            <li key={f.role} className="flex items-center gap-3">
              <span className="flex items-baseline gap-1.5">
                <span className="text-sm font-medium">{f.role}</span>
                <span className="text-[11px] text-muted tabular-nums">{f.count}</span>
              </span>
              {i < chainFlow.length - 1 && <span className="text-muted" aria-hidden>→</span>}
            </li>
          ))}
          <li className="flex-1 min-w-4 text-right text-[11px] text-muted">
            上游决定成本与产能，中游完成加工与性能，下游形成需求反馈
          </li>
        </ol>
      </section>

      <section>
        <SectionTitle
          title="上中下游分层"
          sub="按所属层级自上而下排列。点击环节展开结构化维度（做什么、赚什么钱、为什么进不来、看什么指标、风险）与相关标的行情。环节的规模与增速不展示，因为没有可核验的公开口径"
        />
        <Card className="p-0">
          <ChainSwimlane
            bands={groups}
            metrics={metrics}
            detail={(n) => (
              <ChainNodeDetailPanel
                slug={chain.slug}
                nodeName={n.name}
                companies={n.companies}
                description={n.description}
              />
            )}
          />
        </Card>
      </section>

      <section>
        <SectionTitle
          title="链指数（真实收盘价等权合成）"
          sub="用链上代表公司的真实日线等权合成，基点 1000，只使用全体成员的共同交易日。口径、覆盖率与被剔除成员全部印在面板里，可逐步复算 —— 这是全页唯一一个能用来做相对强弱与回撤比较的量化序列"
        />
        <ChainIndexPanel slug={chain.slug} />
        <p className="mt-2 text-[11px] text-muted leading-relaxed">
          想看多条链在同一窗口的相对强弱与相关性？用
          <Link href="/pro" className="mx-1 text-primary hover:underline">专业版工作台</Link>
          的「多链对比」。
        </p>
      </section>

      <ChainInsightPanel slug={chain.slug} />

      {/* 政策面：反向关联用与政策页同一份关键词表，命中词一并列出以便核对 */}
      <section>
        <SectionTitle
          title="涉及这条链的政策"
          sub="按政策标题与原文的关键词匹配得出，并列出命中的具体词以便核对。关键词命中只用于定位原文涉及的领域，不代表该政策利好这个行业"
        />
        {relatedPolicies.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {relatedPolicies.map((p) => (
              <Link key={p.id} href={`/policy/${p.id}`} className="hover:opacity-90 transition-opacity">
                <Card className="p-3 h-full">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium leading-snug line-clamp-2">{p.title}</span>
                    <span className="text-[10px] text-muted shrink-0">{p.publishDate ?? ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {p.category && <Badge tone="gray">{p.category}</Badge>}
                    {p.hitWords.map((w) => (
                      <span key={w} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">
                        {w}
                      </span>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <p className="text-xs text-muted leading-relaxed">
              站内暂无涉及这条链的政策命中。关键词表只覆盖指向具体产业的强特征词，
              命中不到不等于没有相关政策 —— 也可能是措辞不在表内，这是关键词法的已知局限。
            </p>
          </Card>
        )}
      </section>

      <ChainPositionPanel slug={chain.slug} />

      <ChainCityProsPanel slug={chain.slug} />

      <ChainDeepDivePanel slug={chain.slug} />

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