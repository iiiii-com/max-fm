import { and, desc, eq } from "drizzle-orm";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getIndicators, getTemperatures, getFeelingAggregates } from "@/lib/data/queries";
import { MACRO_INDICATORS, type MacroIndicatorDef } from "@/lib/data/macro-indicators";
import { computeMacroTemperature } from "@/lib/data/macro-sync";
import { aiGenerateOrFallback, hasAI } from "@/lib/ai";
import { normalizeIndicatorDate } from "@/lib/utils";

/**
 * AI 宏观月报：数据组装 + 生成 + 幂等落库。
 *
 * 旧实现有三个问题：
 * 1) task=all 每天跑一次 macroMonthly，每次都 insert 一条 slug=`macro-YYYY-MM`，
 *    同一个月的报告会堆积 30 条重复文章（月报页取 articles[0]，正文页按 slug 取第一条）；
 * 2) 月报只喂给 AI 三个指标（GDP/CPI/PMI），24 项真实序列完全没用上；
 * 3) 没有月度专用 cron，也没有「本月还没生成」的状态，用户看到的是上一次的旧内容。
 *
 * 现在：数据来自全部 24 项指标 + 宏观温度（含三因子）+ 体感均值/温差，
 * 按 slug 唯一落库（存在则覆盖、重复则清理），任何入口调用都幂等。
 */

export interface MonthlyIndicatorRow {
  type: string;
  title: string;
  unit: string;
  group: string;
  value: number;
  date: string;
  prevValue: number | null;
  prevDate: string | null;
}

export interface MonthlyTemperatureInfo {
  temperature: number | null;
  date: string | null;
  raw: { pmi: number | null; cpi: number | null; m2: number | null } | null;
  scores: { pmi: number; cpi: number; m2: number } | null;
  series: Array<{ date: string; temperature: number }>;
}

export interface MonthlyFeelingInfo {
  overall: number | null;
  sampleCount: number;
  diff: number | null;
}

export interface MonthlyReportData {
  ym: string;
  monthLabel: string;
  generatedAt: string;
  indicators: MonthlyIndicatorRow[];
  byType: Record<string, MonthlyIndicatorRow | undefined>;
  temperature: MonthlyTemperatureInfo;
  feeling: MonthlyFeelingInfo;
}

// 月/日口径的纯函数抽到 lib/data/ym.ts：它们出过真实事故（UTC 服务器上 1 日 00:00–08:00
// 被算成上个月、历史月报发布时间用了生成当天、prevYm 1 月没回退上一年），
// 抽出来后可以脱离数据库直接单测（tests/ym.test.ts）。
// 这里继续 re-export，保持既有引用路径不变。
export { currentYm, prevYm, monthLabel, lastDayOfMonth } from "./ym";
import {
  cstToday as ymCstToday,
  currentYm as ymCurrentYm,
  lastDayOfMonth as ymLastDayOfMonth,
  monthLabel as ymMonthLabel,
  prevYm as ymPrevYm,
} from "./ym";

const round2 = (n: number) => Math.round(n * 100) / 100;

function fmtValue(v: number | null, unit: string): string {
  if (v == null) return "—";
  if (unit === "%" || unit === "个百分点" || unit === "") return `${round2(v)}${unit === "%" ? "%" : ""}`;
  return `${round2(v)}${unit}`;
}


/**
 * 指标日期比较键：把季度（2026-Q3）折算成季末月份（2026-09）。
 * 直接字符串比较会得出 "2026-Q3" > "2026-10-31"（'Q' > '1'），
 * 导致 10 月月报把当年三季度数据排除在外、回退到 2025-Q4
 * （实测：修复前 2026-10 月报里 GDP 写着「5%（2025-Q4）」）。
 */
function indicatorDateKey(date: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(date);
  if (q) return `${q[1]}-${String(Number(q[2]) * 3).padStart(2, "0")}`;
  return date;
}

/** 组装某一期的月报数据（默认当月）。全部数字来自 DB，不做任何推导填充。 */
export async function buildMonthlyReportData(ym = ymCurrentYm()): Promise<MonthlyReportData> {
  /**
   * 只取「该月及以前」的数据。
   * 旧实现忽略了 ym 形参，无论生成哪一期都取「最新一行」，
   * 结果 6 月月报里写的是 9 月的 CPI/PMI（补生成历史月报时尤其离谱）。
   * 这里用字符串比较（yyyy-mm-dd 与 yyyy-mm-31 同序）做上界。
   */
  const ymEnd = `${ym}-31`;
  const isCurrent = ym >= ymCurrentYm();
  const [inds, temps, feeling, temperature] = await Promise.all([
    getIndicators(),
    getTemperatures(),
    getFeelingAggregates(),
    computeMacroTemperature(),
  ]);

  const seriesByType = new Map<string, Array<{ date: string; value: number }>>();
  for (const row of inds as any[]) {
    if (row.value == null || !row.type) continue;
    const date = normalizeIndicatorDate(String(row.date ?? ""));
    if (!date || indicatorDateKey(date) > ymEnd) continue;
    const list = seriesByType.get(row.type) ?? [];
    list.push({ date, value: Number(row.value) });
    seriesByType.set(row.type, list);
  }

  const indicators: MonthlyIndicatorRow[] = [];
  for (const def of MACRO_INDICATORS) {
    const list = seriesByType.get(def.type);
    if (!list || !list.length) continue;
    list.sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    const prev = list[list.length - 2] ?? null;
    indicators.push({
      type: def.type,
      title: def.title,
      unit: def.unit,
      group: def.group,
      value: round2(last.value),
      date: last.date,
      prevValue: prev ? round2(prev.value) : null,
      prevDate: prev?.date ?? null,
    });
  }
  const byType: Record<string, MonthlyIndicatorRow | undefined> = Object.fromEntries(
    indicators.map((i) => [i.type, i]),
  );

  const tempSeries = (temps as any[])
    .map((t) => ({ date: String(t.date ?? ""), temperature: Number(t.temperature) }))
    .filter((t) => t.date && t.date <= ymEnd && Number.isFinite(t.temperature))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12);
  const latestTemp = tempSeries[tempSeries.length - 1] ?? null;
  let raw: MonthlyTemperatureInfo["raw"] = null;
  let scores: MonthlyTemperatureInfo["scores"] = null;
  const latestRow = (temps as any[]).find((t) => String(t.date ?? "") === latestTemp?.date) as any;
  if (latestRow?.components) {
    try {
      const parsed = JSON.parse(String(latestRow.components));
      raw = parsed?.raw ?? null;
      scores = parsed?.scores ?? null;
    } catch {
      // components 是可选解释字段，解析失败不影响温度本身
    }
  }
  const temperatureInfo: MonthlyTemperatureInfo = {
    // 历史月报不能用「今天」的实时温度，只能用该月最后一期温度
    temperature: (isCurrent ? temperature.temperature : null) ?? latestTemp?.temperature ?? null,
    date: (isCurrent ? temperature.date : null) ?? latestTemp?.date ?? null,
    raw: raw ?? (isCurrent ? temperature.raw : null) ?? null,
    scores: scores ?? (isCurrent ? temperature.scores : null) ?? null,
    series: tempSeries,
  };

  const feelingOverall = feeling.overall;
  const tempValue = temperatureInfo.temperature;
  const diff =
    tempValue != null && feelingOverall != null && feeling.sampleCount > 0
      ? Math.round(tempValue - Number(feelingOverall))
      : null;

  return {
    ym,
    monthLabel: ymMonthLabel(ym),
    generatedAt: new Date().toISOString(),
    indicators,
    byType,
    temperature: temperatureInfo,
    feeling: { overall: feelingOverall == null ? null : Number(feelingOverall), sampleCount: feeling.sampleCount, diff },
  };
}

function indicatorLine(data: MonthlyReportData, type: string): string {
  const row = data.byType[type];
  return row ? `${row.title} ${fmtValue(row.value, row.unit)}（${row.date}）` : "";
}

function heatWord(t: number | null): string {
  if (t == null) return "暂无读数";
  if (t < 35) return "偏冷";
  if (t < 45) return "中性偏冷";
  if (t < 55) return "中性";
  if (t < 65) return "中性偏暖";
  if (t < 75) return "偏暖";
  return "偏热";
}

function buildHighlights(data: MonthlyReportData): string[] {
  const out: string[] = [];
  const pmi = data.byType["pmi"];
  if (pmi) {
    out.push(
      pmi.value >= 50
        ? `制造业 PMI ${fmtValue(pmi.value, "")}，位于荣枯线之上，景气度处于扩张区间。`
        : `制造业 PMI ${fmtValue(pmi.value, "")}，低于 50 荣枯线，生产与订单仍需政策托底。`,
    );
  }
  const cpi = data.byType["cpi"];
  if (cpi) {
    out.push(
      cpi.value < 0
        ? `CPI 同比 ${fmtValue(cpi.value, "%")}，物价仍在负区间，需求端偏弱、实际利率偏高。`
        : `CPI 同比 ${fmtValue(cpi.value, "%")}，物价温和，暂未形成全面通胀压力。`,
    );
  }
  const m2 = data.byType["m2"];
  if (m2) out.push(`M2 同比 ${fmtValue(m2.value, "%")}，货币供给保持${m2.value >= 8 ? "相对充裕" : "中性偏紧"}，关注与社融的剪刀差。`);
  const unemp = data.byType["unemp"];
  if (unemp) out.push(`城镇调查失业率 ${fmtValue(unemp.value, "%")}，就业是消费与内需修复的前置变量。`);
  const exp = data.byType["export"];
  if (exp) out.push(`出口同比 ${fmtValue(exp.value, "%")}，外需强弱直接影响制造业订单与汇率预期。`);
  return out.slice(0, 3);
}

/** 无 AI 时的兜底正文：数字全部来自当期数据，不给结论性投资建议。 */
export function buildMonthlyFallback(data: MonthlyReportData): string {
  const t = data.temperature.temperature;
  const tempLine =
    t == null
      ? "宏观温度本期暂无读数。"
      : `宏观温度 ${t}°（${heatWord(t)}），由 PMI/CPI/M2 三因子加权得出${
          data.temperature.scores
            ? `：PMI 分 ${data.temperature.scores.pmi}、CPI 分 ${data.temperature.scores.cpi}、M2 分 ${data.temperature.scores.m2}`
            : ""
        }。`;
  const feelingLine =
    data.feeling.overall == null || data.feeling.sampleCount === 0
      ? "体感问卷样本不足，温差暂不可计算（不填充默认值）。"
      : `大众体感 ${Math.round(Number(data.feeling.overall))}°（${data.feeling.sampleCount} 份问卷均值），与宏观温度相差 ${
          data.feeling.diff != null && data.feeling.diff > 0 ? "+" : ""
        }${data.feeling.diff ?? "—"}°。`;

  const coreRows = data.indicators
    .filter((i) => ["gdp", "cpi", "ppi", "pmi", "m2", "tsf", "unemp", "export", "retail", "lpr"].includes(i.type))
    .map((i) => `| ${i.title} | ${fmtValue(i.value, i.unit)} | ${i.date} |`)
    .join("\n");

  const highlights = buildHighlights(data);
  const trend = data.temperature.series
    .slice(-6)
    .map((p) => `${p.date} ${p.temperature}°`)
    .join(" → ");

  return `# 宏观月报（${data.monthLabel}）

## 一句话总结

${tempLine}${feelingLine}

## 核心数据

| 指标 | 最新值 | 数据期 |
|---|---|---|
${coreRows}

## 三大看点

${highlights.length ? highlights.map((h, i) => `${i + 1}. ${h}`).join("\n") : "1. 本期核心指标数据尚不完整，等待最新披露后更新。"}

## 温度轨迹

近 6 期宏观温度：${trend || "—"}。

## 风险与展望

- 价格与需求端数据的分化仍在延续，单月数据不宜外推成趋势。
- 外部环境（外需、汇率）与地产链修复节奏是后续主要变量。
- 本报告由站内真实指标序列自动组装；AI 可用时生成解读，不可用时以本数据摘要兜底。

*本报告由 Max 自动生成，数据来自东方财富数据中心等公开报表，不构成投资建议。*`;
}

export function buildMonthlyPrompt(data: MonthlyReportData): string {
  const t = data.temperature;
  const table = data.indicators
    .map((i) => `${i.title}=${fmtValue(i.value, i.unit)}(${i.date}${i.prevValue != null ? `, 上期 ${fmtValue(i.prevValue, i.unit)}` : ""})`)
    .join("；");
  return `你是宏观研究员。请基于下方真实数据生成《宏观月报》Markdown，报告期 ${data.monthLabel}，600-900 字。

硬性要求：
1. 只能使用给定数字，不得编造任何未提供的数值；引用数字时必须与给定值一致。
2. 结构：## 一句话总结 / ## 核心数据（表格）/ ## 宏观温度与体感温差 / ## 三大看点 / ## 风险与展望。
3. 温度口径：宏观温度 = 0.4×PMI 分 + 0.35×CPI 分 + 0.25×M2 分（0-100，越高越暖）。
4. 温差口径：宏观温度 − 体感均值；若无体感样本，必须写「样本不足，温差暂不可计算」，不得编造。
5. 结尾加免责声明：内容由 AI 生成，不构成投资建议。

指标数据：${table}
宏观温度：${t.temperature == null ? "暂无" : `${t.temperature}°（${heatWord(t.temperature)}）`}；三因子得分：${t.scores ? `PMI ${t.scores.pmi} / CPI ${t.scores.cpi} / M2 ${t.scores.m2}` : "暂无"}；原始值：${t.raw ? `PMI ${t.raw.pmi} / CPI ${t.raw.cpi} / M2 ${t.raw.m2}` : "暂无"}。
温度历史（近 12 期）：${t.series.map((p) => `${p.date}=${p.temperature}°`).join("，") || "暂无"}。
体感：${data.feeling.overall == null ? "暂无样本" : `均值 ${Math.round(Number(data.feeling.overall))}°，样本 ${data.feeling.sampleCount} 份`}，温差：${data.feeling.diff == null ? "暂不可计算" : `${data.feeling.diff > 0 ? "+" : ""}${data.feeling.diff}°`}。`;
}

export interface MonthlyArticleView {
  slug: string;
  title: string;
  summary: string | null;
  publishDate: string | null;
  updatedAt: number | null;
  ym: string;
  sourceModel: string | null;
}

function ymOfSlug(slug: string): string {
  return slug.replace(/^macro-/, "");
}

/** 按月份取唯一一条月报（历史数据可能有重复 slug，取最新一条）。 */
export async function getMonthlyArticle(ym: string): Promise<any | null> {
  const rows = (await db
    .select()
    .from(s.articles)
    .where(and(eq(s.articles.type, "monthly"), eq(s.articles.slug, `macro-${ym}`)))) as any[];
  if (!rows.length) return null;
  return rows.sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0))[0];
}

/** 月报历史（按月份降序，去重）。 */
export async function getMonthlyArticles(limit = 12): Promise<MonthlyArticleView[]> {
  const rows = (await db
    .select()
    .from(s.articles)
    .where(eq(s.articles.type, "monthly"))
    .orderBy(desc(s.articles.publishDate))) as any[];
  const seen = new Set<string>();
  const out: MonthlyArticleView[] = [];
  for (const row of rows) {
    const slug = String(row.slug ?? "");
    if (!slug.startsWith("macro-") || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      slug,
      title: String(row.title ?? ""),
      summary: row.summary ?? null,
      publishDate: row.publishDate ?? null,
      updatedAt: row.updatedAt ?? null,
      ym: ymOfSlug(slug),
      sourceModel: row.sourceModel ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export interface GenerateMonthlyResult {
  ok: boolean;
  ym: string;
  slug: string;
  created: boolean;
  updated: boolean;
  usedAI: boolean;
  article: MonthlyArticleView | null;
  message: string;
}

/**
 * 生成并落库某月月报（幂等）。
 * - 默认当月；若该月已有月报则直接返回，不重复调用 AI（cron 每天跑也不烧 token）；
 * - force=true 时重新生成并覆盖；
 * - 写入前清理该 slug 的全部历史重复行，保证「一个月一条」。
 */
export async function generateMonthlyReport(opts: { force?: boolean; ym?: string } = {}): Promise<GenerateMonthlyResult> {
  const ym = opts.ym ?? ymCurrentYm();
  const slug = `macro-${ym}`;
  const existing = await getMonthlyArticle(ym);
  // 已存在时通常跳过（cron 每天跑也不烧 token）。两个例外会自动重生成：
  // 1) force=true；2) 旧版本是数据模板（AI 当时不可用），现在 AI 可用了就升级成 AI 稿，
  // 否则用户会一直看到一份「模板月报」而永远等不到 AI 版本。
  const canUpgrade = existing?.sourceModel === "template" && hasAI();
  if (existing && !opts.force && !canUpgrade) {
    return {
      ok: true,
      ym,
      slug,
      created: false,
      updated: false,
      usedAI: false,
      article: {
        slug,
        title: String(existing.title ?? ""),
        summary: existing.summary ?? null,
        publishDate: existing.publishDate ?? null,
        updatedAt: existing.updatedAt ?? null,
        ym,
        sourceModel: existing.sourceModel ?? null,
      },
      message: `${ymMonthLabel(ym)} 月报已存在，跳过重复生成`,
    };
  }

  const data = await buildMonthlyReportData(ym);
  const fallback = buildMonthlyFallback(data);
  const content = await aiGenerateOrFallback(buildMonthlyPrompt(data), fallback, { model: "strong", maxTokens: 2600 });
  const aiUsed = hasAI() && content !== fallback;
  const title = `宏观月报：${data.monthLabel} 经济数据全景解读`;
  const summary = `宏观温度 ${data.temperature.temperature ?? "—"}°（${heatWord(data.temperature.temperature)}）· PMI ${
    data.byType["pmi"] ? fmtValue(data.byType["pmi"].value, "") : "—"
  } · CPI ${data.byType["cpi"] ? fmtValue(data.byType["cpi"].value, "%") : "—"} · 覆盖 ${data.indicators.length} 项宏观指标`;
  const today = ymCstToday();
  // 补生成的历史月报用「该月最后一天」作为发布时间，保证月报列表按时间倒序时旧月在前，
  // 也不会出现「9 月报告比 8 月报告还新」这种排序怪象。
  const publishDate = ym < ymCurrentYm() ? ymLastDayOfMonth(ym) : today;

  // 先清掉同 slug 的历史重复行（旧实现 task=all 每天 insert 留下的），再写唯一一条
  await db.delete(s.articles).where(and(eq(s.articles.type, "monthly"), eq(s.articles.slug, slug)));
  await db.insert(s.articles).values({
    id: uid("art"),
    type: "monthly",
    slug,
    title,
    summary,
    content,
    tags: JSON.stringify(["宏观", "月报"]),
    sourceModel: aiUsed ? "auto" : "template",
    qualityScore: "85",
    status: "published",
    publishDate,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  } as any);

  const saved = await getMonthlyArticle(ym);
  return {
    ok: true,
    ym,
    slug,
    created: !existing,
    updated: !!existing,
    usedAI: aiUsed,
    article: saved
      ? {
          slug,
          title: String(saved.title ?? ""),
          summary: saved.summary ?? null,
          publishDate: saved.publishDate ?? null,
          updatedAt: saved.updatedAt ?? null,
          ym,
          sourceModel: saved.sourceModel ?? null,
        }
      : null,
    message: existing ? `${ymMonthLabel(ym)} 月报已重新生成并覆盖` : `${ymMonthLabel(ym)} 月报已生成`,
  };
}

/**
 * 「月报准时更新」的兜底：任何一次定时任务执行都保证
 *  ① 当月月报存在；
 *  ② 每月 1–5 日额外补齐上个月月报（上个月数据此刻才算齐，不能等下次触发）。
 * 幂等：已存在即跳过，不会重复烧 AI token。
 */
export async function ensureMonthlyReports(opts: { force?: boolean } = {}): Promise<Array<{ ym: string; created: boolean; message: string }>> {
  const ym = ymCurrentYm();
  const targets = [ym];
  const dayOfMonth = Number(ymCstToday().slice(8, 10));
  if (dayOfMonth <= 5) targets.push(ymPrevYm(ym));

  const out: Array<{ ym: string; created: boolean; message: string }> = [];
  for (const target of targets) {
    const existing = await getMonthlyArticle(target);
    const isTemplate = existing?.sourceModel === "template" && hasAI();
    if (existing && !opts.force && !isTemplate) {
      out.push({ ym: target, created: false, message: `${ymMonthLabel(target)} 月报已存在` });
      continue;
    }
    const res = await generateMonthlyReport({ ym: target, force: opts.force });
    out.push({ ym: target, created: res.created || res.updated, message: res.message });
  }
  return out;
}

export type { MacroIndicatorDef };
