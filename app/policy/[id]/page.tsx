import Link from "next/link";
import { notFound } from "next/navigation";
import { getPolicyWithAnalysis, getPolicies } from "@/lib/data/queries";
import { Card, Badge, AIFlag } from "@/components/ui";
import Markdown from "@/components/markdown";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "政策详情" };

const SECTOR_HINTS: Array<{ label: string; slug: string; words: string[] }> = [
  { label: "新能源汽车", slug: "nev", words: ["新能源", "汽车", "购置税", "充电"] },
  { label: "半导体", slug: "semiconductor", words: ["芯片", "半导体", "集成电路", "晶圆"] },
  { label: "人工智能", slug: "ai", words: ["人工智能", "AI", "算力", "大模型"] },
  { label: "房地产", slug: "realestate", words: ["地产", "住房", "房贷", "楼市", "商品房"] },
  { label: "医药生物", slug: "pharma", words: ["医药", "医保", "集采", "创新药", "医疗"] },
  { label: "光伏", slug: "solar", words: ["光伏", "装机", "组件"] },
  { label: "机器人", slug: "robot", words: ["机器人", "人形"] },
  { label: "银行保险", slug: "finance", words: ["银行", "保险", "息差", "降准", "资本充足"] },
  { label: "消费", slug: "baijiu", words: ["消费", "白酒", "以旧换新", "补贴", "内需"] },
  { label: "农业食品", slug: "agrifood", words: ["农业", "粮食", "种业", "食品"] },
  { label: "军工", slug: "defense", words: ["军工", "国防", "装备"] },
  { label: "低空经济", slug: "lowaltitude", words: ["低空", "eVTOL", "无人机"] },
];

/** 政策类别 → 影响方向（股市/楼市/消费/产业）映射（研究框架设定，供投资者参考） */
const IMPACT_MAP: Record<string, string[]> = {
  "货币政策": ["股市流动性", "利率敏感资产", "汇率"],
  "财政": ["基建投资", "消费补贴", "企业税负"],
  "财税": ["企业盈利", "消费", "产业投资"],
  "房地产": ["楼市成交", "地产链（建材/家电）", "银行信贷"],
  "产业政策": ["对应产业景气", "产业链上下游"],
  "资本市场": ["券商", "直接融资", "市场情绪"],
  "消费促进": ["消费板块", "零售/餐饮", "可选消费"],
  "对外开放": ["出口链", "外资流入", "跨境贸易"],
  "改革": ["对应改革领域", "市场预期"],
  "民生": ["医疗/教育/社保", "消费"],
};

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await bootstrap();
  const [row, others] = await Promise.all([getPolicyWithAnalysis(id), getPolicies()]);
  if (!row) notFound();
  const { policy: p, analysis } = row;
  const corpus = `${p.title} ${p.summary} ${p.content} ${analysis?.popular ?? ""} ${analysis?.professional ?? ""}`;
  const hitSectors = SECTOR_HINTS.filter((s) => s.words.some((w) => corpus.includes(w)));
  const impacts = IMPACT_MAP[p.category ?? ""] ?? [];

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge>{p.category || "政策"}</Badge>
          {p.source && <Badge tone="green">{p.source}</Badge>}
          <span className="text-sm text-muted">{fmtDate(p.publishDate)}</span>
          <span className="text-sm text-muted ml-auto">发布机构：{p.department || "—"}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">{p.title}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{p.summary}</p>
        {p.sourceUrl && (
          <p className="mt-2 text-sm">
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              查看官方原文 ↗<span className="text-muted text-xs">（{p.sourceUrl.replace(/^https?:\/\//, "")}）</span>
            </a>
          </p>
        )}
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">普通人怎么看</h2>
            <AIFlag />
          </div>
          {analysis?.popular ? (
            <div className="prose-sm"><Markdown content={analysis.popular} /></div>
          ) : <p className="text-sm text-muted">分析生成中</p>}
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">专业解读</h2>
            <AIFlag />
          </div>
          {analysis?.professional ? (
            <div className="prose-sm"><Markdown content={analysis.professional} /></div>
          ) : <p className="text-sm text-muted">分析生成中</p>}
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">趋势与风险</h2>
            <AIFlag />
          </div>
          {analysis?.detail ? (
            <div className="prose-sm"><Markdown content={analysis.detail} /></div>
          ) : <p className="text-sm text-muted">分析生成中</p>}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">关联数据</h2>
          </div>
          {analysis?.dataLinks ? (
            <>
              <p className="text-sm text-muted mb-2">政策解读涉及的关联指标：</p>
              <div className="flex flex-wrap gap-2">
                {(JSON.parse(analysis.dataLinks) as string[]).map((d: any) => (
                  <Badge key={d} tone="gray">{d}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted mt-4">数据由 Max 数据管道自动关联，分析由 AI 生成。</p>
            </>
          ) : <p className="text-sm text-muted">数据关联生成中</p>}
          {hitSectors.length > 0 && (
            <>
              <p className="text-sm text-muted mb-2 mt-4">政策可能受益的产业链：</p>
              <div className="flex flex-wrap gap-2">
                {hitSectors.map((s) => (
                  <Link key={s.slug} href={`/industry/${s.slug}`} className="hover:opacity-70 transition-opacity">
                    <Badge tone="red">{s.label}</Badge>
                  </Link>
                ))}
              </div>
            </>
          )}
          {impacts.length > 0 && (
            <div className="mt-4 rounded-lg border border-border/60 px-3 py-2.5">
              <p className="text-xs text-muted mb-1.5">潜在影响方向（研究框架设定，供参考）：</p>
              <div className="flex flex-wrap gap-1.5">
                {impacts.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20">{t}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </section>

      <section>
        <Card>
          <h2 className="font-bold mb-3">政策原文要点</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted leading-relaxed">{p.content}</pre>
        </Card>
      </section>

      <section>
        <h2 className="font-bold mb-3">其他政策</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {others.filter((o: any) => o.id !== p.id).slice(0, 6).map((o: any) => (
            <Link key={o.id} href={`/policy/${o.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <h3 className="font-medium text-sm line-clamp-2 leading-snug">{o.title}</h3>
                <p className="text-xs text-muted mt-2">{fmtDate(o.publishDate)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}