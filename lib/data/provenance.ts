/**
 * 数据溯源（Provenance）主注册表 + 运行时采集。
 *
 * 要解决的问题：站内数据来自十几个上游（东财行情、国家统计局、部委官网…），
 * 有的每日同步、有的按月发布、有的只是种子演示数据。用户看到一条曲线或一个数字时，
 * 应该能回答三个问题：**它从哪来、什么时候更新的、现在还可不可信**。
 *
 * 设计原则：
 * 1. 注册表是唯一事实源 —— 页面、接口、健康检查都从这里取清单，避免各自维护文案。
 * 2. 状态由「行数 + 最近更新时间 + 更新节奏」推导（规则在 provenance-logic.ts，可单测）。
 * 3. 查询失败 / 数据库降级不抛错，标记为「不可用」并把原因写进 notes，页面照常可打开。
 * 4. 结果缓存 60 秒：溯源台是低频页，没必要每次打开都打一轮 count(*)。
 */
import { sql } from "drizzle-orm";
import { db, dbDegradedReason, dbDegradedRecently } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { cached } from "@/lib/data/cache";
import { getMacroProvenance } from "@/lib/data/queries";
import {
  CADENCE,
  formatAge,
  needsAttention,
  statusFromMetric,
  summarizeProvenance,
  type CadenceKey,
  type ProvenanceKind,
  type ProvenanceStatus,
  type ProvenanceSummary,
} from "./provenance-logic";

/** 页面分组顺序：宏观 → 行情 → 产业 → 资讯。 */
export const PROVENANCE_GROUPS = ["宏观与温度", "行情与 ETF", "产业与政策", "资讯与历史"] as const;
export type ProvenanceGroup = (typeof PROVENANCE_GROUPS)[number];

interface Metric {
  rows: number | null;
  lastUpdated: number | null;
}

interface MetricSpec {
  table: any;
  /** 时间列候选，按优先级 coalesce（都是整数毫秒列） */
  cols: any[];
}

/** 注册表条目：一个数据集 = 一行。 */
export interface DataSourceSpec {
  id: string;
  name: string;
  group: ProvenanceGroup;
  /** 数据性质 */
  kind: ProvenanceKind;
  /** 期望更新节奏（决定「延迟/陈旧」阈值） */
  cadence: CadenceKey;
  /** 对外接入点（页面或接口），用于让用户自己复核 */
  api?: string;
  /** 存储位置说明 */
  storage?: string;
  /** 采集指标用的表；不落库的数据集不填 */
  metric?: MetricSpec;
  /** 首屏行情快照键（market_snapshots.code） */
  snapshotCode?: string;
  /** 快照前缀（如 sector:board:，取所有前缀行里最新的） */
  snapshotPrefix?: string;
  /** 实时接口：没有「上次更新时间」 */
  stream?: boolean;
  /** 由任务定时刷新，用于关联最近一次任务状态 */
  task?: string;
  /** 固定状态（例如上游已停止披露） */
  fixedStatus?: ProvenanceStatus;
  /** 固定状态的解释文案（会显示在卡片的「当前状态」里） */
  fixedNote?: string;
  /** 说明：这类数据的来龙去脉 */
  note: string;
  /** 失真风险：什么情况下这个数字会不可信 */
  risk?: string;
}

const monthSpec: MetricSpec = { table: s.articles, cols: [s.articles.updatedAt, s.articles.createdAt] };

/**
 * 全站数据清单。
 * 顺序即页面顺序；group 决定分组。
 */
export const DATA_SOURCES: DataSourceSpec[] = [
  // ── 宏观与温度 ────────────────────────────────────────────────
  {
    id: "macro-indicators",
    name: "宏观经济指标",
    group: "宏观与温度",
    kind: "official",
    cadence: "daily",
    api: "/api/indicators",
    storage: "economic_indicators 表（4571 行序列）",
    metric: { table: s.economicIndicators, cols: [s.economicIndicators.updatedAt, s.economicIndicators.createdAt] },
    task: "macro-sync",
    note: "GDP / CPI / PPI / PMI / M2 等指标序列，由每日 macro-sync 任务从东方财富数据中心与官方发布同步。",
    risk: "未同步的指标会使用种子演示序列：数值趋势看起来合理但没有真实来源，不能用于决策或对外引用。",
  },
  {
    id: "macro-context",
    name: "大盘实时上下文（指数点位/成交额）",
    group: "宏观与温度",
    kind: "market",
    cadence: "realtime",
    api: "/api/macro/context",
    storage: "实时接口（东财/腾讯，20 秒进程缓存）",
    stream: true,
    note: "上证 / 深证 / 创业板最新点位与成交额，用于宏观温度卡的「当前市场坐标」。",
    risk: "盘中缓存最长 20 秒；休市后返回最后收盘数据，asOf 字段会给出数据日期。",
  },
  {
    id: "macro-temperature",
    name: "宏观温度指数",
    group: "宏观与温度",
    kind: "derived",
    cadence: "daily",
    api: "页面 /macro",
    storage: "macro_temperatures 表",
    metric: { table: s.macroTemperatures, cols: [s.macroTemperatures.updatedAt, s.macroTemperatures.createdAt] },
    task: "daily-review",
    note: "由宏观指标合成 0–10 分的温度值；同时保存与用户体感的差值，供「宏观 vs 体感」对比。",
    risk: "温度是站内派生指标，不是官方发布；指标缺失时会退回种子序列，数值仅供参考。",
  },
  {
    id: "temperature-analysis",
    name: "温度分析（AI 解读）",
    group: "宏观与温度",
    kind: "derived",
    cadence: "daily",
    api: "页面 /macro",
    storage: "temperature_analyses 表",
    metric: { table: s.temperatureAnalyses, cols: [s.temperatureAnalyses.createdAt, s.temperatureAnalyses.updatedAt] },
    task: "temperature-report",
    note: "基于当日温度与指标变化的文字解读，由定时任务生成。",
    risk: "解读随数据变化重写，历史版本不保存；引用时请以最新一条为准。",
  },
  {
    id: "monthly-report",
    name: "宏观月报",
    group: "宏观与温度",
    kind: "derived",
    cadence: "monthly",
    api: "/api/macro/monthly",
    storage: "articles 表（type=monthly，每月一篇）",
    metric: monthSpec,
    task: "macro-monthly",
    note: "每月自动汇总上一月宏观指标与市场表现，生成一篇月报；错过发布日会自动补月。",
    risk: "月报发布时间取决于月初任务是否成功；页面会显示最新一篇所属月份，过期会标记为陈旧。",
  },
  {
    id: "feeling-survey",
    name: "用户体感问卷",
    group: "宏观与温度",
    kind: "user",
    cadence: "ondemand",
    api: "/api/feeling/submit",
    storage: "feeling_surveys 表（5.5 万行）",
    metric: { table: s.feelingSurveys, cols: [s.feelingSurveys.createdAt] },
    note: "用户提交的体感评分（温度、收入预期、就业预期等），匿名汇总后参与体感曲线。",
    risk: "样本自选择：参与用户不代表全体，样本数会在图表上标注。",
  },
  {
    id: "feeling-aggregates",
    name: "体感汇总",
    group: "宏观与温度",
    kind: "derived",
    cadence: "ondemand",
    api: "页面 /macro",
    storage: "feeling_aggregates 表（按年龄/职业/地区分桶）",
    metric: { table: s.feelingAggregates, cols: [s.feelingAggregates.date] },
    note: "问卷聚合结果：总体平均、样本数、分桶均值；每次提交后重算并清缓存。",
    risk: "分桶样本量小的时候波动大，不要用单桶数值下结论。",
  },

  // ── 行情与 ETF ───────────────────────────────────────────────
  {
    id: "quotes",
    name: "首屏行情（指数/全球/板块）",
    group: "行情与 ETF",
    kind: "market",
    cadence: "intraday",
    api: "/api/quotes",
    storage: "实时接口 + market_snapshots（api:quotes）兜底",
    snapshotCode: "api:quotes",
    task: "market-prefetch",
    note: "首页/行情页顶部的指数报价与全球市场，由 market-prefetch 定时预取；上游超时返回最近快照并标记 stale。",
    risk: "上游超时或非交易时段会返回快照（响应头 X-Cache: STALE），此时数字的采集时间不是「刚刚」。",
  },
  {
    id: "breadth",
    name: "市场宽度（涨跌家数/成交额）",
    group: "行情与 ETF",
    kind: "market",
    cadence: "intraday",
    api: "/api/market/breadth",
    storage: "实时接口 + market_snapshots（api:breadth）兜底",
    snapshotCode: "api:breadth",
    note: "沪深两市涨跌平家数与成交额，用于判断市场是普涨还是结构性行情。",
    risk: "取不到上游时返回快照而不是用 0 冒充；stale=true 时宽度与成交额都不是最新值。",
  },
  {
    id: "kline-stock",
    name: "个股/指数 K 线",
    group: "行情与 ETF",
    kind: "market",
    cadence: "realtime",
    api: "/api/stock/kline",
    storage: "多源（东财/腾讯/新浪）+ 进程缓存与 CDN 边缘缓存",
    stream: true,
    note: "日/周/月 K 线，服务端对同一 secid+周期做 20 秒（盘中）到 10 分钟（盘后）缓存，历史 K 线收盘后不再变化。",
    risk: "不同上游复权口径不同：同一只股票在东财与腾讯的除权日可能略有差异。",
  },
  {
    id: "kline-index",
    name: "指数 K 线",
    group: "行情与 ETF",
    kind: "market",
    cadence: "realtime",
    api: "/api/index/kline",
    storage: "东财指数快照 + 缓存",
    stream: true,
    note: "大盘指数日线序列，供 K 线实验室与指数对比使用。",
    risk: "指数不复权；跨市场（A 股/美股）时间轴按各自交易日对齐，不可直接重叠比较。",
  },
  {
    id: "fund-rank",
    name: "资金流排行",
    group: "行情与 ETF",
    kind: "market",
    cadence: "intraday",
    api: "/api/market/fund-rank",
    storage: "东财 push2 clist（f62）+ market_snapshots（market:fund-rank）",
    snapshotCode: "market:fund-rank",
    note: "按主力净流入排序的个股榜单，数据源为东财资金流接口。",
    risk: "资金流是「主动买卖差额」估算，不等于真实机构持仓变化。",
  },
  {
    id: "surge",
    name: "异动/涨幅榜",
    group: "行情与 ETF",
    kind: "market",
    cadence: "intraday",
    api: "/api/market/surge",
    storage: "东财实时行情 + market_snapshots（market:surge）",
    snapshotCode: "market:surge",
    note: "盘中涨跌幅与成交量异动个股，按时间窗排名。",
    risk: "盘中榜单变化极快，跨时点截图对比没有意义。",
  },
  {
    id: "sector-board",
    name: "板块行情榜",
    group: "行情与 ETF",
    kind: "market",
    cadence: "intraday",
    api: "/api/sector/board",
    storage: "东财板块行情 + market_snapshots（sector:board:*）",
    snapshotPrefix: "sector:board:",
    note: "行业板块涨跌幅、资金流与领涨股，按 top N 缓存。",
    risk: "板块归类采用东财行业口径，与申万/中信分类不完全一致。",
  },
  {
    id: "etf-list",
    name: "ETF 行情列表",
    group: "行情与 ETF",
    kind: "market",
    cadence: "realtime",
    api: "/api/etf/list",
    storage: "东财 ETF 板块行情接口",
    stream: true,
    note: "ETF 最新价、涨跌幅、成交额与溢价率；披露净值缺失时不计算溢价（navStale）。",
    risk: "ETF 溢价率需要 IOPV/披露净值，盘中净值缺失时会显示为「—」而不是 0。",
  },
  {
    id: "etf-activity",
    name: "ETF 资金活跃度",
    group: "行情与 ETF",
    kind: "market",
    cadence: "realtime",
    api: "/api/etf/activity",
    storage: "东财 ETF 成交与资金流接口",
    stream: true,
    note: "按成交额与换手率筛出的活跃 ETF，用于观察资金往哪类资产走。",
    risk: "活跃度只反映成交，不代表净申购/净赎回。",
  },
  {
    id: "northbound",
    name: "北向资金",
    group: "行情与 ETF",
    kind: "official",
    cadence: "daily",
    api: "/api/northbound",
    storage: "历史统计（交易所已停止实时披露）",
    stream: true,
    fixedStatus: "down",
    fixedNote: "上游自 2024-08-16 起停止实时披露，保留入口仅作历史对照，不会再有新数据。",
    note: "陆股通历史统计口径；沪深交易所自 2024-08-16 起停止实时披露北向资金，本页只展示历史区间。",
    risk: "任何标注「今日北向实时流入」的数字都不再具有权威来源，请勿引用。",
  },
  {
    id: "daily-bars",
    name: "日线行情落库",
    group: "行情与 ETF",
    kind: "market",
    cadence: "intraday",
    api: "/api/tasks/run?task=daily-review",
    storage: "daily_bars 表",
    metric: { table: s.dailyBars, cols: [s.dailyBars.fetchedAt, s.dailyBars.updatedAt] },
    note: "把当日 K 线快照落库，用于离线可用与上游故障时的历史兜底。",
    risk: "落库的是抓取当时的数据；除权除息后需要重抓，历史值可能与最新复权结果不一致。",
  },

  // ── 产业与政策 ───────────────────────────────────────────────
  {
    id: "industry-chains",
    name: "产业链与节点",
    group: "产业与政策",
    kind: "derived",
    cadence: "ondemand",
    api: "/api/chain/index",
    storage: "industry_chains + chain_nodes 表",
    metric: { table: s.industryChains, cols: [s.industryChains.updatedAt, s.industryChains.createdAt] },
    note: "23 条产业链与 149 个环节节点，站内整理；节点与 ETF 通过代码/关键词互通。",
    risk: "链上公司与 ETF 的对应关系是人工整理，不等同于指数编制方案。",
  },
  {
    id: "chain-metrics",
    name: "产业链经营指标",
    group: "产业与政策",
    kind: "official",
    cadence: "quarterly",
    api: "/api/chain/compare",
    storage: "chain_metrics 表",
    metric: { table: s.chainMetrics, cols: [s.chainMetrics.updatedAt, s.chainMetrics.createdAt] },
    note: "规上工业增加值、营收增速等季度指标，按产业链归并。",
    risk: "官方数据按季度发布且有修订，最新一季可能在下一季度被上修。",
  },
  {
    id: "policies",
    name: "政策库",
    group: "产业与政策",
    kind: "official",
    cadence: "daily",
    api: "页面 /policy",
    storage: "policies 表",
    metric: { table: s.policies, cols: [s.policies.updatedAt, s.policies.createdAt] },
    task: "policy-sync",
    note: "央行/发改委/财政部/证监会等机构发布原文与摘要，由 policy-sync 每日同步。",
    risk: "摘要为站内压缩，正式引用请以 sourceUrl 指向的原文为准。",
  },
  {
    id: "policy-analyses",
    name: "政策 AI 解读",
    group: "产业与政策",
    kind: "derived",
    cadence: "daily",
    api: "页面 /policy/[id]",
    storage: "policy_analyses 表",
    metric: { table: s.policyAnalyses, cols: [s.policyAnalyses.updatedAt, s.policyAnalyses.createdAt] },
    task: "policy-analysis",
    note: "对政策原文的 AI 分析（利好行业、传导链条、关注点），由 policy-analysis 任务生成。",
    risk: "AI 解读属于站内观点，不是官方表述；模型输出不保证与原文完全一致。",
  },
  {
    id: "city-house-price",
    name: "70 城房价指数",
    group: "产业与政策",
    kind: "official",
    cadence: "monthly",
    api: "/api/city/house-price",
    storage: "city_house_price 表",
    metric: { table: s.cityHousePrice, cols: [s.cityHousePrice.fetchedAt, s.cityHousePrice.updatedAt] },
    note: "国家统计局 70 城商品住宅销售价格指数（上月=100 / 上年同月=100），不是成交价。",
    risk: "指数与绝对值容易被混淆；本站全部字段都是指数口径。",
  },
  {
    id: "province-stats",
    name: "省级经济数据",
    group: "产业与政策",
    kind: "official",
    cadence: "yearly",
    api: "页面 /industry",
    storage: "province_stats 表",
    metric: { table: s.provinceStats, cols: [s.provinceStats.updatedAt, s.provinceStats.createdAt] },
    note: "各省 GDP、人均 GDP、人口、财政与进出口，来自统计年鉴。",
    risk: "年鉴口径与快报口径可能不同，跨年对比时注意来源年份。",
  },

  // ── 资讯与历史 ───────────────────────────────────────────────
  {
    id: "news-flash",
    name: "财经快讯",
    group: "资讯与历史",
    kind: "media",
    cadence: "realtime",
    api: "/api/news/flash",
    storage: "东财全球财经快讯",
    stream: true,
    note: "7×24 财经快讯流，用于首页资讯与事件驱动提醒。",
    risk: "媒体快讯可能被后续报道修正，标题不等于最终事实。",
  },
  {
    id: "history-events",
    name: "历史事件档案",
    group: "资讯与历史",
    kind: "derived",
    cadence: "ondemand",
    api: "页面 /history",
    storage: "history_events 表",
    metric: { table: s.historyEvents, cols: [s.historyEvents.updatedAt, s.historyEvents.createdAt] },
    note: "重大市场/政策事件时间轴，站内人工整理。",
    risk: "事件日期与影响描述为整理口径，可能与学术研究存在差异。",
  },
];

/** 顶部摘要 + 明细。 */
export interface ProvenanceItem {
  id: string;
  name: string;
  group: ProvenanceGroup;
  kind: ProvenanceKind;
  cadence: string;
  status: ProvenanceStatus;
  rows: number | null;
  lastUpdated: number | null;
  ageMs: number | null;
  ageText: string;
  api?: string;
  storage?: string;
  note: string;
  risk?: string;
  issue?: string;
}

export interface ProvenanceTask {
  name: string;
  status: string;
  at: number | null;
  ageText: string;
  durationMs: number | null;
  detail: string | null;
}

export interface ProvenanceReport {
  generatedAt: number;
  dbDegraded: boolean;
  dbReason: string | null;
  summary: ProvenanceSummary;
  items: ProvenanceItem[];
  tasks: ProvenanceTask[];
  notes: string[];
  nextActions: string[];
}

const EMPTY_METRIC: Metric = { rows: null, lastUpdated: null };

/** 把各种时间表示统一成毫秒数（整数毫秒 / 秒级数字 / ISO 文本都兼容）。 */
export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 1_000_000_000) {
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

async function collectTableMetric(spec: MetricSpec): Promise<Metric> {
  try {
    const [first, ...rest] = spec.cols;
    // 多个时间列取 coalesce 后再 max：某些表只写 updated_at，某些只写 created_at。
    let ts = sql`${first}`;
    for (const col of rest) ts = sql`coalesce(${ts}, ${col})`;
    const rows = (await db
      .select({ c: sql<number>`count(*)`, m: sql<number>`max(${ts})` })
      .from(spec.table)) as any[];
    const row = rows?.[0] ?? {};
    const count = Number(row.c);
    return {
      rows: Number.isFinite(count) ? count : null,
      lastUpdated: toMillis(row.m),
    };
  } catch {
    return EMPTY_METRIC;
  }
}

async function collectSnapshotMetrics(): Promise<Record<string, Metric>> {
  const metrics: Record<string, Metric> = {};
  try {
    const rows = (await db
      .select({ code: s.marketSnapshots.code, name: s.marketSnapshots.name, detail: s.marketSnapshots.detail, fetchedAt: s.marketSnapshots.fetchedAt })
      .from(s.marketSnapshots)) as any[];
    for (const row of rows ?? []) {
      const code = String(row.code ?? "");
      if (!code) continue;
      let dataAt: number | null = null;
      try {
        const parsed = row.detail ? JSON.parse(String(row.detail)) : null;
        dataAt = toMillis(parsed?.dataAt);
      } catch {
        dataAt = null;
      }
      metrics[code] = { rows: 1, lastUpdated: dataAt ?? toMillis(row.fetchedAt) };
    }
  } catch {
    // 降级时返回空表，条目会显示「不可用」并附原因
  }
  return metrics;
}

function pickSnapshotMetric(metrics: Record<string, Metric>, code?: string, prefix?: string): Metric | null {
  if (code) return metrics[code] ?? null;
  if (!prefix) return null;
  const keys = Object.keys(metrics).filter((k) => k.startsWith(prefix));
  if (keys.length === 0) return null;
  let latest: number | null = null;
  for (const key of keys) {
    const ts = metrics[key]?.lastUpdated;
    if (ts !== null && (latest === null || ts > latest)) latest = ts;
  }
  return { rows: keys.length, lastUpdated: latest };
}

async function collectMonthlyMetric(): Promise<{ metric: Metric; latestYm: string | null }> {
  try {
    const rows = (await db
      .select({ publishDate: s.articles.publishDate, slug: s.articles.slug, createdAt: s.articles.createdAt })
      .from(s.articles)
      .where(sql`${s.articles.type} = 'monthly'`)
      .orderBy(sql`${s.articles.publishDate} desc`)
      .limit(1)) as any[];
    if (!rows || rows.length === 0) return { metric: { rows: 0, lastUpdated: null }, latestYm: null };
    const latest = rows[0];
    return {
      metric: { rows: 1, lastUpdated: toMillis(latest.publishDate) ?? toMillis(latest.createdAt) },
      latestYm: latest.slug ? String(latest.slug).replace(/^macro-/, "") : null,
    };
  } catch {
    return { metric: EMPTY_METRIC, latestYm: null };
  }
}

async function collectTasks(): Promise<ProvenanceTask[]> {
  try {
    const rows = (await db
      .select({
        name: s.taskLogs.taskName,
        status: s.taskLogs.status,
        detail: s.taskLogs.detail,
        createdAt: s.taskLogs.createdAt,
        durationMs: s.taskLogs.durationMs,
      })
      .from(s.taskLogs)
      .where(
        sql`${s.taskLogs.taskName} is not null and ${s.taskLogs.taskName} <> '' and (${s.taskLogs.name} is null or ${s.taskLogs.name} <> '__schema')`
      )
      .orderBy(sql`${s.taskLogs.createdAt} desc`)
      .limit(40)) as any[];

    // 每个任务只保留最近一条，避免页面被同一天多次重跑刷屏
    const seen = new Set<string>();
    const tasks: ProvenanceTask[] = [];
    for (const row of rows ?? []) {
      const name = String(row.name ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      tasks.push({
        name,
        status: String(row.status ?? ""),
        at: toMillis(row.createdAt),
        ageText: formatAge(toMillis(row.createdAt) === null ? null : Date.now() - (toMillis(row.createdAt) as number)),
        durationMs: row.durationMs === null || row.durationMs === undefined ? null : Number(row.durationMs),
        detail: row.detail ? String(row.detail).slice(0, 200) : null,
      });
    }
    return tasks;
  } catch {
    return [];
  }
}

const SEVERITY: Record<ProvenanceStatus, number> = {
  down: 0,
  stale: 1,
  seed: 2,
  delayed: 3,
  live: 4,
  stream: 5,
};

/**
 * 采集全站溯源报告。失败一律降级为「不可用」，不向上抛错。
 */
export async function buildProvenanceReport(): Promise<ProvenanceReport> {
  const nowMs = Date.now();
  const dbDegraded = dbDegradedRecently(120_000);
  const dbReason = dbDegradedReason();

  const tableMetrics: Record<string, Metric> = {};
  await Promise.all(
    DATA_SOURCES.filter((item) => item.metric).map(async (item) => {
      tableMetrics[item.id] = await collectTableMetric(item.metric as MetricSpec);
    })
  );

  const snapshotMetrics = await collectSnapshotMetrics();
  const monthly = await collectMonthlyMetric();
  const tasks = await collectTasks();
  const macroProvenance = await getMacroProvenance().catch(() => null);

  const notes: string[] = [];
  if (dbDegraded) {
    notes.push(`数据库当前处于降级状态${dbReason ? `（${dbReason}）` : ""}：所有依赖数据库的数字都不可信，请恢复数据库后刷新。`);
  }

  const items: ProvenanceItem[] = DATA_SOURCES.map((spec) => {
    const cadence = CADENCE[spec.cadence];
    let metric: Metric | null = null;
    if (spec.id === "monthly-report") metric = monthly.metric;
    else if (spec.metric) metric = tableMetrics[spec.id] ?? EMPTY_METRIC;
    else if (spec.snapshotCode || spec.snapshotPrefix) {
      metric = pickSnapshotMetric(snapshotMetrics, spec.snapshotCode, spec.snapshotPrefix);
    }

    let status: ProvenanceStatus;
    if (spec.fixedStatus) status = spec.fixedStatus;
    else if (spec.stream) status = "stream";
    else status = statusFromMetric(metric ?? EMPTY_METRIC, cadence, nowMs);

    // 宏观指标的特殊口径：查一遍真实来源占比，全部是种子时直接标「示例数据」
    if (spec.id === "macro-indicators" && macroProvenance && macroProvenance.total > 0) {
      if (macroProvenance.synced === 0) status = "seed";
      else if (macroProvenance.seed > 0) {
        // 部分种子不减分级：状态仍按更新时间判断
      }
    }

    const lastUpdated = metric?.lastUpdated ?? null;
    const ageMs = lastUpdated === null ? null : Math.max(0, nowMs - lastUpdated);
    const issues: string[] = [];

    if (!spec.stream && !spec.fixedStatus) {
      if (status === "down") {
        issues.push(
          dbDegraded
            ? "数据库不可用（降级中），暂时读不到这张表。"
            : metric === null
              ? "还没有采集到这张表的数据，或查询失败。"
              : "表里没有数据，任务可能从未成功跑过。"
        );
        if (spec.task) issues.push(`可手动触发：task=${spec.task}。`);
      } else if (status === "stale") {
        issues.push(`已经 ${formatAge(ageMs)} 没有更新，超过「${cadence.label}」节奏。`);
      } else if (status === "delayed") {
        issues.push(`更新比预期慢（${formatAge(ageMs)} 前），但还没到陈旧阈值。`);
      }
    }

    if (spec.fixedNote) issues.push(spec.fixedNote);

    if (spec.id === "macro-indicators" && macroProvenance && macroProvenance.total > 0) {
      if (macroProvenance.seed > 0) {
        issues.push(`${macroProvenance.seed} / ${macroProvenance.total} 条指标仍是示例序列，卡片上会单独标注。`);
      }
      if (macroProvenance.synced > 0) {
        notes.push(`宏观指标：${macroProvenance.synced} / ${macroProvenance.total} 条来自真实来源，最近同步 ${formatAge(macroProvenance.lastSyncedAt === null ? null : nowMs - macroProvenance.lastSyncedAt)}。`);
      }
    }

    if (spec.id === "monthly-report") {
      if (monthly.latestYm) issues.push(`最新一篇覆盖 ${monthly.latestYm}。`);
      else issues.push("还没有任何月报。");
    }

    // 关联定时任务：最近一次失败要显示在对应数据集上
    if (spec.task) {
      const task = tasks.find((t) => t.name === spec.task);
      if (task && task.status === "failed" && typeof task.at === "number" && nowMs - task.at < 24 * 3600_000) {
        issues.push(`最近一次 ${spec.task} 于 ${formatAge(nowMs - task.at)}失败。`);
      }
    }

    if (status === "seed") issues.push("当前展示的是示例数据，不是真实来源。");

    return {
      id: spec.id,
      name: spec.name,
      group: spec.group,
      kind: spec.kind,
      cadence: cadence.label,
      status,
      rows: metric?.rows ?? null,
      lastUpdated,
      ageMs,
      ageText: lastUpdated === null ? "—" : formatAge(ageMs),
      api: spec.api,
      storage: spec.storage,
      note: spec.note,
      risk: spec.risk,
      issue: issues.length > 0 ? issues.join(" ") : undefined,
    };
  });

  const summary = summarizeProvenance(items);

  if (summary.seed > 0) {
    notes.push(`${summary.seed} 个数据集仍是示例数据：图表会照常展示，但不能当作真实统计。`);
  }

  const failedRecently = tasks.filter(
    (t) => t.status === "failed" && typeof t.at === "number" && nowMs - t.at < 48 * 3600_000
  );
  if (failedRecently.length > 0) {
    notes.push(`最近 48 小时有 ${failedRecently.length} 个任务失败：${failedRecently.map((t) => t.name).join("、")}。`);
  }

  const nextActions: string[] = [];
  const ranked = items
    .filter((item) => needsAttention(item.status))
    // 固定状态（如上游已停止披露的北向资金）不是故障，不需要用户动手
    .filter((item) => !DATA_SOURCES.find((spec) => spec.id === item.id)?.fixedStatus)
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || (b.ageMs ?? 0) - (a.ageMs ?? 0));
  for (const item of ranked.slice(0, 4)) {
    const spec = DATA_SOURCES.find((s2) => s2.id === item.id);
    const action = spec?.task ? `重跑 task=${spec.task}` : "检查上游接口与存储";
    nextActions.push(`${item.name}：${item.issue ?? "需要人工确认"} → ${action}`);
  }

  return {
    generatedAt: nowMs,
    dbDegraded,
    dbReason,
    summary,
    items,
    tasks,
    notes,
    nextActions,
  };
}

/**
 * 60 秒缓存版本；数据库降级时不写缓存（降级空结果不能固化 60 秒）。
 */
export async function getProvenanceReport(): Promise<ProvenanceReport> {
  return cached("provenance:report", 60_000, buildProvenanceReport, {
    skipIf: () => dbDegradedRecently(60_000),
  });
}

/** 给其它页面用的轻量摘要：只返回计数与需关注项，避免每个页面都拉全量明细。 */
export async function getProvenanceSummary(): Promise<{
  summary: ProvenanceSummary;
  generatedAt: number;
  problems: Array<{ name: string; status: ProvenanceStatus; issue?: string }>;
}> {
  const report = await getProvenanceReport();
  return {
    summary: report.summary,
    generatedAt: report.generatedAt,
    problems: report.items
      .filter((item) => needsAttention(item.status))
      .map((item) => ({ name: item.name, status: item.status, issue: item.issue })),
  };
}

export type { ProvenanceSummary };
