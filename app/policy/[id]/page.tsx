import Link from "next/link";
import { notFound } from "next/navigation";
import { getPolicyWithAnalysis, getPolicies } from "@/lib/data/queries";
import { Card, Badge } from "@/components/ui";
import { PolicyAnalysisPanels } from "@/components/policy-analysis-panels";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getPolicyWithAnalysis(id).catch(() => null);
  const p = row?.policy as any;
  return {
    title: p ? p.title : "政策详情",
    description: p ? `${p.department || ""} ${p.publishDate || ""} ${p.summary || p.title}`.trim().slice(0, 120) : undefined,
  };
}

/**
 * 产业链关键词命中表。
 * 旧表把「银行」「消费」「汽车」这类泛词也算作命中，导致《审计法实施条例》
 * （只因出现「银行」「消费」字样）被标注为「受益产业链：银行保险、消费」——
 * 实际上审计条例只会收紧审计监督。规则：只用**指向具体产业**的强特征词，
 * 并且在 UI 上明确标注这是「关键词命中」，不宣称政策利好该行业。
 */
const SECTOR_HINTS: Array<{ label: string; slug: string; words: string[] }> = [
  { label: "新能源汽车", slug: "nev", words: ["新能源汽车", "动力电池", "充电桩", "购置税"] },
  { label: "半导体", slug: "semiconductor", words: ["集成电路", "晶圆", "半导体", "芯片"] },
  { label: "人工智能", slug: "ai", words: ["人工智能", "大模型", "算力"] },
  { label: "房地产", slug: "realestate", words: ["商品房", "楼市", "住房公积金", "房地产", "房贷"] },
  { label: "医药生物", slug: "pharma", words: ["集中采购", "医保", "创新药", "医疗器械"] },
  { label: "光伏", slug: "solar", words: ["光伏", "风电", "可再生能源装机"] },
  { label: "机器人", slug: "robot", words: ["人形机器人", "机器人产业"] },
  { label: "银行保险", slug: "finance", words: ["资本充足率", "存款准备金", "偿付能力", "不良贷款率"] },
  { label: "消费", slug: "baijiu", words: ["以旧换新", "消费券", "家电下乡", "促消费"] },
  { label: "农业食品", slug: "agrifood", words: ["粮食", "种业", "耕地", "农产品"] },
  { label: "军工", slug: "defense", words: ["国防科技", "军民融合", "装备采购"] },
  { label: "低空经济", slug: "lowaltitude", words: ["低空经济", "通用航空", "无人机"] },
];

/** 政策类别 → 影响方向（研究框架设定，供投资者参考） */
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
  const a = analysis as any;
  // 命中判定只用标题 + 摘要 + 原文，避免把「解读文本」里的泛词也算进来
  const corpus = `${p.title} ${p.summary ?? ""} ${p.content ?? ""}`;
  const sectorHits = SECTOR_HINTS.filter((s) => s.words.some((w) => corpus.includes(w)));
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

      <PolicyAnalysisPanels
        id={id}
        popular={a?.popular ?? null}
        professional={a?.professional ?? null}
        detail={a?.detail ?? null}
        dataLinks={a?.dataLinks ?? null}
        sectorHits={sectorHits}
      />

      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <h2 className="font-bold mb-3">政策原文</h2>
            <pre className="whitespace-pre-wrap font-sans text-sm text-muted leading-relaxed max-h-[520px] overflow-y-auto">{p.content}</pre>
          </Card>
          <div className="lg:col-span-2 space-y-4">
            {sectorHits.length > 0 && (
              <Card>
                <h2 className="font-bold mb-2">关键词命中的相关产业链</h2>
                <div className="flex flex-wrap gap-2 mb-2">
                  {sectorHits.map((s) => (
                    <Link key={s.slug} href={`/industry/${s.slug}`} className="hover:opacity-70 transition-opacity">
                      <Badge tone="gray">{s.label}</Badge>
                    </Link>
                  ))}
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  以上仅为<b>关键词匹配</b>结果，用于帮助定位原文涉及的领域，
                  <b>不代表该政策会利好这些行业</b>，请以 AI 解读与原文为准。
                </p>
              </Card>
            )}
            {impacts.length > 0 && (
              <Card>
                <h2 className="font-bold mb-2">潜在影响方向</h2>
                <div className="flex flex-wrap gap-1.5">
                  {impacts.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20">{t}</span>
                  ))}
                </div>
                <p className="text-xs text-muted mt-2">按政策类别的研究框架映射得出，属定性参考，非量化结论。</p>
              </Card>
            )}
          </div>
        </div>
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