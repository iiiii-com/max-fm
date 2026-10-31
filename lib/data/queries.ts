import { db, parseJson, dbDegradedRecently } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq, ne, desc, asc, and, like, inArray } from "drizzle-orm";
import { validMetrics } from "@/lib/data/chainMetrics";
import { hitWords } from "@/lib/data/chainPolicyHints";
import { buildChainIndex } from "@/lib/data/chainIndex";
import { cached } from "@/lib/data/cache";

/**
 * 降级期间不要把「空结果」写进缓存。
 * （数据库挂掉时读操作被包装成空数组，若缓存 10 分钟，恢复后用户仍会看到空数据）
 */
const skipWhenDegraded = () => dbDegradedRecently();

/**
 * 宏观指标序列的「图表最小集」：只取 type/date/value 三列。
 *
 * /macro 只需要给每项指标画 (date, value) 折线，但原 `getIndicators()` 是全表全字段
 * （60+ 列 × 4571 行 = 6.0MB JSON）。Neon 免费版每月只有 5GB 公网传输，
 * 一次 /macro 就吃掉 6MB → 约 857 次访问即封顶。投影到 3 列后体积约 1/40。
 */
export interface MacroSeriesRow {
  type: string;
  date: string;
  value: number | null;
}

export async function getMacroSeries(): Promise<MacroSeriesRow[]> {
  return cached(
    "macro:series",
    10 * 60_000,
    async () =>
      (await db
        .select({
          type: s.economicIndicators.type,
          date: s.economicIndicators.date,
          value: s.economicIndicators.value,
        })
        .from(s.economicIndicators)
        .orderBy(asc(s.economicIndicators.date))) as MacroSeriesRow[],
    { skipIf: skipWhenDegraded }
  );
}

export const CATEGORY_COLORS: Record<string, string> = {
  物价: "#dc2626", 景气: "#ea580c", 货币: "#2563eb", 外贸: "#0d9488",
  就业: "#7c3aed", 生产: "#ca8a04", 消费: "#e11d48", 投资: "#0891b2", 总量: "#4f46e5",
};

export async function getIndicators() {
  // 月频数据，10 分钟缓存足够；主要收益是别让 /macro 与月报生成各自整表重拉
  return cached(
    "macro:indicators:full",
    10 * 60_000,
    async () => db.select().from(s.economicIndicators).orderBy(asc(s.economicIndicators.date)),
    { skipIf: skipWhenDegraded }
  );
}

/**
 * 宏观指标序列的「数据血统」统计。
 *
 * 背景（数据正确性 P0）：`scripts/seed.ts` 会用 rng() 合成 24 项指标的演示序列，
 * 但页面一度无差别地写着「全部指标由东方财富数据中心真实报表同步」——
 * 本地/未同步环境下这是把模拟数据冒充官方数据，属于严重误导。
 *
 * 真实同步（lib/data/macro-sync.ts）写入的 source 是「东方财富数据中心 / 中债登 /
 * 东方财富行情接口」；seed 写入的 source 是「国家统计局 / 中国人民银行 …」等发布机构名。
 * 因此可以用 source 分布判断当前库到底是「已同步」还是「仅种子数据」。
 */
// 只认真实同步写入口（macro-sync.ts）的 source。
// 注意不能把「中债登」算进来：scripts/seed.ts:71 的种子行也用这个名字，
// 若计入会把 202 行示例数据误算成「已同步」。
// 新浪财经行情接口 = 汇率/金价的第二数据源（push2his 不可用时的替代）。
const MACRO_SYNCED_SOURCES = new Set(["东方财富数据中心", "东方财富行情接口", "新浪财经行情接口"]);

export interface MacroProvenance {
  total: number;
  synced: number;
  seed: number;
  /** 真实同步行的最近更新时间（ms），无则 null */
  lastSyncedAt: number | null;
  /** 每个指标类型当前库里的来源与是否已同步（用于卡片级标注，避免逐项冒充真实） */
  byType: Record<string, { source: string | null; synced: boolean }>;
}

export async function getMacroProvenance(): Promise<MacroProvenance> {
  return cached(
    "macro:provenance",
    10 * 60_000,
    async () => {
      const rows = (await db
        .select({ type: s.economicIndicators.type, source: s.economicIndicators.source, updatedAt: s.economicIndicators.updatedAt })
        .from(s.economicIndicators)) as Array<{ type: string; source: string | null; updatedAt: number | null }>;
      let synced = 0;
      let lastSyncedAt: number | null = null;
      const byType: MacroProvenance["byType"] = {};
      for (const r of rows) {
        const isSynced = !!r.source && MACRO_SYNCED_SOURCES.has(r.source);
        if (isSynced) {
          synced += 1;
          const t = Number(r.updatedAt ?? 0);
          if (Number.isFinite(t) && t > 0 && (lastSyncedAt == null || t > lastSyncedAt)) lastSyncedAt = t;
        }
        // 同类型多行时以「已同步」优先，避免一个类型被示例行覆盖判断
        const prev = byType[r.type];
        if (!prev || (!prev.synced && isSynced)) byType[r.type] = { source: r.source ?? null, synced: isSynced };
      }
      return { total: rows.length, synced, seed: rows.length - synced, lastSyncedAt, byType };
    },
    { skipIf: skipWhenDegraded }
  );
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
  return cached(
    "policy:all:full",
    2 * 60_000,
    async () => db.select().from(s.policies).orderBy(desc(s.policies.publishDate)),
    { skipIf: skipWhenDegraded }
  );
}

/**
 * 政策列表页专用的「列表字段」投影。
 *
 * 原实现用 `db.select()` 取整行（60+ 列，含 content/answers 等大文本），189 行 = 1.29MB。
 * 但列表页实际只渲染 id/title/summary/category/department/source/publishDate/sourceUrl/updatedAt，
 * 正文只在详情页用。投影后单次传输约几十 KB。
 */
export async function getPolicyList() {
  return cached(
    "policy:list",
    2 * 60_000,
    async () =>
      db
        .select({
          id: s.policies.id,
          title: s.policies.title,
          summary: s.policies.summary,
          category: s.policies.category,
          department: s.policies.department,
          source: s.policies.source,
          publishDate: s.policies.publishDate,
          sourceUrl: s.policies.sourceUrl,
          updatedAt: s.policies.updatedAt,
        })
        .from(s.policies)
        .orderBy(desc(s.policies.publishDate)),
    { skipIf: skipWhenDegraded }
  );
}

export async function getPolicyWithAnalysis(id: string) {
  const p = await db.select().from(s.policies).where(eq(s.policies.id, id)).limit(1);
  if (!p[0]) return null;
  const a = await db.select().from(s.policyAnalyses).where(eq(s.policyAnalyses.uid, id)).limit(1);
  return { policy: p[0], analysis: a[0] ?? null };
}

export async function getArticles(type?: string, limit = 30) {
  // 文章列表改动频率低，1 分钟缓存（同一进程内 / 与 /policy 等页面共享）
  return cached(
    `articles:${type ?? "all"}:${limit}`,
    60_000,
    async () => {
      const q = db.select().from(s.articles).where(eq(s.articles.status, "published"));
      const all = type ? await q.where(eq(s.articles.type, type)) : await q;
      return all.sort((a: any, b: any) => (b.publishDate ?? "").localeCompare(a.publishDate ?? "")).slice(0, limit);
    },
    { skipIf: skipWhenDegraded }
  );
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
  // 产业链是静态配置型数据（40 条），30 分钟缓存足够
  return cached(
    "chain:list",
    30 * 60_000,
    async () => db.select().from(s.industryChains),
    { skipIf: skipWhenDegraded }
  );
}

export async function getChainNodes(chainId?: string) {
  // 产业链节点是静态配置型数据（221 条），30 分钟缓存足够；
  // 按 chainId 过滤时用独立缓存键，避免不同链互相覆盖。
  return cached(
    `chain:nodes:${chainId ?? "all"}`,
    30 * 60_000,
    async () => {
      const q = db.select().from(s.chainNodes);
      return chainId ? q.where(eq(s.chainNodes.chainId, chainId)) : q;
    },
    { skipIf: skipWhenDegraded }
  );
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
  // 聚合表只有几十行，但每个页面（首页/宏观/体感）都会读；缓存 2 分钟减少唤醒
  return cached(
    "feeling:aggregates",
    2 * 60_000,
    async () => {
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
    },
    { skipIf: skipWhenDegraded }
  );
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
  // 月度温度序列，改动频率低；缓存 5 分钟（Neon 按查询次数/传输量计费）
  return cached(
    "macro:temperatures",
    5 * 60_000,
    async () => db.select().from(s.macroTemperatures).orderBy(asc(s.macroTemperatures.date)),
    { skipIf: skipWhenDegraded }
  );
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

/**
 * 反向关联：哪些政策涉及这条产业链。
 *
 * 与政策详情页共用 lib/data/chainPolicyHints.ts 的同一份关键词表 ——
 * 两处各写一份必然漂移，出现"政策页说涉及、链页说没有"的自相矛盾。
 *
 * 命中口径：只用**标题 + 摘要 + 原文**做匹配，不含 AI 解读文本
 * （解读里出现的词会把政策原本没提的行业也算成命中）。
 * 返回命中的具体词，UI 上可说明"因为哪几个词命中"，比只给结论可核对。
 */
export async function getPoliciesForChain(slug: string, limit = 6) {
  const rows = (await db.select().from(s.policies).orderBy(desc(s.policies.publishDate))) as any[];
  const out: Array<{
    id: string;
    title: string;
    department: string | null;
    category: string | null;
    publishDate: string | null;
    hitWords: string[];
  }> = [];
  for (const p of rows) {
    const corpus = `${p.title ?? ""} ${p.summary ?? ""} ${p.content ?? ""}`;
    const hits = hitWords(corpus, slug);
    if (!hits.length) continue;
    out.push({
      id: String(p.id),
      title: String(p.title ?? ""),
      department: p.department ?? null,
      category: p.category ?? null,
      publishDate: p.publishDate ?? null,
      hitWords: hits,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * 已产出「专业机构视角」的政策列表（专业版工作台的深度解读分区用）。
 *
 * 只返回**专业层真的存在**的条目：工作台上列出来的每一项都必须是点进去就能读的，
 * 否则这个分区就退化成一个"看起来有内容"的摆设。
 * 摘要只取机构视角的开头若干字，够判断"这条要不要读"，不把全文送到列表页。
 */
export async function getPoliciesWithDeepAnalysis(limit = 6) {
  const rows = (await db
    .select({
      uid: s.policyAnalyses.uid,
      professional: s.policyAnalyses.professional,
      detail: s.policyAnalyses.detail,
      updatedAt: s.policyAnalyses.updatedAt,
      title: s.policies.title,
      department: s.policies.department,
      category: s.policies.category,
      publishDate: s.policies.publishDate,
    })
    .from(s.policyAnalyses)
    .leftJoin(s.policies, eq(s.policies.id, s.policyAnalyses.uid))
    .orderBy(desc(s.policyAnalyses.updatedAt))
    .limit(limit * 2)) as any[];

  return rows
    .filter((r) => r?.uid && r?.professional)
    .slice(0, limit)
    .map((r) => ({
      id: String(r.uid),
      title: String(r.title ?? "（政策原文缺失）"),
      department: r.department ?? null,
      category: r.category ?? null,
      publishDate: r.publishDate ?? null,
      hasDetail: !!r.detail,
      excerpt: String(r.professional).replace(/[#*`>\-\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 96),
      updatedAt: r.updatedAt ?? null,
    }));
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
  // 过滤掉 bootstrap 写下的「库结构版本标记」行（name='__schema'），
  // 它是内部簿记，不该出现在任务日志列表里。
  return db
    .select()
    .from(s.taskLogs)
    .where(ne(s.taskLogs.name, "__schema"))
    .orderBy(desc(s.taskLogs.createdAt))
    .limit(limit);
}

export async function getRecentAggregated(): Promise<{
  latestGdp: number; latestCpi: number; latestPmi: number; latestM2: number;
  latestHouseprice: number; latestExport: number; latestUnemp: number; latestLoans: number;
}> {
  /**
   * 旧实现串行/并行地调 8 次 `getLatestIndicator()` = 8 条 SQL，
   * 而首页每次渲染都要跑一遍 —— Neon 免费版是按「查询次数不直接计费、但算力唤醒时长计费」
   * 与传输量计费的，8 条查询意味着 8 次唤醒机会。这里合并成 1 条：
   * 一次取回 8 个指标的全部行（每项约 200 行，共 ~1600 行，只投影 3 列），在内存里取各自最新。
   */
  return cached(
    "macro:recent-aggregated",
    2 * 60_000,
    async () => {
      const names = [
        "GDP 同比增速",
        "CPI 同比",
        "制造业 PMI",
        "M2 同比增速",
        "百城房价指数同比",
        "出口同比",
        "城镇调查失业率",
        "新增人民币贷款",
      ];
      const rows = (await db
        .select({
          name: s.economicIndicators.name,
          date: s.economicIndicators.date,
          value: s.economicIndicators.value,
        })
        .from(s.economicIndicators)
        .where(inArray(s.economicIndicators.name, names))
        .orderBy(desc(s.economicIndicators.date))) as Array<{ name: string; date: string; value: number | null }>;

      // 按 name 取「日期最新的一条」（rows 已按 date desc 排序，首个即最新）
      const latest = new Map<string, { date: string; value: number | null }>();
      for (const r of rows) {
        if (!latest.has(r.name)) latest.set(r.name, { date: r.date, value: r.value });
      }
      const pick = (name: string) => latest.get(name) ?? null;

      const gdp = pick("GDP 同比增速");
      const cpi = pick("CPI 同比");
      const pmi = pick("制造业 PMI");
      const m2 = pick("M2 同比增速");
      const houseprice = pick("百城房价指数同比");
      const export_ = pick("出口同比");
      const unemp = pick("城镇调查失业率");
      const loans = pick("新增人民币贷款");
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
    },
    { skipIf: skipWhenDegraded }
  );
}

export { parseJson };
/**
 * 70 城商品住宅销售价格指数（国家统计局月度发布）。
 *
 * 返回的行按站内城市短名索引（如"深圳"），不含城市 —— 取不到的 18 城
 * 由调用方按 CITY_HOUSE_PRICE_SCOPE 外显说明，不用近似值补齐。
 * 数据期统一，见 period 字段；页面必须同屏展示，不只给数字。
 */
export async function getCityHousePrices(): Promise<{
  period: string | null;
  sourceUrl: string | null;
  byCity: Map<string, { newMom: number; newYoy: number; usedMom: number; usedYoy: number }>;
}> {
  const rows = (await db.select().from(s.cityHousePrice)) as any[];
  const byCity = new Map<
    string,
    { newMom: number; newYoy: number; usedMom: number; usedYoy: number }
  >();
  for (const r of rows) {
    if (r.newMom == null || r.newYoy == null || r.usedMom == null || r.usedYoy == null) continue;
    byCity.set(r.city, {
      newMom: r.newMom,
      newYoy: r.newYoy,
      usedMom: r.usedMom,
      usedYoy: r.usedYoy,
    });
  }
  const period = rows.length ? (rows[0].period ?? null) : null;
  const sourceUrl = rows.length ? (rows[0].sourceUrl ?? null) : null;
  return { period, sourceUrl, byCity };
}

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
