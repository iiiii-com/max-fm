import type { KlineBar } from "@/app/api/stock/kline/route";
import { ETF_UNIVERSE } from "./etf-universe";
import { cached } from "./upstream-cache";
import { EM_UT, emJson } from "./eastmoney";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

async function getJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  // 统一走 emJson：对东财的并发被压到 2 条以内并带一次重试。
  // 直接并发 fetch 时上游会成批重置连接（UND_ERR_SOCKET），表现为「有时整块数据都没有」。
  const json = await emJson<T>(url, { timeoutMs, headers: UA });
  if (json == null) throw new Error("api unavailable");
  return json;
}

// ---------- 资金流 ----------

export interface StockFlow {
  /** 主力净流入(元) = 超大单 + 大单，与下方四档**同一交易日**，保证内部自洽 */
  mainNetIn: number;
  /** 主力净占比%（东财口径，来自实时快照） */
  mainPct: number;
  /** 四档明细所属交易日（东财按交易日披露资金流分布） */
  tierDate: string | null;
  superNetIn: number; // 超大单净额
  bigNetIn: number; // 大单净额
  midNetIn: number; // 中单净额
  smallNetIn: number; // 小单净额
  superPct: number | null; // 超大单占比%
  bigPct: number | null; // 大单占比%
  midPct: number | null; // 中单占比%
  smallPct: number | null; // 小单占比%
  mainNetIn5: number | null; // 5日主力净流入
  mainNetIn10: number | null; // 10日主力净流入
  trend: "流入" | "流出" | "平衡";
  trendScore: number; // 0-100 资金面得分
}

export async function fetchStockFlow(secid: string): Promise<StockFlow | null> {
  // 资金流按交易日更新，盘中 TTL 20s 足够；同时避免详情页/榜单重复打同一标的
  return (await cached<StockFlow | null>(`stock:flow:${secid}`, 20_000, () => loadStockFlow(secid))).data;
}

async function loadStockFlow(secid: string): Promise<StockFlow | null> {
  try {
    const [real, kline] = await Promise.all([
      getJson<{ data?: Record<string, any> }>(
        `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f62,f184&fltt=2&invt=2`
      ),
      getJson<{ data?: { klines?: string[] } }>(
        `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&fltt=2`
      ),
    ]);
    const d = real?.data;
    if (!d) return null;
    const rows = kline?.data?.klines || [];
    const sum = (n: number) => {
      if (rows.length < n) return null;
      return rows.slice(-n).reduce((acc, r) => {
        const v = parseFloat((r as string).split(",")[1] ?? "0");
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
    };
    const mainNetIn5 = sum(5);
    const mainNetIn10 = sum(10);

    // 四档明细取自 daykline 末行（最近一个已披露交易日），字段序：
    // 日期, 主力, 小单, 中单, 大单, 超大单, 主力%, 小单%, 中单%, 大单%, 超大单%, 收盘, 涨跌幅, ...
    const lastRow = rows.length ? String(rows[rows.length - 1]).split(",") : [];
    const f = (i: number) => (lastRow.length > i ? parseFloat(lastRow[i]) : NaN);
    const superNetIn = isNaN(f(5)) ? 0 : f(5);
    const bigNetIn = isNaN(f(4)) ? 0 : f(4);
    const midNetIn = isNaN(f(3)) ? 0 : f(3);
    const smallNetIn = isNaN(f(2)) ? 0 : f(2);

    // 关键：主力净流入由**同一行的超大单 + 大单**推导。
    // 旧实现取实时快照的 f62（当日、盘中、可能为 0）而四档取历史末行（上一交易日），
    // 导致「四档之和为 −5.28 亿但主力显示 +2」这类自相矛盾。
    const hasTiers = !isNaN(f(5)) || !isNaN(f(4));
    const mainNetIn = hasTiers ? superNetIn + bigNetIn : Number(d.f62) || 0;
    const mainPct = hasTiers && !isNaN(f(6)) ? f(6) : Number(d.f184) || 0;
    const score = computeFlowScore(mainNetIn5, mainNetIn10, mainPct, rows.length);

    return {
      mainNetIn,
      mainPct,
      tierDate: /^\d{4}-\d{2}-\d{2}$/.test(lastRow[0] ?? "") ? lastRow[0] : null,
      superNetIn,
      bigNetIn,
      midNetIn,
      smallNetIn,
      superPct: isNaN(f(10)) ? null : f(10),
      bigPct: isNaN(f(9)) ? null : f(9),
      midPct: isNaN(f(8)) ? null : f(8),
      smallPct: isNaN(f(7)) ? null : f(7),
      mainNetIn5,
      mainNetIn10,
      // 流向判定必须与 mainNetIn 同号，否则会出现「主力资金流出(+1.30%)」这种自相矛盾的文案
      trend: mainNetIn > 0 ? "流入" : mainNetIn < 0 ? "流出" : "平衡",
      trendScore: score,
    };
  } catch {
    return null;
  }
}

function computeFlowScore(n5: number | null, n10: number | null, pct: number, days: number): number {
  if (n5 === null && n10 === null) return 50;
  let s = 50;
  if (n5 !== null) {
    if (n5 > 0) s += 15;
    else s -= 15;
  }
  if (n10 !== null) {
    if (n10 > 0) s += 10;
    else s -= 10;
  }
  if (pct > 3) s += 10;
  else if (pct < -3) s -= 10;
  if (days < 10) s = 50; // 历史太短无法判断
  return Math.max(0, Math.min(100, Math.round(s)));
}

export interface Northbound {
  shIn: number; // 沪股通净流入
  szIn: number; // 深股通净流入
  totalIn: number;
  date: string;
  stopped?: boolean; // 2024-08 起北向净买入停止实时披露：true 时前端显示说明，不展示误导性 0
}

/**
 * 东财 kamt（沪深港通资金）字段 → 北向净流入的映射，抽成纯函数便于单测。
 *
 * 字段方向（东财命名是「资金流向」而不是「通道」）：
 *   hk2sh = 香港→上海 = **沪股通（北向）**，额度 520 亿/日
 *   hk2sz = 香港→深圳 = **深股通（北向）**，额度 520 亿/日
 *   sh2hk / sz2hk = 内地→香港 = 港股通（南向），额度 420 亿/日
 * 旧实现把 hk2sz 当沪股通、hk2sh 当深股通 —— 沪深两市的净流入**张冠李戴**。
 * （实测 hk2sh.dayAmtThreshold=5200000 万、sh2hk=4200000 万，可据此验证方向。）
 */
export function mapNorthboundPayload(d: { hk2sh?: any; hk2sz?: any } | null | undefined): Northbound {
  const shIn = Number(d?.hk2sh?.dayNetAmtIn ?? 0) * 1e4; // 万元 → 元
  const szIn = Number(d?.hk2sz?.dayNetAmtIn ?? 0) * 1e4;
  const date = String(d?.hk2sh?.date2 ?? d?.hk2sz?.date2 ?? "");
  // 2024-08-16 起北向净买入停止实时披露：东财把 dayNetAmtIn 填 0、
  // dayAmtRemain 也填 0（只保留额度阈值）。识别后标记 stopped，
  // 避免前端把「尚未披露」显示成「今日净流入 0 亿」这种误导性结论。
  const invalid = !Number.isFinite(shIn) || !Number.isFinite(szIn) || (shIn === 0 && szIn === 0);
  if (invalid) return { shIn: 0, szIn: 0, totalIn: 0, date, stopped: true };
  return { shIn, szIn, totalIn: shIn + szIn, date };
}

export async function fetchNorthbound(): Promise<Northbound | null> {
  try {
    const json = await getJson<{ data?: { sh2hk?: any; hk2sz?: any; hk2sh?: any } }>(
      `https://push2.eastmoney.com/api/qt/kamt/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56&ut=${EM_UT}`
    );
    const d = json?.data;
    if (!d) return null;
    return mapNorthboundPayload(d);
  } catch {
    // 断网 / 限频降级：不生成假数据，返回 null（前端展示「北向数据暂不可用」）
    return null;
  }
}

// ---------- 技术指标 ----------

export interface IndicatorSignals {
  ma: { ma5: number; ma10: number; ma20: number; ma60: number; bullish: boolean };
  macd: { dif: number; dea: number; hist: number; golden: boolean; dead: boolean };
  rsi: { rsi6: number; rsi12: number; rsi24: number; overbought: boolean; oversold: boolean };
  kdj: { k: number; d: number; j: number; golden: boolean; dead: boolean };
  vol: { volRatio: number; volumeBreakout: boolean; priceVolumeDivergence: boolean };
  score: number; // 技术面得分 0-100
  signals: string[]; // 信号列表
}

export function computeIndicators(bars: KlineBar[]): IndicatorSignals | null {
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const ma = (n: number) => {
    if (closes.length < n) return null;
    const v = closes.slice(-n).reduce((a, c) => a + c, 0) / n;
    return v;
  };
  const ma5 = ma(5), ma10 = ma(10), ma20 = ma(20), ma60 = ma(60);
  if (ma5 == null || ma10 == null || ma20 == null) return null;
  const bullish = ma5 > ma10 && ma10 > ma20 && (ma60 == null || ma20 > ma60);

  const ema = (data: number[], n: number) => {
    const k = 2 / (n + 1);
    let prev = data[0];
    const out = [prev];
    for (let i = 1; i < data.length; i++) {
      prev = data[i] * k + prev * (1 - k);
      out.push(prev);
    }
    return out;
  };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = ema(dif, 9);
  const hist = dif.map((v, i) => (v - dea[i]) * 2);
  const lastD = dif[dif.length - 1], lastDea = dea[dea.length - 1], lastH = hist[hist.length - 1];
  const golden = lastD > lastDea && dif[dif.length - 2] <= dea[dif.length - 2];
  const dead = lastD < lastDea && dif[dif.length - 2] >= dea[dif.length - 2];

  const rsi = (n: number) => {
    let gain = 0, loss = 0;
    for (let i = closes.length - n; i < closes.length; i++) {
      const ch = closes[i] - closes[i - 1];
      if (ch >= 0) gain += ch; else loss -= ch;
    }
    if (gain + loss === 0) return 50;
    return 100 * (gain / (gain + loss));
  };
  const rsi6 = rsi(6), rsi12 = rsi(12), rsi24 = rsi(24);
  const overbought = rsi6 > 80 || rsi12 > 75;
  const oversold = rsi6 < 20 || rsi12 < 25;

  const rsv = closes.map((c, i) => {
    const start = Math.max(0, i - 8);
    const slice = closes.slice(start, i + 1);
    const h = Math.max(...slice), l = Math.min(...slice);
    if (h === l) return 50;
    return ((c - l) / (h - l)) * 100;
  });
  let k = 50, dVal = 50;
  const kArr: number[] = [], dSeries: number[] = [];
  for (let i = 0; i < rsv.length; i++) {
    k = (2 / 3) * k + (1 / 3) * rsv[i];
    dVal = (2 / 3) * dVal + (1 / 3) * k;
    kArr.push(k);
    dSeries.push(dVal);
  }
  const jArr = kArr.map((v, i) => 3 * v - 2 * dSeries[i]);
  const kk = kArr[kArr.length - 1], dv = dSeries[dSeries.length - 1], jv = jArr[jArr.length - 1];
  const kGolden = kk > dv && kArr[kArr.length - 2] <= dSeries[dSeries.length - 2] && kk < 40;
  const kDead = kk < dv && kArr[kArr.length - 2] >= dSeries[dSeries.length - 2] && kk > 60;

  const volAvg20 = volumes.slice(-20).reduce((a, v) => a + v, 0) / 20;
  const lastVol = volumes[volumes.length - 1];
  const volRatio = volAvg20 > 0 ? lastVol / volAvg20 : 1;
  const volumeBreakout = volRatio > 1.8 && Math.abs(closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2] > 0.03;
  const priceUp = closes[closes.length - 1] >= closes[closes.length - 2];
  const priceVolumeDivergence = (priceUp && lastVol < volAvg20 * 0.6) || (!priceUp && lastVol > volAvg20 * 1.5);

  const signals: string[] = [];
  if (bullish) signals.push("均线多头排列");
  if (golden) signals.push("MACD 金叉");
  if (dead) signals.push("MACD 死叉");
  if (overbought) signals.push("短期超买");
  if (oversold) signals.push("短期超卖");
  if (kGolden) signals.push("KDJ 低位金叉");
  if (kDead) signals.push("KDJ 高位死叉");
  if (volumeBreakout) signals.push("放量突破");
  if (priceVolumeDivergence) signals.push(priceUp ? "缩量上涨(量价背离)" : "放量下跌(量价背离)");

  let score = 50;
  if (bullish) score += 12; else score -= 12;
  if (golden) score += 8; else if (dead) score -= 8;
  if (overbought) score -= 4; else if (oversold) score += 3; // 超卖是机会
  if (kGolden) score += 5; else if (kDead) score -= 5;
  if (volumeBreakout) score += 6;
  if (priceVolumeDivergence) score -= 6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ma: { ma5, ma10, ma20, ma60: ma60 ?? 0, bullish },
    macd: { dif: lastD, dea: lastDea, hist: lastH, golden, dead },
    rsi: { rsi6, rsi12, rsi24, overbought, oversold },
    kdj: { k: kk, d: dv, j: jv, golden: kGolden, dead: kDead },
    vol: { volRatio, volumeBreakout, priceVolumeDivergence },
    score,
    signals,
  };
}

// ---------- 综合评分 ----------

export interface StockScore {
  total: number; // 0-100
  level: string; // 强势/中性/弱势
  tech: number;
  flow: number;
  valuation: number;
  fundamentals: number;
  summary: string;
  signals: string[];
  breakdown: Record<string, number>;
}

export function scoreStock(flow: StockFlow | null, signals: IndicatorSignals | null, fund: any): StockScore {
  const tech = signals?.score ?? 50;
  const flowScore = flow?.trendScore ?? 50;
  let valuation = 50;
  let fundamentals = 50;
  const pe = Number(fund?.pe);
  const pb = Number(fund?.pb);
  const eps = Number(fund?.eps);
  const turnover = Number(fund?.turnover);
  if (Number.isFinite(pe) && pe > 0) {
    if (pe < 15) valuation += 20;
    else if (pe < 25) valuation += 10;
    else if (pe > 60) valuation -= 20;
    else if (pe > 40) valuation -= 10;
  } else if (Number.isFinite(pb) && pb > 0) {
    if (pb < 2) valuation += 10;
    else if (pb > 10) valuation -= 15;
  }
  if (Number.isFinite(eps) && eps > 0) fundamentals += 15;
  if (Number.isFinite(turnover) && turnover > 0) fundamentals += 5;
  if (Number.isFinite(pe) && Number.isFinite(eps) && eps > 0 && pe > 0 && eps * pe > 0) fundamentals += 10; // 盈利正且估值合理
  valuation = Math.max(0, Math.min(100, Math.round(valuation)));
  fundamentals = Math.max(0, Math.min(100, Math.round(fundamentals)));

  const total = Math.round(tech * 0.4 + flowScore * 0.3 + valuation * 0.2 + fundamentals * 0.1);
  const level = total >= 70 ? "强势" : total >= 50 ? "中性偏强" : total >= 40 ? "中性偏弱" : "弱势";
  const signalsList = [
    ...(signals?.signals ?? []),
    // 方向词与数值同源（trend 由 mainNetIn 符号推导），避免「主力资金流出(+1.30%)」这类自相矛盾
    flow
      ? `主力资金${flow.trend}（${flow.mainNetIn >= 0 ? "+" : ""}${(flow.mainNetIn / 1e8).toFixed(2)}亿 / 占比 ${flow.mainPct >= 0 ? "+" : ""}${flow.mainPct.toFixed(2)}%）`
      : "",
    `估值${valuation >= 60 ? "偏低" : valuation <= 35 ? "偏高" : "中性"}`,
  ].filter(Boolean);

  const summary = `${level} · 综合得分 ${total}（技术 ${tech} / 资金 ${flowScore} / 估值 ${valuation} / 基本面 ${fundamentals}）`;

  return {
    total,
    level,
    tech,
    flow: flowScore,
    valuation,
    fundamentals,
    summary,
    signals: signalsList,
    breakdown: { 技术面: tech, 资金面: flowScore, 估值面: valuation, 基本面: fundamentals },
  };
}

// ---------- ETF ----------

export interface EtfQuote {
  code: string;
  name: string;
  price: number;
  prevClose: number;
  changePct: number;
  /** 基金单位净值（最新披露值，非盘中 IOPV） */
  nav: number | null;
  /** 净值日期：单位净值按交易日披露，盘中溢价率只能基于该日净值计算 */
  navDate: string | null;
  /**
   * 净值是否明显滞后（与今天相差 > 4 个自然日）。
   * QDII 的净值披露通常滞后 T+1~T+2，用「今天价格 ÷ 两天前净值」算出的溢价率
   * 会把跨市场时差与净值滞后混在一起，看起来像十几个点的溢价，实际不可解释。
   * 滞后时前端把溢价率显示为「—」并提示净值日期，而不是给一个像真值的数字。
   */
  navStale: boolean;
  /**
   * 溢价率 = (场内价 − 最新披露单位净值) / 最新披露单位净值 × 100，%。
   * 取不到净值时为 null（前端显示「—」），**绝不用当日涨跌幅冒充溢价率**。
   */
  premiumPct: number | null;
  turnover: number;
  /** 成交额（元）——东财个股快照中该字段为 f48，f6 对 ETF 不返回 */
  amount: number;
  /** 成交量（股） */
  volume: number;
  scale: number; // 规模(元)
}

/** 拉取 ETF 最新披露单位净值（东方财富基金历史净值）。失败返回 null。 */
async function fetchEtfNav(code: string): Promise<{ nav: number; date: string } | null> {
  // 净值一天只更新一次，缓存 5 分钟足够，且能消掉同一页 14 只 ETF 的重复请求
  return (await cached<{ nav: number; date: string } | null>(`etf:nav:${code}`, 300_000, () => loadEtfNav(code))).data;
}

async function loadEtfNav(code: string): Promise<{ nav: number; date: string } | null> {
  try {
    const res = await fetch(
      `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${encodeURIComponent(code)}&pageIndex=1&pageSize=2`,
      {
        headers: {
          "User-Agent": UA["User-Agent"],
          Referer: "https://fundf10.eastmoney.com/",
        },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const j: any = await res.json();
    const row = j?.Data?.LSJZList?.[0];
    const nav = Number(row?.DWJZ);
    if (!Number.isFinite(nav) || nav <= 0) return null;
    return { nav, date: String(row?.FSRQ ?? "") };
  } catch {
    return null;
  }
}

/** 净值日期距今的自然日差；解析失败返回 null */
/** 净值日距今天数（CST 自然日）；无法解析返回 null。QDII 净值 T+1~T+2，滞后过久不计算溢价率 */
export function navLagDays(navDate: string | null | undefined, now = Date.now()): number | null {
  if (!navDate) return null;
  const t = Date.parse(`${navDate}T00:00:00+08:00`);
  if (!Number.isFinite(t)) return null;
  // 用 +8h 再取 UTC 日期，得到「CST 自然日」的 0 点，避免依赖运行环境的本地时区
  // （旧实现用 toLocaleString 解析，行为随 Node ICU/locale 变化，无法稳定单测）
  const cst = new Date(now + 8 * 3600_000);
  const todayCstMidnightUtc = Date.UTC(cst.getUTCFullYear(), cst.getUTCMonth(), cst.getUTCDate()) - 8 * 3600_000;
  return Math.max(0, Math.round((todayCstMidnightUtc - t) / 86_400_000));
}

/** 净值滞后阈值（自然日）：覆盖周末 + T+1 披露，超过即认为不具可比性 */
const NAV_STALE_DAYS = 4;

export async function fetchEtfQuote(secid: string): Promise<EtfQuote | null> {
  // 行情 20s / 净值 5min：ETF 详情一次要取 ~14 只，
  // 若每只都直通上游，单次页面渲染就是 14 个请求 × 2 个源，很容易把免费源打成限频。
  return (await cached<EtfQuote | null>(`etf:quote:${secid}`, 20_000, () => loadEtfQuote(secid))).data;
}

async function loadEtfQuote(secid: string): Promise<EtfQuote | null> {
  const code = secid.split(".")[1] ?? "";
  try {
    const [d, navInfo] = await Promise.all([
      getJson<{ data?: Record<string, any> }>(
        // f43 最新价 / f60 昨收 / f47 成交量 / f48 成交额 / f116 规模 / f168 换手率
        // 注意：f169/f170 在个股快照里分别是涨跌额/涨跌幅，**不是**溢价率，不可用于计算净值。
        `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f60,f47,f48,f116,f168&fltt=2&invt=2`
      ),
      code ? fetchEtfNav(code) : Promise.resolve(null),
    ]);
    const q = d?.data;
    // f43 缺失（停牌/代码不在东财快照里）时不要直接判失败——继续走新浪兜底
    if (!q || q.f43 == null) throw new Error("em empty");
    const price = Number(q.f43) || 0;
    const prev = Number(q.f60) || 0;
    const nav = navInfo?.nav ?? null;
    const lag = navLagDays(navInfo?.date);
    const navStale = lag != null && lag > NAV_STALE_DAYS;
    return {
      code: String(q.f57 ?? code),
      name: String(q.f58),
      price,
      prevClose: prev,
      changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
      nav,
      navDate: navInfo?.date || null,
      navStale,
      // 净值明显滞后（QDII T+1~T+2 或长假）时不计算溢价率：用两天前净值除今天的价格，
      // 得到的数字会把跨市场时差算成「溢价」，宁可显示「—」也不给一个像真值的错值。
      premiumPct: nav != null && nav > 0 && !navStale ? ((price - nav) / nav) * 100 : null,
      // f168 在 ETF 快照里是换手率（%），不是净流入
      turnover: Number(q.f168) || 0,
      amount: Number(q.f48) || 0,
      volume: Number(q.f47) || 0,
      scale: Number(q.f116) || 0,
    };
  } catch {
    // 东财 push2 在本地网络下间歇性 UND_ERR_SOCKET——这是「ETF 有时无法显示」的主因。
    // 新浪行情稳定（约 15 秒延迟），足以撑住详情页的价格/涨跌幅/成交额，净值再单独补。
    return loadEtfQuoteSina(secid, code);
  }
}

/**
 * ETF 快照新浪兜底（东财 push2 不可用时）。
 *
 * 新浪 A 股/ETF 格式：名称,今开,昨收,现价,最高,最低,...,成交量(股),成交额(元),...
 * 拿到价格后仍尝试补最新单位净值，补不到就返回 nav=null / premiumPct=null，前端显示「—」。
 */
async function loadEtfQuoteSina(secid: string, code: string): Promise<EtfQuote | null> {
  const mkt = secid.split(".")[0];
  const sym = mkt === "1" ? `sh${code}` : mkt === "0" ? `sz${code}` : "";
  if (!sym) return null;
  try {
    const res = await fetch(`https://hq.sinajs.cn/list=${sym}`, {
      headers: { Referer: "https://finance.sina.com.cn/", ...UA },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    const m = text.match(/hq_str_[a-zA-Z0-9_$]+="([^"]*)"/);
    const p = m?.[1]?.split(",") ?? [];
    if (p.length < 10) return null;
    const name = p[0];
    const price = Number(p[3]);
    const prev = Number(p[2]);
    if (!Number.isFinite(price) || price <= 0) return null;
    const navInfo = code ? await fetchEtfNav(code) : null;
    const nav = navInfo?.nav ?? null;
    const lag = navLagDays(navInfo?.date);
    const navStale = lag != null && lag > NAV_STALE_DAYS;
    return {
      code,
      name,
      price,
      prevClose: prev,
      changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
      nav,
      navDate: navInfo?.date || null,
      navStale,
      premiumPct: nav != null && nav > 0 && !navStale ? ((price - nav) / nav) * 100 : null,
      turnover: 0, // 新浪快照不返回 ETF 换手率，宁缺毋滥
      amount: Number(p[9]) || 0,
      // 新浪快照成交量单位是股，换算成手（与东财 f47 统一）
      volume: Math.round((Number(p[8]) || 0) / 100),
      scale: 0,
    };
  } catch {
    return null;
  }
}

export async function fetchEtfSearch(q: string): Promise<Array<{ code: string; name: string; secid: string }>> {
  try {
    const json = await getJson<{ QuotationCodeTable?: { Data?: any[] } }>(
      `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`
    );
    const rows = json?.QuotationCodeTable?.Data || [];
    return rows
      .filter((r) => ["0", "1"].includes(String(r.MktNum)) && String(r.Classify) === "Fund" && String(r.Name).includes("ETF"))
      .slice(0, 8)
      .map((r) => ({
        code: String(r.Code),
        name: String(r.Name),
        secid: `${r.MktNum}.${r.Code}`,
      }));
  } catch {
    // 东财搜索接口不可用时用本地静态语料兜底，保证搜索框「能搜到东西」
    const q2 = q.trim().toLowerCase();
    if (!q2) return [];
    return ETF_UNIVERSE.filter((i) => i.code.includes(q2) || i.name.toLowerCase().includes(q2))
      .slice(0, 8)
      .map((i) => ({ code: i.code, name: i.name, secid: i.secid }));
  }
}

// ---------- ETF 全市场榜单 ----------

/** ETF 大类（用于市场洞察 ETF 专区的分类筛选） */
export type EtfCat = "宽基" | "行业" | "跨境" | "商品" | "债券" | "货币" | "策略";

export const ETF_CATS: EtfCat[] = ["宽基", "行业", "跨境", "商品", "债券", "货币", "策略"];

export interface EtfBoardItem {
  code: string;
  name: string;
  secid: string;
  cat: EtfCat;
  price: number;
  prevClose: number;
  /** 涨跌幅 % */
  changePct: number;
  open: number;
  high: number;
  low: number;
  /** 成交量（股） */
  volume: number;
  /** 成交额（元） */
  amount: number;
  /** 换手率 %（货币 ETF 的换手异常，已置 null） */
  turnover: number | null;
  /** 行情来源：东财板块 / 新浪兜底（降级时前端展示提示） */
  sourceMode?: "eastmoney" | "sina";
}

/**
 * 东财 ETF 板块代码的语义（实测 2026-10）：
 *  - MK0021 = 沪深股票 ETF（1372 只，宽基/行业/策略/债券都在这）
 *  - MK0022 = 货币 ETF（27 只）
 *  - MK0023 = 跨境 ETF（245 只）
 *  - MK0024 = 商品 ETF（10 只）
 * 单次 clist 最多回 100 条（pz 上限），所以按「成交额降序取各板块前 100」拼一张
 * 活跃 ETF 榜单：1654 只全量要 17 个请求，对免费源是自伤（见 upstream-cache 注释）。
 */
const ETF_BOARDS: Array<{ fs: string; hint?: EtfCat }> = [
  { fs: "b:MK0021" },
  { fs: "b:MK0022", hint: "货币" },
  { fs: "b:MK0023", hint: "跨境" },
  { fs: "b:MK0024", hint: "商品" },
];

function etfNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 名称 → ETF 大类（板块已给出 hint 的直接采用，剩余按名称规则） */
export function etfCategoryOf(name: string, hint?: EtfCat): EtfCat {
  if (hint) return hint;
  const n = name.replace(/\s/g, "");
  if (/债|国债|政金|信用债|城投|转债|金融债/.test(n)) return "债券";
  if (/黄金|白银|豆粕|能源化工|原油|商品/.test(n)) return "商品";
  if (
    /恒生|港股|香港|H股|纳指|纳斯达克|标普|道琼斯|日经|德国|法国|东南亚|越南|中概|中韩|海外|美国|日本|韩国|印度|沙特|亚太|全球|国际|欧洲|英国|中证香港|东证|富时/.test(
      n
    )
  )
    return "跨境";
  if (/红利|低波|价值|成长|质量|动量|等权|增强|策略|多因子|自由现金流|基本面|防御|优选/.test(n)) return "策略";
  if (
    /沪深300|上证50|上证180|上证综指|中证100|中证200|中证500|中证800|中证1000|中证2000|中证A500|中证A50|科创50|科创100|科创200|科创综指|创业板|深证100|深证成指|深证50|北证50|双创|A500|A50|MSCI|中证全指|巨潮|大盘|中盘|小盘|超大盘|上证指数/.test(
      n
    )
  )
    return "宽基";
  return "行业";
}

async function loadEtfBoard(): Promise<EtfBoardItem[] | null> {
  const fields = "f12,f13,f14,f2,f3,f4,f5,f6,f8,f15,f16,f17,f18";
  const fetchBoard = (fs: string, hint?: EtfCat): Promise<EtfBoardItem[]> => {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f6&fs=${fs}&fields=${fields}`;
    return getJson<{ data?: { diff?: any[] } }>(url, 3500).then((j) =>
      ((j?.data?.diff ?? []) as any[])
        .filter((d) => d?.f12 && d?.f14 && /ETF/i.test(String(d.f14)))
        .map((d) => {
          const name = String(d.f14);
          const turnover = etfNum(d.f8);
          return {
            code: String(d.f12),
            name,
            secid: `${d.f13}.${d.f12}`,
            cat: etfCategoryOf(name, hint),
            price: etfNum(d.f2),
            prevClose: etfNum(d.f18),
            changePct: etfNum(d.f3),
            open: etfNum(d.f17),
            high: etfNum(d.f15),
            low: etfNum(d.f16),
            volume: etfNum(d.f5), // f5 单位为手，与 K 线/快照统一（原先 ×100 换成股导致 100 倍差异）
            amount: etfNum(d.f6),
            // 货币 ETF 的换手率通常无意义（申赎型），置 null 避免误导
            turnover: hint === "货币" || turnover > 500 ? null : turnover,
            sourceMode: "eastmoney" as const,
          } satisfies EtfBoardItem;
        })
    );
  };

  const results = await Promise.all(
    ETF_BOARDS.map(async ({ fs, hint }) => {
      for (let attempt = 0; attempt < 1; attempt++) {
        try {
          return await fetchBoard(fs, hint);
        } catch {
          if (attempt === 1) return [] as EtfBoardItem[];
        }
      }
      return [] as EtfBoardItem[];
    })
  );
  const all = results.flat();
  if (!all.length) return null;
  // 去重（同代码跨板块理论上不会出现，防御异常）
  const seen = new Set<string>();
  return all.filter((d) => (seen.has(d.secid) ? false : (seen.add(d.secid), true)));
}

/**
 * 活跃 ETF 榜单（各板块成交额前 100，约 300~400 只）。
 * 20s TTL + 单飞：市场洞察 ETF 专区 30s 自动刷新时也只打一轮上游。
 * 东财板块接口被重置/超时（常见于国内部分网络环境）时，退新浪批量快照，
 * 用 ETF_UNIVERSE 静态语料保证「ETF 专区不空白」。
 */
export async function fetchEtfBoard(): Promise<EtfBoardItem[] | null> {
  const primary = await cached<EtfBoardItem[] | null>("etf:board:v3", 20_000, () => loadEtfBoard());
  if (primary.data?.length) return primary.data;
  const fallback = await cached<EtfBoardItem[] | null>("etf:board:sina:v1", 20_000, () => loadEtfBoardSina());
  return fallback.data;
}

/* ---------- 新浪兜底：批量 ETF 快照 ---------- */

const SINA_HEADERS = {
  ...UA,
  Referer: "https://finance.sina.com.cn/",
};

function secidToSina(secid: string): string | null {
  const m = /^(\d)\.(\d{6})$/.exec(secid);
  if (!m) return null;
  return `${m[1] === "1" ? "sh" : "sz"}${m[2]}`;
}

async function loadEtfBoardSina(): Promise<EtfBoardItem[] | null> {
  try {
    const refs = ETF_UNIVERSE;
    const items: EtfBoardItem[] = [];
    const CHUNK = 80;
    for (let i = 0; i < refs.length; i += CHUNK) {
      const chunk = refs.slice(i, i + CHUNK);
      const symbols = chunk.map((r) => secidToSina(r.secid)).filter((s): s is string => Boolean(s));
      if (!symbols.length) continue;
      const res = await fetch(`https://hq.sinajs.cn/list=${symbols.join(",")}`, {
        headers: SINA_HEADERS,
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`sina ${res.status}`);
      const buf = await res.arrayBuffer();
      // 新浪返回 GBK，需按 GB18030 解码，否则名称乱码
      const text = new TextDecoder("gb18030").decode(buf);
      for (const line of text.split("\n")) {
        const mm = /^var hq_str_(?:sh|sz)(\d{6})="([^"]*)";?\s*$/.exec(line.trim());
        if (!mm) continue;
        const code = mm[1];
        const ref = refs.find((r) => r.code === code);
        if (!ref) continue;
        const f = mm[2].split(",");
        if (f.length < 10) continue;
        const prevClose = Number(f[2]) || 0;
        const price = Number(f[3]) || 0;
        if (!(price > 0) || !(prevClose > 0)) continue;
        const name = f[0] && f[0].includes("ETF") ? f[0] : ref.name;
        items.push({
          code,
          name,
          secid: ref.secid,
          cat: etfCategoryOf(ref.name),
          price,
          prevClose,
          changePct: Number((((price - prevClose) / prevClose) * 100).toFixed(2)),
          open: Number(f[1]) || 0,
          high: Number(f[4]) || 0,
          low: Number(f[5]) || 0,
          // 新浪快照 p[8] 成交量单位是「股」，统一换算成「手」
          volume: Math.round((Number(f[8]) || 0) / 100),
          amount: Number(f[9]) || 0,
          turnover: null,
          sourceMode: "sina" as const,
        });
      }
    }
    if (!items.length) return null;
    return items.sort((a, b) => b.amount - a.amount);
  } catch {
    return null;
  }
}