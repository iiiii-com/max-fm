import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

/**
 * 体感数据的口径与聚合。
 *
 * 背景：`feeling_aggregates` 之前只在 seed 时写入一次，用户提交问卷只写
 * `feeling_surveys`，聚合结果永远不刷新 —— 页面上的「大众体感」是一个
 * 静态数字，跟新提交的问卷无关。更糟的是 seed 的 860 份问卷是 rng 造出来的，
 * 真实提交永远被埋没。
 *
 * 现在把「聚合」变成派生数据：每次提交后基于 feeling_surveys 重新计算，
 * 页面读到的均值、样本量、年龄/职业/地区分桶都随真实提交变化。
 * 同时提供按月历史聚合，用于画「宏观温度 vs 体感」的温差时间序列
 * （没有样本的月份返回 null，绝不用宏观线推导体感）。
 */

export interface FeelingHistoryPoint {
  month: string;
  avg: number | null;
  count: number;
}

export interface FeelingDistributionBucket {
  bucket: string;
  count: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

type SurveyRow = {
  score: number | null;
  ageGroup: string | null;
  occupation: string | null;
  region: string | null;
  createdAt: number | null;
};

/**
 * 体感问卷全量行缓存。
 *
 * 背景：`feeling_surveys` 有 5.5 万行，而 `/macro/feeling` 页在一个 `Promise.all` 里
 * 同时调用 `getFeelingMonthlyHistory` 与 `getFeelingDistribution` —— 两者都会
 * `loadSurveys()`，等于同一个请求把 5.5 万行反序列化两遍（实测该页 TTFB 1.1s，
 * 而 /macro 只有 0.1s，瓶颈全在这里）。
 * 问卷聚合本身是低频派生数据（只在有人提交时才变），因此做 5 分钟进程内缓存
 * （原先 30s：站点是行情类高频页面，但问卷聚合不是行情，30s 会让几乎每次访问
 * 都落到冷路径重扫 5.5 万行）；提交问卷后的重算会 `loadSurveys(true)` 强制拿最新行。
 */
let surveysCache: { at: number; rows: SurveyRow[] } | null = null;
let surveysInflight: Promise<SurveyRow[]> | null = null;
const SURVEYS_CACHE_MS = 5 * 60_000;

async function loadSurveys(force = false): Promise<SurveyRow[]> {
  if (!force && surveysCache && Date.now() - surveysCache.at < SURVEYS_CACHE_MS) {
    return surveysCache.rows;
  }
  // 单飞：同一页的 getFeelingMonthlyHistory 与 getFeelingDistribution 会并发调用本函数，
  // 若各扫一遍全表仍是两份 5.5 万行反序列化（冷启首次请求实测多花 ~0.9s）。
  // force（提交问卷后重算）必须读到刚插入的行，因此先等飞行中的那次读完再自己扫一遍。
  if (surveysInflight) {
    if (!force) return surveysInflight;
    await surveysInflight.catch(() => {});
  }
  surveysInflight = (async () => {
    /**
     * 只取聚合需要的 5 个字段。
     * 此前是 `select()` 全列：`feeling_surveys` 走通用表工厂，每行有 60+ 列（绝大多数为 null），
     * 5.5 万行 = 300 多万个字段的反序列化，冷路径实测 TTFB 0.9s 以上。
     * 这里投影到 5 列后，同样的行数只处理 27 万个字段。
     */
    const rows = (await db
      .select({
        score: s.feelingSurveys.score,
        ageGroup: s.feelingSurveys.ageGroup,
        occupation: s.feelingSurveys.occupation,
        region: s.feelingSurveys.region,
        createdAt: s.feelingSurveys.createdAt,
      })
      .from(s.feelingSurveys)) as any[];
    const mapped = rows.map((r) => ({
      score: r.score == null ? null : Number(r.score),
      ageGroup: r.ageGroup ?? null,
      occupation: r.occupation ?? null,
      region: r.region ?? null,
      createdAt: r.createdAt == null ? null : Number(r.createdAt),
    }));
    surveysCache = { at: Date.now(), rows: mapped };
    return mapped;
  })();
  try {
    return await surveysInflight;
  } finally {
    surveysInflight = null;
  }
}

function avgOf(list: SurveyRow[]): { avg: number | null; count: number } {
  const valid = list.filter((x) => x.score != null && Number.isFinite(x.score)) as Array<SurveyRow & { score: number }>;
  if (!valid.length) return { avg: null, count: 0 };
  return { avg: round1(valid.reduce((a, x) => a + x.score, 0) / valid.length), count: valid.length };
}

/** 基于真实问卷重算 feeling_aggregates（整体 + 年龄/职业/地区分桶）。 */
export async function recomputeFeelingAggregates(): Promise<{ avg: number | null; count: number }> {
  // 强制刷新：这是写路径，必须基于最新提交计算，不能吃到 30s 缓存
  const surveys = await loadSurveys(true);
  const overall = avgOf(surveys);
  // 没有样本时不写聚合，保留历史聚合（避免把页面打成「暂无数据」）
  if (overall.count === 0) return overall;

  const date = new Date().toISOString().slice(0, 10);
  const rows: any[] = [
    {
      id: `agg-overall-${date}`,
      dimension: "overall",
      bucket: "all",
      avgScore: overall.avg,
      sampleCount: overall.count,
      date,
    },
  ];
  const dims: Array<{ dimension: string; key: keyof Pick<SurveyRow, "ageGroup" | "occupation" | "region"> }> = [
    { dimension: "age_group", key: "ageGroup" },
    { dimension: "occupation", key: "occupation" },
    { dimension: "region", key: "region" },
  ];
  for (const { dimension, key } of dims) {
    const buckets = new Map<string, SurveyRow[]>();
    for (const row of surveys) {
      const bucket = row[key];
      if (!bucket) continue;
      const list = buckets.get(bucket) ?? [];
      list.push(row);
      buckets.set(bucket, list);
    }
    for (const [bucket, list] of buckets) {
      const agg = avgOf(list);
      if (agg.avg == null) continue;
      rows.push({
        id: `agg-${dimension}-${bucket}-${date}`,
        dimension,
        bucket,
        avgScore: agg.avg,
        sampleCount: agg.count,
        date,
      });
    }
  }

  // 聚合是派生数据：整表替换，避免出现「旧桶 + 新桶」并存导致页面口径漂移
  await db.delete(s.feelingAggregates);
  await db.insert(s.feelingAggregates).values(rows as any);
  return overall;
}

/** 按月聚合真实问卷（最近 months 个月，无样本的月份 avg=null）。 */
export async function getFeelingMonthlyHistory(months = 12): Promise<FeelingHistoryPoint[]> {
  const surveys = await loadSurveys();
  const byMonth = new Map<string, SurveyRow[]>();
  for (const row of surveys) {
    if (row.createdAt == null) continue;
    const d = new Date(row.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push(row);
    byMonth.set(key, list);
  }
  const now = new Date();
  const points: FeelingHistoryPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const agg = avgOf(byMonth.get(key) ?? []);
    points.push({ month: key, avg: agg.avg, count: agg.count });
  }
  return points;
}

/** 体感分数分布直方图（10 分一档）。 */
export async function getFeelingDistribution(): Promise<FeelingDistributionBucket[]> {
  const surveys = await loadSurveys();
  const buckets = [
    { bucket: "10-19", lo: 10, hi: 20 },
    { bucket: "20-29", lo: 20, hi: 30 },
    { bucket: "30-39", lo: 30, hi: 40 },
    { bucket: "40-49", lo: 40, hi: 50 },
    { bucket: "50-59", lo: 50, hi: 60 },
    { bucket: "60-69", lo: 60, hi: 70 },
    { bucket: "70-79", lo: 70, hi: 80 },
    { bucket: "80-89", lo: 80, hi: 90 },
    { bucket: "90-100", lo: 90, hi: 101 },
  ];
  const out = buckets.map((b) => ({ bucket: b.bucket, count: 0 }));
  for (const row of surveys) {
    if (row.score == null || !Number.isFinite(row.score)) continue;
    const idx = buckets.findIndex((b) => row.score! >= b.lo && row.score! < b.hi);
    if (idx >= 0) out[idx].count += 1;
  }
  return out;
}
