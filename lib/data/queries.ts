import { db, parseJson } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq, desc, asc, and, like, inArray } from "drizzle-orm";
import { validMetrics } from "@/lib/data/chainMetrics";
import { buildChainIndex } from "@/lib/data/chainIndex";

export const CATEGORY_COLORS: Record<string, string> = {
  物价: "#dc2626", 景气: "#ea580c", 货币: "#2563eb", 外贸: "#0d9488",
  就业: "#7c3aed", 生产: "#ca8a04", 消费: "#e11d48", 投资: "#0891b2", 总量: "#4f46e5",
};

export async function getIndicators() {
  return db.select().from(s.economicIndicators).orderBy(asc(s.economicIndicators.date));
}

export async function getLatestIndicator(name: string) {
  const rows = await db
    .select()
    .from(s.economicIndicators)
    .where(eq(s.economicIndicators.name, name))
    .orderBy(desc(s.economicIndicators.date))
    .limit(1);
  return rows[0] ?? null;
}

export async function getIndicatorSeries(type: string, limit = 120) {
  const rows = await db
    .select()
    .from(s.economicIndicators)
    .where(eq(s.economicIndicators.type, type))
    .orderBy(asc(s.economicIndicators.date))
    .limit(limit);
  return rows;
}

export async function getPolicies() {
  return db.select().from(s.policies).orderBy(desc(s.policies.publishDate));
}

export async function getPolicyWithAnalysis(id: string) {
  const p = await db.select().from(s.policies).where(eq(s.policies.id, id)).limit(1);
  if (!p[0]) return null;
  const a = await db.select().from(s.policyAnalyses).where(eq(s.policyAnalyses.uid, id)).limit(1);
  return { policy: p[0], analysis: a[0] ?? null };
}

export async function getArticles(type?: string, limit = 30) {
  const q = db.select().from(s.articles).where(eq(s.articles.status, "published"));
  const all = type ? await q.where(eq(s.articles.type, type)) : await q;
  return all.sort((a: any, b: any) => (b.publishDate ?? "").localeCompare(a.publishDate ?? "")).slice(0, limit);
}

export async function getArticleBySlug(slug: string) {
  const rows = await db.select().from(s.articles).where(eq(s.articles.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getProvinces(year?: number) {
  const y = year ?? 2025;
  const rows = await db.select().from(s.provinceStats).where(eq(s.provinceStats.year, y));
  return rows;
}

export async function getProvinceHistory(province: string) {
  return db
    .select()
    .from(s.provinceStats)
    .where(eq(s.provinceStats.province, province))
    .orderBy(asc(s.provinceStats.year));
}

export async function getProvinceHistoryAll() {
  return db.select().from(s.provinceStats).orderBy(asc(s.provinceStats.province), asc(s.provinceStats.year));
}

export async function getChains() {
  return db.select().from(s.industryChains);
}

export async function getChainNodes(chainId?: string) {
  const q = db.select().from(s.chainNodes);
  return chainId ? q.where(eq(s.chainNodes.chainId, chainId)) : q;
}

/**
 * 某条链的**已核验**量化指标。
 *
 * 关键：这里返回的是 validMetrics() 的结果 —— 不满足「单位 + 时点 + 来源 +
 * 口径」四件套的行会被直接丢弃，不会出现在页面上。
 * 也就是说，即使有人绕过 upsert 脚本往表里塞了不完整的行，UI 也渲染不出来。
 * 这是"少但真"在代码层的落点。
 */
export async function getChainMetrics(slugs: string[]) {
  if (!slugs.length) return [] as ReturnType<typeof import("./chainMetrics").validMetrics>;
  const rows = (await db.select().from(s.chainMetrics).where(inArray(s.chainMetrics.slug, slugs))) as any[];
  return validMetrics(rows);
}

export async function getChainBySlug(slug: string) {
  const rows = await db.select().from(s.industryChains).where(eq(s.industryChains.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getHistoryEvents(category?: string) {
  const q = db.select().from(s.historyEvents).orderBy(desc(s.historyEvents.date));
  return category ? q.where(eq(s.historyEvents.category, category)) : q;
}

export async function getHistoryEvent(slug: string) {
  const rows = await db.select().from(s.historyEvents).where(eq(s.historyEvents.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/**
 * 大众体感聚合。
 *
 * 口径纪律：`overall` 无数据时返回 **null**，不再回退到硬编码的 45。
 * 旧实现 `?? 45` 会让「体感 45°」在无问卷数据时依然被当作真实值展示/参与计算，
 * 进而让「温差」这个全站核心概念在不同页面出现 45 / 48.9 / 推导值多个版本。
 * 无数据时调用方必须显式显示「暂无问卷数据」。
 */
export async function getFeelingAggregates() {
  const rows = await db.select().from(s.feelingAggregates);
  const overall = rows.find((r: any) => r.dimension === "overall");
  const avg = Number(overall?.avgScore);
  const n = Number(overall?.sampleCount) || 0;
  return {
    /** 体感温度（0–100）；无有效样本时为 null */
    overall: n > 0 && Number.isFinite(avg) ? avg : null,
    sampleCount: n,
    updatedAt: overall?.updatedAt ?? null,
    byAge: rows.filter((r: any) => r.dimension === "age_group"),
    byOccupation: rows.filter((r: any) => r.dimension === "occupation"),
    byRegion: rows.filter((r: any) => r.dimension === "region"),
  };
}

/**
 * 当前宏观温度（最新一期），无数据返回 null。
 * 与体感配对即可算出「温差」；任一侧缺失时温差必须为 null，不得用常量补齐。
 */
export async function getTemperatureSnapshot() {
  const rows = (await db
    .select()
    .from(s.macroTemperatures)
    .orderBy(desc(s.macroTemperatures.date))
    .limit(1)) as any[];
  const t = Number(rows?.[0]?.temperature);
  return {
    temperature: Number.isFinite(t) ? t : null,
    date: rows?.[0]?.date ?? null,
  };
}

/**
 * 「宏观温度 / 体感温度 / 温差」三者的唯一格式化入口。
 *
 * 全站曾出现三个互不一致的体感值（45° 硬编码、48.9° 实测、45+推导值），
 * 根因是每个页面各自拼字符串。现在所有展示都必须走这里：
 *  - 任一侧缺失 → 温差为 null，展示为「—」并说明缺哪一侧；
 *  - 绝不回退到任何常量。
 */
export interface TempDiffView {
  macro: number | null;
  feeling: number | null;
  diff: number | null;
  sampleCount: number;
  macroDate: string | null;
  /** 缺失原因（用于展示层提示），无缺失时为 null */
  missing: "macro" | "feeling" | "both" | null;
}

export function buildTempDiffView(
  macroRaw: number | null | undefined,
  feelingRaw: number | null | undefined,
  sampleCount = 0,
  macroDate: string | null = null
): TempDiffView {
  const macro = Number.isFinite(Number(macroRaw)) ? Number(macroRaw) : null;
  const feeling = Number.isFinite(Number(feelingRaw)) ? Number(feelingRaw) : null;
  const missing = macro == null && feeling == null ? "both" : macro == null ? "macro" : feeling == null ? "feeling" : null;
  return {
    macro,
    feeling,
    diff: macro != null && feeling != null ? Math.round(macro - feeling) : null,
    sampleCount,
    macroDate,
    missing,
  };
}

/** 温度展示：缺失时返回「—」而不是任何占位数字 */
export const fmtTemp = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(Number(v)) ? "—" : String(Math.round(Number(v)));

/** 温差展示：缺失时返回「—」 */
export const fmtDiff = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(Number(v)) ? "—" : `${v > 0 ? "+" : ""}${Math.round(Number(v))}`;

export async function getTemperatures() {
  return db.select().from(s.macroTemperatures).orderBy(asc(s.macroTemperatures.date));
}

export async function getTemperatureAnalysis() {
  const rows = await db.select().from(s.temperatureAnalyses).orderBy(desc(s.temperatureAnalyses.date)).limit(1);
  return rows[0] ?? null;
}

export async function getUserAdvice(userId: string) {
  return db
    .select()
    .from(s.userAdvice)
    .where(eq(s.userAdvice.uid, userId))
    .orderBy(desc(s.userAdvice.createdAt));
}

export async function getWatchlist(userId: string) {
  return db.select().from(s.watchlists).where(eq(s.watchlists.uid, userId));
}

/**
 * 已生成 AI 解读的政策 id 集合。
 * 列表页据此显示「已生成 / 未生成」，而不是像旧实现那样给每条政策都挂上
 * 「普通人怎么看 / 投资者关注点 / 专业解读」三个看起来能点、实际点不动的标签。
 */
export async function getPolicyAnalysisIds(): Promise<Set<string>> {
  const rows = (await db
    .select({ uid: s.policyAnalyses.uid, popular: s.policyAnalyses.popular, professional: s.policyAnalyses.professional })
    .from(s.policyAnalyses)) as any[];
  return new Set(rows.filter((r) => r?.popular && r?.professional).map((r) => String(r.uid)));
}

export async function getUserFeelings(userId: string) {
  return db
    .select()
    .from(s.feelingSurveys)
    .where(eq(s.feelingSurveys.uid, userId))
    .orderBy(desc(s.feelingSurveys.createdAt));
}

export async function searchAll(q: string) {
  const likeQ = `%${q}%`;
  const [articles, policies, indicators, chains] = await Promise.all([
    db.select().from(s.articles).where(and(eq(s.articles.status, "published"), like(s.articles.title, likeQ))).limit(10),
    db.select().from(s.policies).where(like(s.policies.title, likeQ)).limit(10),
    db.select().from(s.economicIndicators).where(like(s.economicIndicators.name, likeQ)).limit(10),
    db.select().from(s.industryChains).where(like(s.industryChains.name, likeQ)).limit(5),
  ]);
  return { articles, policies, indicators, chains };
}

export async function getTaskLogs(limit = 20) {
  return db.select().from(s.taskLogs).orderBy(desc(s.taskLogs.createdAt)).limit(limit);
}

export async function getRecentAggregated(): Promise<{
  latestGdp: number; latestCpi: number; latestPmi: number; latestM2: number;
  latestHouseprice: number; latestExport: number; latestUnemp: number; latestLoans: number;
}> {
  const [gdp, cpi, pmi, m2, houseprice, export_, unemp, loans] = await Promise.all([
    getLatestIndicator("GDP 同比增速"),
    getLatestIndicator("CPI 同比"),
    getLatestIndicator("制造业 PMI"),
    getLatestIndicator("M2 同比增速"),
    getLatestIndicator("百城房价指数同比"),
    getLatestIndicator("出口同比"),
    getLatestIndicator("城镇调查失业率"),
    getLatestIndicator("新增人民币贷款"),
  ]);
  return {
    latestGdp: gdp?.value ?? 5.2,
    latestCpi: cpi?.value ?? 1.4,
    latestPmi: pmi?.value ?? 50.4,
    latestM2: m2?.value ?? 8.8,
    latestHouseprice: houseprice?.value ?? 0.5,
    latestExport: export_?.value ?? 6.0,
    latestUnemp: unemp?.value ?? 5.0,
    latestLoans: loans?.value ?? 2.0,
  };
}

export { parseJson };
/**
 * 产业链索引：公司名 → 环节，以及链 → 环节。
 * 供个股详情页展示「该股在产业链上的位置」，实现个股与产业链的双向互通。
 * 只用 DB 中已存的 375 个公司名，不硬编码任何个股代码。
 */
export async function getChainIndexRows() {
  const chains = await getChains();
  const nodes = await getChainNodes();
  const byChain = new Map<string, Array<{ id: string; name: string; level: string; companies: string | null }>>();
  for (const c of chains) byChain.set(c.id, []);
  for (const n of nodes as any[]) {
    if (!byChain.has(n.chainId)) byChain.set(n.chainId, []);
    byChain.get(n.chainId)!.push({ id: n.id, name: n.name, level: n.level, companies: n.companies });
  }
  // 用 chainId 分组时，key 是 id；这里同时建 id→slug 映射，
  // 否则 buildChainIndex 会把 chainId 当 slug 用，导致链名显示成 chainmujew... 且链接失效
  const slugById = new Map<string, string>(chains.map((c: any) => [c.id as string, c.slug as string]));
  const normalized = new Map<string, Array<{ id: string; name: string; level: string; companies: string | null }>>();
  for (const [id, list] of byChain) {
    const slug = slugById.get(id);
    if (!slug) continue;
    normalized.set(slug, list);
  }
  return buildChainIndex(
    chains.map((c: any) => ({ slug: c.slug as string, name: c.name as string })),
    normalized
  );
}
