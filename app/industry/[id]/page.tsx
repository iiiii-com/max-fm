import Link from "next/link";
import { notFound } from "next/navigation";
import { getChainBySlug, getChains, getChainNodes } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import ChainSwimlane from "@/components/chain/ChainSwimlane";
import ChainQuotes from "@/components/industry/ChainQuotes";
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
  const [nodesRaw, chains] = await Promise.all([getChainNodes(chain.id), getChains()]);

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
    { label: "链级说明", value: chain.detail ? "已收录" : "—", note: chain.detail ?? "该链规模数据待补充来源" },
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
          sub="按所属层级自上而下排列，点击环节展开作用说明与相关标的行情。环节的规模与增速不展示，因为没有可核验的公开口径"
        />
        <Card className="p-0">
          <ChainSwimlane
            bands={groups}
            detail={(n) => {
              const companies = safeJsonArray<string>(n.companies);
              return (
                <div className="min-w-0">
                  <p className="text-[11px] leading-relaxed text-muted">
                    {n.description || "该环节暂无文字说明。"}
                  </p>
                  {companies.length ? (
                    <div className="mt-2">
                      <ChainQuotes companies={companies} />
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
        </Card>
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