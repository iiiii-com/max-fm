import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { pgTable, text as pgText, integer as pgInteger, real as pgReal } from "drizzle-orm/pg-core";

export const isPg = !!process.env.DATABASE_URL;

const t = (name: string) =>
  (isPg ? pgTable(name, {
    id: pgText("id").primaryKey(),
    uid: pgText("uid"),
    name: pgText("name"),
    email: pgText("email"),
    passwordHash: pgText("password_hash"),
    provider: pgText("provider"),
    riskLevel: pgText("risk_level"),
    interests: pgText("interests"),
    plan: pgText("plan"),
    title: pgText("title"),
    slug: pgText("slug"),
    department: pgText("department"),
    category: pgText("category"),
    summary: pgText("summary"),
    content: pgText("content"),
    popular: pgText("popular"),
    professional: pgText("professional"),
    dataLinks: pgText("data_links"),
    tags: pgText("tags"),
    status: pgText("status"),
    source: pgText("source"),
    sourceModel: pgText("source_model"),
    qualityScore: pgText("quality_score"),
    unit: pgText("unit"),
    type: pgText("type"),
    date: pgText("date"),
    publishDate: pgText("publish_date"),
    sourceUrl: pgText("source_url"),
    answers: pgText("answers"),
    components: pgText("components"),
    detail: pgText("detail"),
    chainId: pgText("chain_id"),
    level: pgText("level"),
    companies: pgText("companies"),
    description: pgText("description"),
    code: pgText("code"),
    symbol: pgText("symbol"),
    value: pgReal("value"),
    growth: pgReal("growth"),
    sentiment: pgText("sentiment"),
    score: pgReal("score"),
    temperature: pgReal("temperature"),
    temperatureDiff: pgReal("temperature_diff"),
    price: pgReal("price"),
    changePct: pgReal("change_pct"),
    changeAmount: pgReal("change_amount"),
    open: pgReal("open"),
    high: pgReal("high"),
    low: pgReal("low"),
    volume: pgReal("volume"),
    amount: pgReal("amount"),
    year: pgInteger("year"),
    gdp: pgReal("gdp"),
    perCapitaGdp: pgReal("per_capita_gdp"),
    population: pgReal("population"),
    fiscalRevenue: pgReal("fiscal_revenue"),
    trade: pgReal("trade"),
    sampleCount: pgInteger("sample_count"),
    avgScore: pgReal("avg_score"),
    durationMs: pgInteger("duration_ms"),
    tokens: pgInteger("tokens"),
    createdAt: pgInteger("created_at"),
    updatedAt: pgInteger("updated_at"),
    province: pgText("province"),
    dimension: pgText("dimension"),
    bucket: pgText("bucket"),
    ageGroup: pgText("age_group"),
    occupation: pgText("occupation"),
    region: pgText("region"),
    taskName: pgText("task_name"),
    n: pgInteger("n"),
    linkId: pgText("link_id"),
    connectedTo: pgText("connected_to"),
    // city_house_price（70 城商品住宅销售价格指数，国家统计局月度发布）
    // t() 会同时走 pg / sqlite 两个分支，TS 静态检查两处都必须声明，否则
    // pg 分支缺列会报 `Property 'city' does not exist`（即使运行时用的是 sqlite）。
    // 全部是**指数**不是价格：newMom/usedMom 为上月=100，newYoy/usedYoy 为上年同月=100。
    city: pgText("city"),
    period: pgText("period"),
    newMom: pgReal("new_mom"),
    newYoy: pgReal("new_yoy"),
    usedMom: pgReal("used_mom"),
    usedYoy: pgReal("used_yoy"),
    fetchedAt: pgInteger("fetched_at"),
  }) : sqliteTable(name, {
    id: text("id").primaryKey(),
    uid: text("uid"),
    name: text("name"),
    email: text("email"),
    passwordHash: text("password_hash"),
    provider: text("provider"),
    riskLevel: text("risk_level"),
    interests: text("interests"),
    plan: text("plan"),
    title: text("title"),
    slug: text("slug"),
    department: text("department"),
    category: text("category"),
    summary: text("summary"),
    content: text("content"),
    popular: text("popular"),
    professional: text("professional"),
    dataLinks: text("data_links"),
    tags: text("tags"),
    status: text("status"),
    source: text("source"),
    sourceModel: text("source_model"),
    qualityScore: text("quality_score"),
    unit: text("unit"),
    type: text("type"),
    date: text("date"),
    publishDate: text("publish_date"),
    sourceUrl: text("source_url"),
    answers: text("answers"),
    components: text("components"),
    detail: text("detail"),
    chainId: text("chain_id"),
    level: text("level"),
    companies: text("companies"),
    description: text("description"),
    code: text("code"),
    symbol: text("symbol"),
    value: real("value"),
    growth: real("growth"),
    sentiment: text("sentiment"),
    score: real("score"),
    temperature: real("temperature"),
    temperatureDiff: real("temperature_diff"),
    price: real("price"),
    changePct: real("change_pct"),
    changeAmount: real("change_amount"),
    open: real("open"),
    high: real("high"),
    low: real("low"),
    volume: real("volume"),
    amount: real("amount"),
    year: integer("year"),
    gdp: real("gdp"),
    perCapitaGdp: real("per_capita_gdp"),
    population: real("population"),
    fiscalRevenue: real("fiscal_revenue"),
    trade: real("trade"),
    sampleCount: integer("sample_count"),
    avgScore: real("avg_score"),
    durationMs: integer("duration_ms"),
    tokens: integer("tokens"),
    createdAt: integer("created_at"),
    updatedAt: integer("updated_at"),
    province: text("province"),
    dimension: text("dimension"),
    bucket: text("bucket"),
    ageGroup: text("age_group"),
    occupation: text("occupation"),
    region: text("region"),
    taskName: text("task_name"),
    n: integer("n"),
    linkId: text("link_id"),
    connectedTo: text("connected_to"),
    // city_house_price（70 城商品住宅销售价格指数，国家统计局月度发布）
    // 全部是**指数**不是价格：newMom/usedMom 为上月=100，newYoy/usedYoy 为上年同月=100。
    city: text("city"),
    period: text("period"),
    newMom: real("new_mom"),
    newYoy: real("new_yoy"),
    usedMom: real("used_mom"),
    usedYoy: real("used_yoy"),
    fetchedAt: integer("fetched_at"),
    // source_url 已在上方公用列集合中定义（line 109），此处不重复声明
  }));

export const economicIndicators = t("economic_indicators");
export const policies = t("policies");
export const policyAnalyses = t("policy_analyses");
export const articles = t("articles");
export const industryChains = t("industry_chains");
export const chainNodes = t("chain_nodes");
/**
 * 产业链量化指标（唯一允许存放"环节数字"的表）。
 *
 * 背景：chain_nodes 曾在 seed 阶段用 rng() 生成 value / growth，
 * 当作权威数据渲染并带涨跌色，已清空并停止写入。
 * 真实数字统一放这里，且必须满足 `isValidMetric` 的三件套约束。
 *
 * 复用通用列，无�� schema 迁移：
 *   slug      → 产业链 slug
 *   type      → metric_key（market_size / localization_rate / output …）
 *   name      → 指标显示名
 *   value     → 数值
 *   unit      → 单位（"亿元" / "%" / "亿块" / "万辆"）
 *   date      → 统计时点（"2024" / "2024-06"）
 *   source    → 来源名称（"国家统计局" / "中国汽车工业协会" …）
 *   sourceUrl → 来源链接
 *   detail    → 口径说明（"含进口 / 不含出口"这类必须写清楚）
 *   createdAt → 入库时间
 */
export const chainMetrics = t("chain_metrics");
/**
 * 70 城商品住宅销售价格指数（国家统计局月度发布）。
 *
 * city 为主键（站内 67 城的短名，不是统计局的 70 城标准名 —— 匹配见
 * scripts/import-house-price.ts）。不匹配的 12 城不入库，页面显式说明原因。
 *
 * 口径（官方注释，页面必须同屏展示，不能只给数字）：
 *   - 调查范围：各城市的市辖区，**不包括县**
 *   - 新建商品住宅：全面调查，基础数据为当地房地产管理部门网签数据
 *   - 二手住宅：重点调查 + 典型调查，数据来自经纪机构上报与调查员实地采价
 *   - 2026 年 1 月起以 2025 年为新一轮对比基期
 *
 * 指数含义（基期=100，不是价格本身）：
 *   newMom / usedMom → 上月 = 100，环比涨跌
 *   newYoy / usedYoy → 上年同月 = 100，同比涨跌
 */
export const cityHousePrice = t("city_house_price");
export const provinceStats = t("province_stats");
export const quotesCache = t("quotes_cache");
export const users = t("users");
export const userAdvice = t("user_advice");
export const watchlists = t("watchlists");
export const feelingSurveys = t("feeling_surveys");
export const feelingAggregates = t("feeling_aggregates");
export const macroTemperatures = t("macro_temperature");
export const temperatureAnalyses = t("temperature_analyses");
export const taskLogs = t("task_logs");
export const historyEvents = t("history_events");

export type EconomicIndicator = typeof economicIndicators.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type PolicyAnalysis = typeof policyAnalyses.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type IndustryChain = typeof industryChains.$inferSelect;
export type ChainNode = typeof chainNodes.$inferSelect;
export type ChainMetric = typeof chainMetrics.$inferSelect;
export type ProvinceStat = typeof provinceStats.$inferSelect;
export type CityHousePrice = typeof cityHousePrice.$inferSelect;
export type Quote = typeof quotesCache.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserAdvice = typeof userAdvice.$inferSelect;
export type FeelingSurvey = typeof feelingSurveys.$inferSelect;
export type FeelingAggregate = typeof feelingAggregates.$inferSelect;
export type MacroTemperature = typeof macroTemperatures.$inferSelect;
export type TemperatureAnalysis = typeof temperatureAnalyses.$inferSelect;
export type TaskLog = typeof taskLogs.$inferSelect;