import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { emJson } from "./eastmoney";

const BASE = "https://datacenter-web.eastmoney.com/api/data/v1/get";

const DEFS: Array<{
  type: string;
  name: string;
  report: string;
  field: string;
  quarter?: boolean;
  category?: string;
  /** 原始值换算系数：东财贷款/投资类报表单位是「亿元」，指标定义单位是「万亿」时用 1e-4 */
  scale?: number;
  /** 写入行上的展示单位；缺省为 "%" */
  unit?: string;
}> = [
  { type: "gdp", name: "GDP 同比增速", report: "RPT_ECONOMY_GDP", field: "SUM_SAME", quarter: true, category: "总量" },
  { type: "cpi", name: "CPI 同比", report: "RPT_ECONOMY_CPI", field: "NATIONAL_SAME", category: "物价" },
  { type: "ppi", name: "PPI 同比", report: "RPT_ECONOMY_PPI", field: "BASE_SAME", category: "物价" },
  { type: "pmi", name: "制造业 PMI", report: "RPT_ECONOMY_PMI", field: "MAKE_INDEX", category: "景气" },
  { type: "m2", name: "M2 同比增速", report: "RPT_ECONOMY_CURRENCY_SUPPLY", field: "BASIC_CURRENCY_SAME", category: "货币" },
  { type: "m1", name: "M1 同比增速", report: "RPT_ECONOMY_CURRENCY_SUPPLY", field: "CURRENCY_SAME", category: "货币" },
  { type: "fin", name: "全国税收收入同比", report: "RPT_ECONOMY_TAX", field: "TAX_INCOME_SAME", category: "财政" },
  // 以下四项为 2026-10-29 逐个 reportName 实测确认可用的真实序列（其余 report 名东财已下线/未公开）。
  // 海关总署：出口/进口金额同比（EXIT_BASE_SAME / IMPORT_BASE_SAME，单位 %）。
  { type: "export", name: "出口同比", report: "RPT_ECONOMY_CUSTOMS", field: "EXIT_BASE_SAME", category: "外贸" },
  { type: "import", name: "进口同比", report: "RPT_ECONOMY_CUSTOMS", field: "IMPORT_BASE_SAME", category: "外贸" },
  // 固定资产投资完成额：BASE_SAME 为同比（BASE 当月值 / BASE_ACCUMULATE 年内累计，单位亿元）。
  { type: "invest", name: "固定资产投资同比", report: "RPT_ECONOMY_ASSET_INVEST", field: "BASE_SAME", category: "总量" },
  // 新增人民币贷款：RMB_LOAN 当月值单位亿元，指标定义单位万亿 → scale 1e-4（12734 亿 = 1.27 万亿）。
  { type: "loans", name: "新增人民币贷款", report: "RPT_ECONOMY_RMB_LOAN", field: "RMB_LOAN", category: "货币", scale: 0.0001, unit: "万亿" },
];

/** 单次同步结果：count=写入行数；error 存在表示该指标本轮未更新（其余指标照常写入） */
export interface MacroSyncResult {
  type: string;
  count: number;
  error?: string;
}

/** 东财数据中心单页拉取：带超时 + 1 次重试，避免偶发 socket 重置让整轮同步失败 */
async function fetchPage(report: string, page: number, size: number): Promise<any[]> {
  const url = `${BASE}?reportName=${report}&columns=ALL&pageNumber=${page}&pageSize=${size}&sortColumns=REPORT_DATE&sortTypes=-1`;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`eastmoney ${report} status ${res.status}`);
      const json = await res.json();
      if (!json?.success) throw new Error(`eastmoney ${report} failed`);
      return json.result?.data || [];
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw lastErr;
}

async function fetchAll(report: string, max = 300): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 1; ; page++) {
    const batch = await fetchPage(report, page, 100);
    rows.push(...batch);
    if (batch.length < 100 || rows.length >= max) break;
    if (page > 10) break;
  }
  return rows.slice(0, max);
}

function toDate(iso: string, quarter: boolean): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (quarter) return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 同步宏观指标真实序列。
 *
 * 旧实现：任一指标（或 append 的房价/汇率序列）抛错就整轮中断，
 * 于是「某个报告接口抽风」会让一次 task=all 全部白跑，库里继续留着种子数据。
 * 现在每个指标独立 try/catch，失败的记 error 交给调用方展示，其余照常落库。
 * 这样跑通一次就能把绝大多数指标换成真实序列。
 */
export async function syncMacroReal(): Promise<MacroSyncResult[]> {
  const results: MacroSyncResult[] = [];
  for (const def of DEFS) {
    try {
      const raw = await fetchAll(def.report);
      const rows = raw
        .map((r: any) => {
          const date = toDate(r.REPORT_DATE, !!def.quarter);
          const rawValue = Number(r[def.field]);
          if (!date || !Number.isFinite(rawValue)) return null;
          // scale 用于亿元→万亿这类单位换算；带 scale 的序列多保留一位小数
          const value = rawValue * (def.scale ?? 1);
          const digits = def.scale ? 2 : 1;
          const factor = 10 ** digits;
          return { date, value: Math.round(value * factor) / factor };
        })
        .filter((x: any): x is { date: string; value: number } => !!x)
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
      if (!rows.length) throw new Error(`empty rows for ${def.type}`);
      await db.delete(s.economicIndicators).where(eq(s.economicIndicators.type, def.type));
      const ts = now();
      const inserts = rows.map((r) => ({
        id: uid("ind"), name: def.name, type: def.type, date: r.date, value: r.value,
        category: def.category ?? (def.type === "gdp" ? "总量" : def.type === "pmi" ? "景气" : def.type === "cpi" || def.type === "ppi" ? "物价" : "货币"),
        unit: def.unit ?? "%", source: "东方财富数据中心", createdAt: ts, updatedAt: ts,
      }));
      for (let i = 0; i < inserts.length; i += 100) {
        await db.insert(s.economicIndicators).values(inserts.slice(i, i + 100) as any).onConflictDoNothing();
      }
      results.push({ type: def.type, count: inserts.length });
    } catch (e: any) {
      results.push({ type: def.type, count: 0, error: e?.message || String(e) });
    }
  }
  try {
    results.push(await syncHousePrice());
  } catch (e: any) {
    results.push({ type: "houseprice", count: 0, error: e?.message || String(e) });
  }
  results.push(...(await syncSinaMarketSeries()));
  return results;
}

/**
 * 行情类宏观序列（汇率 / 金价）的第二数据源。
 *
 * 背景：这两项原本走东财 push2his，但该集群在本机/部分网络下按并发连接数掐断
 * （UND_ERR_SOCKET），导致 usdcny 长期同步失败、库内一直是种子数据。
 * 新浪的这两个公开接口稳定可用，且能给出完整历史日线，因此改为「新浪为主」。
 */
const SINA_SERIES: Array<{
  type: string;
  name: string;
  unit: string;
  category: string;
  kind: "fx" | "futures";
  url: string;
}> = [
  {
    type: "usdcny",
    name: "美元兑人民币（离岸）",
    unit: "",
    category: "金融",
    kind: "fx",
    url: "https://vip.stock.finance.sina.com.cn/forex/api/jsonp.php/var%20t=/NewForexService.getDayKLine?symbol=fx_susdcnh",
  },
  {
    type: "gold",
    name: "伦敦金现货",
    unit: "美元/盎司",
    category: "金融",
    kind: "futures",
    url: "https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=XAU",
  },
];

const SINA_HEADERS = { Referer: "https://finance.sina.com.cn/", "User-Agent": "Mozilla/5.0" };

async function fetchSinaText(url: string): Promise<string> {
  const res = await fetch(url, { headers: SINA_HEADERS, signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!res.ok) throw new Error(`sina status ${res.status}`);
  return res.text();
}

/** 把日线收盘价按月聚合：取该月最后一个交易日的收盘价，作为月度指标值。 */
function toMonthlyClose(daily: Array<{ date: string; close: number }>): Array<{ date: string; value: number }> {
  const byMonth = new Map<string, { day: string; close: number }>();
  for (const d of daily) {
    const ym = toDate(d.date, false);
    if (!ym) continue;
    const prev = byMonth.get(ym);
    if (!prev || d.date > prev.day) byMonth.set(ym, { day: d.date, close: d.close });
  }
  return [...byMonth.entries()]
    .map(([ym, v]) => ({ date: ym, value: v.close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseSinaFxDaily(text: string): Array<{ date: string; close: number }> {
  // 形如：var t=("2014-11-07,6.13750,6.13030,6.13770,6.13410,|2014-11-10,...|")
  const inner = text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")).replace(/^"|"$/g, "");
  const out: Array<{ date: string; close: number }> = [];
  for (const row of inner.split("|")) {
    const parts = row.split(",");
    if (parts.length < 5) continue;
    const day = parts[0]?.trim();
    const close = Number(parts[4]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(close)) continue;
    out.push({ date: day, close });
  }
  return out;
}

function parseSinaFuturesDaily(text: string): Array<{ date: string; close: number }> {
  // 形如：var t=([{"date":"2006-10-30","open":"604.300",...,"close":"606.600",...}, ...])
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  const arr = JSON.parse(text.slice(start, end + 1)) as Array<Record<string, unknown>>;
  const out: Array<{ date: string; close: number }> = [];
  for (const item of arr) {
    const day = String(item.date ?? "");
    const close = Number(item.close);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(close)) continue;
    out.push({ date: day, close });
  }
  return out;
}

async function saveSeries(
  type: string,
  name: string,
  unit: string,
  category: string,
  source: string,
  rows: Array<{ date: string; value: number }>,
  decimals: number,
): Promise<number> {
  if (!rows.length) throw new Error(`empty rows for ${type}`);
  await db.delete(s.economicIndicators).where(eq(s.economicIndicators.type, type));
  const ts = now();
  const factor = 10 ** decimals;
  const inserts = rows.map((r) => ({
    id: uid("ind"), name, type, date: r.date, value: Math.round(r.value * factor) / factor,
    category, unit, source, createdAt: ts, updatedAt: ts,
  }));
  for (let i = 0; i < inserts.length; i += 100) {
    await db.insert(s.economicIndicators).values(inserts.slice(i, i + 100) as any).onConflictDoNothing();
  }
  return inserts.length;
}

async function syncSinaMarketSeries(): Promise<MacroSyncResult[]> {
  const results: MacroSyncResult[] = [];
  for (const def of SINA_SERIES) {
    try {
      const text = await fetchSinaText(def.url);
      const daily = def.kind === "fx" ? parseSinaFxDaily(text) : parseSinaFuturesDaily(text);
      if (!daily.length) throw new Error(`empty daily rows for ${def.type}`);
      const monthly = toMonthlyClose(daily);
      const decimals = def.kind === "fx" ? 4 : 1;
      const count = await saveSeries(def.type, def.name, def.unit, def.category, "新浪财经行情接口", monthly, decimals);
      results.push({ type: def.type, count });
    } catch (e: any) {
      results.push({ type: def.type, count: 0, error: e?.message || String(e) });
    }
  }
  return results;
}

async function syncHousePrice(): Promise<MacroSyncResult> {
  const raw = await fetchAll("RPT_ECONOMY_HOUSE_PRICE", 800);
  const byDate = new Map<string, number[]>();
  for (const r of raw) {
    const date = toDate(r.REPORT_DATE, false);
    const idx = Number(r.FIRST_COMHOUSE_SAME);
    if (!date || !Number.isFinite(idx)) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(idx);
  }
  const rows = [...byDate.entries()]
    .map(([date, arr]) => {
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return { date, value: Math.round((avg - 100) * 10) / 10 };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) throw new Error("empty rows for houseprice");
  await db.delete(s.economicIndicators).where(eq(s.economicIndicators.type, "houseprice"));
  const ts = now();
  const inserts = rows.map((r) => ({
    id: uid("ind"), name: "70城新房价格同比(均值近似)", type: "houseprice", date: r.date, value: r.value,
    category: "物价", unit: "%", source: "东方财富数据中心", createdAt: ts, updatedAt: ts,
  }));
  for (let i = 0; i < inserts.length; i += 100) {
    await db.insert(s.economicIndicators).values(inserts.slice(i, i + 100) as any).onConflictDoNothing();
  }
  return { type: "houseprice", count: inserts.length };
}

export interface MacroTemperatureDetail {
  temperature: number;
  date: string;
  raw: { pmi: number | null; cpi: number | null; m2: number | null };
  scores: { pmi: number; cpi: number; m2: number };
  weights: { pmi: number; cpi: number; m2: number };
}

/** 温度三因子归一化得分（纯函数，页面渲染时也可复用，不写库）。 */
export function macroTemperatureScores(raw: { pmi: number | null; cpi: number | null; m2: number | null }) {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const scorePmi = raw.pmi == null ? 40 : clamp((raw.pmi - 40) * 2, 5, 65);
  const scoreCpi = raw.cpi == null ? 45 : clamp(50 + (raw.cpi - 1) * 10, 20, 80);
  const scoreM2 = raw.m2 == null ? 50 : clamp(30 + (raw.m2 - 4) * 5, 10, 90);
  const weights = { pmi: 0.4, cpi: 0.35, m2: 0.25 };
  const temperature = Math.round(weights.pmi * scorePmi + weights.cpi * scoreCpi + weights.m2 * scoreM2);
  return {
    temperature,
    scores: {
      pmi: Math.round(scorePmi * 10) / 10,
      cpi: Math.round(scoreCpi * 10) / 10,
      m2: Math.round(scoreM2 * 10) / 10,
    },
    weights,
  };
}

/**
 * 宏观温度 = 0.4×PMI 分 + 0.35×CPI 分 + 0.25×M2 分。
 *
 * 旧实现只把最终温度写进 macroTemperatures，`components` 列一直是空的，
 * 于是「温度为什么是这个数」无从解释，前端也画不出三因子拆解。
 * 现在把原始值、归一化得分、权重一起写进 components（JSON），
 * 并改成按月 upsert：同一月份内指标更新时温度随之刷新，而不是永远保留
 * 本月第一次算出的值（onConflictDoNothing 的问题）。
 */
export async function computeMacroTemperature(): Promise<MacroTemperatureDetail> {
  const latest = async (type: string) => {
    const rows = await db
      .select({ value: s.economicIndicators.value })
      .from(s.economicIndicators)
      .where(eq(s.economicIndicators.type, type))
      .orderBy(desc(s.economicIndicators.date))
      .limit(1);
    return rows.length && rows[0].value != null ? Number(rows[0].value) : null;
  };
  const [pmi, cpi, m2] = await Promise.all([latest("pmi"), latest("cpi"), latest("m2")]);
  const calc = macroTemperatureScores({ pmi, cpi, m2 });
  const temperature = calc.temperature;
  const ym = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 7);
  const detail: MacroTemperatureDetail = {
    temperature,
    date: ym,
    raw: { pmi, cpi, m2 },
    scores: calc.scores,
    weights: calc.weights,
  };
  const components = JSON.stringify(detail);
  const existing = await db
    .select({ id: s.macroTemperatures.id })
    .from(s.macroTemperatures)
    .where(eq(s.macroTemperatures.date, ym))
    .limit(1);
  if (existing.length) {
    await db
      .update(s.macroTemperatures)
      .set({ temperature, components, updatedAt: now() } as any)
      .where(eq(s.macroTemperatures.id, existing[0].id));
  } else {
    await db.insert(s.macroTemperatures).values({
      id: uid("temp"), date: ym, temperature, components,
      createdAt: now(), updatedAt: now(),
    } as any);
  }
  return detail;
}

/** 兼容旧调用：只要温度数字。 */
export async function calcMacroTemperature(): Promise<number> {
  return (await computeMacroTemperature()).temperature;
}

/** 当前月份（北京时间）：UTC 服务器上 1 日 00:00–08:00 不能算成上个月。 */
function currentYmCst(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 7);
}

/** ym 偏移 delta 个月（delta 可为负）。 */
function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 用「当前三因子公式」回填历史宏观温度。
 *
 * 为什么必须做：旧库里的历史行是更早的「五因子（gdp/cpi/pmi/employment/credit）」
 * 或种子生成的 58–62°，与现在 0.4×PMI分 + 0.35×CPI分 + 0.25×M2分 不同量纲。
 * 真数据同步后新值是 37°，旧历史仍是 62°，画在一条线上就是「单月骤降 25 度」的假断崖
 * （月报正文会把它解读成真实宏观骤冷）。这里按每月月末口径取该月之前最新的
 * PMI/CPI/M2，用同一公式重算并 upsert，让历史与当期同口径。
 *
 * 只改温度行，不改动任何原始指标；不造假数据——每个点都是真实指标代入公式的结果。
 */
export async function backfillMacroTemperatureHistory(months = 24): Promise<Array<{ ym: string; temperature: number }>> {
  const inds = await db
    .select({ type: s.economicIndicators.type, date: s.economicIndicators.date, value: s.economicIndicators.value })
    .from(s.economicIndicators);
  const byType = new Map<string, Array<{ date: string; value: number }>>();
  for (const r of inds) {
    const type = String(r.type ?? "");
    if (!["pmi", "cpi", "m2"].includes(type) || r.value == null) continue;
    const date = String(r.date ?? "");
    // 月度序列才参与月度回填（季度 GDP 不是温度因子）
    if (!/^\d{4}-\d{2}$/.test(date)) continue;
    const list = byType.get(type) ?? [];
    list.push({ date, value: Number(r.value) });
    byType.set(type, list);
  }
  for (const list of byType.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const latestAt = (type: string, bound: string): number | null => {
    const list = byType.get(type) ?? [];
    let hit: number | null = null;
    for (const row of list) {
      if (row.date > bound) break;
      hit = row.value;
    }
    return hit;
  };

  const out: Array<{ ym: string; temperature: number }> = [];
  const current = currentYmCst();
  for (let i = months - 1; i >= 0; i -= 1) {
    const ym = shiftYm(current, -i);
    const bound = `${ym}-31`;
    const pmi = latestAt("pmi", bound);
    const cpi = latestAt("cpi", bound);
    const m2 = latestAt("m2", bound);
    if (pmi == null && cpi == null && m2 == null) continue;
    const calc = macroTemperatureScores({ pmi, cpi, m2 });
    const detail: MacroTemperatureDetail = {
      temperature: calc.temperature,
      date: ym,
      raw: { pmi, cpi, m2 },
      scores: calc.scores,
      weights: calc.weights,
    };
    const existing = await db
      .select({ id: s.macroTemperatures.id })
      .from(s.macroTemperatures)
      .where(eq(s.macroTemperatures.date, ym))
      .limit(1);
    if (existing.length) {
      await db
        .update(s.macroTemperatures)
        .set({ temperature: calc.temperature, components: JSON.stringify(detail), updatedAt: now() } as any)
        .where(eq(s.macroTemperatures.id, existing[0].id));
    } else {
      await db.insert(s.macroTemperatures).values({
        id: uid("temp"), date: ym, temperature: calc.temperature, components: JSON.stringify(detail),
        createdAt: now(), updatedAt: now(),
      } as any);
    }
    out.push({ ym, temperature: calc.temperature });
  }
  return out;
}
