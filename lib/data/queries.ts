import { db, parseJson } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq, desc, asc, and, like } from "drizzle-orm";

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

export async function getChains() {
  return db.select().from(s.industryChains);
}

export async function getChainNodes(chainId?: string) {
  const q = db.select().from(s.chainNodes);
  return chainId ? q.where(eq(s.chainNodes.chainId, chainId)) : q;
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

export async function getFeelingAggregates() {
  const rows = await db.select().from(s.feelingAggregates);
  const overall = rows.find((r: any) => r.dimension === "overall");
  return {
    overall: overall?.avgScore ?? 45,
    sampleCount: overall?.sampleCount ?? 0,
    byAge: rows.filter((r: any) => r.dimension === "age_group"),
    byOccupation: rows.filter((r: any) => r.dimension === "occupation"),
    byRegion: rows.filter((r: any) => r.dimension === "region"),
  };
}

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