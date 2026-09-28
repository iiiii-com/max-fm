import Link from "next/link";
import { getPolicies, getPolicyAnalysisIds } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "政策解读" };

/**
 * 分类顺序：优先展示研究价值最高的宏观类，其余按条数补在后面，最后是「部委公告」这类
 * 无法归入投资类目的通用桶。
 * 分类列表**从数据里推导**，不再写死 —— 此前写死的 10 个分类漏掉了库里实际存在的
 * 金融监管 / 科技自立 / 绿色低碳 / 区域政策 / 就业，那些政策等于无法被检索到。
 */
const PREFERRED_CATS = [
  "货币政策", "财政", "财税", "资本市场", "房地产", "消费促进",
  "产业政策", "对外开放", "改革", "民生",
];

const ORG_BADGE: Record<string, string> = {
  "中国政府网": "中国政府网", "财政部": "财政部", "国家发展改革委": "发改委", "中国人民银行": "央行",
};

const PAGE_SIZE = 20;

/** 发布时间可能是 YYYY-MM-DD，也可能只有 YYYY-MM（部委部分条目缺日） */
function dateMs(publishDate: string | null | undefined): number {
  if (!publishDate) return 0;
  const t = Date.parse(/^\d{4}-\d{2}$/.test(publishDate) ? `${publishDate}-01` : publishDate);
  return Number.isFinite(t) ? t : 0;
}

export default async function PolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; page?: string }>;
}) {
  const { cat, page } = await searchParams;
  await bootstrap();
  const [all, analyzedIds] = await Promise.all([getPolicies(), getPolicyAnalysisIds()]);

  // 最近同步时间 = 最新入库时间（updatedAt 为毫秒时间戳）
  const lastSync = all.length
    ? Math.max(...all.map((p: any) => Number(p.updatedAt ?? 0) || dateMs(p.publishDate)))
    : null;

  const now = Date.now();
  const isNew = (p: any) => {
    const d = dateMs(p.publishDate);
    return !!d && now - d < 7 * 24 * 3600 * 1000;
  };

  // 分类清单从数据推导：优先类在前，其余按条数降序，通用桶（部委公告）垫底
  const counts = new Map<string, number>();
  for (const p of all as any[]) {
    const c = p.category || "未分类";
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const generic = new Set(["部委公告", "未分类"]);
  const rest = [...counts.entries()]
    .filter(([c]) => !PREFERRED_CATS.includes(c) && !generic.has(c))
    .sort((a, b) => b[1] - a[1]);
  const CAT_ORDER = [
    "全部",
    ...PREFERRED_CATS.filter((c) => counts.has(c)),
    ...rest.map(([c]) => c),
    ...[...counts.keys()].filter((c) => generic.has(c)),
  ];

  const activeCat = cat && CAT_ORDER.includes(cat) ? cat : "全部";
  const policies = activeCat === "全部" ? all : all.filter((p: any) => p.category === activeCat);

  // 每个分类的条数 + 最新日期，直接暴露在筛选条上：
  // 此前「财政」等分类只有 1–3 条且最新日期可差 2 年，界面上完全看不出来，
  // 用户点进去才发现是陈年文件。
  const catMeta = CAT_ORDER.map((c) => {
    const rows = c === "全部" ? all : all.filter((p: any) => p.category === c);
    const newest = rows.reduce((acc: number, p: any) => Math.max(acc, dateMs(p.publishDate)), 0);
    return { cat: c, count: rows.length, newest };
  });

  // 分页：旧实现一次性渲染全部 143 条，页面高 25,559px（手机 30,177px），
  // 且完全没有分页或「加载更多」。
  const totalPages = Math.max(1, Math.ceil(policies.length / PAGE_SIZE));
  const curPage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const slice = policies.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const href = (c: string, pg: number) =>
    `/policy?${new URLSearchParams({ ...(c === "全部" ? {} : { cat: c }), page: String(pg) }).toString()}`;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">政策解读</h1>
        <p className="text-sm text-muted mt-1">
          政策原文 + AI 解读（普通人视角 · 专业视角 · 趋势与风险）。未生成解读的政策会明确标注，不使用通用模板顶替。
        </p>
        <p className="text-[11px] text-muted/80 mt-1.5 flex items-center gap-2 flex-wrap">
          <span>最近入库：{lastSync ? fmtDateTime(lastSync) : "—"}</span>
          <span className="text-muted/60">共 {all.length} 条 · 7 天内发布标「NEW」</span>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {catMeta.map(({ cat: c, count, newest }) => (
          <Link
            key={c}
            href={href(c, 1)}
            aria-current={activeCat === c ? "page" : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              activeCat === c ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
            }`}
            title={c === "全部" ? undefined : `该分类最新发布日期：${newest ? fmtDate(new Date(newest).toISOString()) : "无"}`}
          >
            {c}
            <span className={`ml-1 text-[11px] ${activeCat === c ? "opacity-80" : "text-muted"}`}>
              {count}
              {newest ? ` · ${new Date(newest).toISOString().slice(2, 7).replace("-", "/")}` : ""}
            </span>
          </Link>
        ))}
      </div>

      <section>
        <SectionTitle
          title={`政策库（${activeCat}）`}
          sub={`按发布时间倒序，共 ${policies.length} 条，第 ${curPage}/${totalPages} 页`}
        />
        <div className="grid grid-cols-1 gap-3">
          {slice.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted">该分类下暂无政策</Card>
          )}
          {slice.map((p: any) => {
            const hasAnalysis = analyzedIds.has(p.id);
            return (
              <Card key={p.id} className="hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge>{p.category || "未分类"}</Badge>
                      {p.source && <Badge tone="green">{ORG_BADGE[p.source] ?? p.source}</Badge>}
                      <span className="text-xs text-muted">{fmtDate(p.publishDate)}</span>
                      {isNew(p) && <Badge tone="red">NEW</Badge>}
                      <span className="text-xs text-muted ml-auto">{p.department}</span>
                    </div>
                    {/* 标题是真链接 */}
                    <Link href={`/policy/${p.id}`} className="block">
                      <h3 className="font-bold text-base leading-snug hover:text-primary transition-colors">{p.title}</h3>
                    </Link>
                    <p className="text-sm text-muted mt-1.5 line-clamp-2">{p.summary}</p>
                    <div className="flex gap-2 mt-3 items-center flex-wrap">
                      {hasAnalysis ? (
                        <>
                          <Badge tone="amber">AI 解读 · 普通人视角</Badge>
                          <Badge tone="green">AI 解读 · 专业视角</Badge>
                        </>
                      ) : (
                        <Badge tone="gray">未生成 AI 解读</Badge>
                      )}
                    </div>
                  </div>
                  {/* 官方原文是真正的站外链接：旧实现把它做成卡片内的 <span>，
                      带「↗」外链箭头却只跳到站内详情页 */}
                  {p.sourceUrl && (
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-primary hover:underline whitespace-nowrap"
                      aria-label={`在官方站点打开《${p.title}》`}
                    >
                      官方原文 ↗
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-6 flex-wrap" aria-label="分页">
            {curPage > 1 && (
              <Link href={href(activeCat, curPage - 1)} className="px-3 py-1.5 rounded-md border border-border text-sm hover:border-primary/50">
                上一页
              </Link>
            )}
            <span className="text-xs text-muted px-2">
              第 {curPage} / {totalPages} 页
            </span>
            {curPage < totalPages && (
              <Link href={href(activeCat, curPage + 1)} className="px-3 py-1.5 rounded-md border border-border text-sm hover:border-primary/50">
                下一页
              </Link>
            )}
            {curPage < totalPages && (
              <Link href={href(activeCat, totalPages)} className="px-3 py-1.5 rounded-md border border-border text-sm hover:border-primary/50">
                末页
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}