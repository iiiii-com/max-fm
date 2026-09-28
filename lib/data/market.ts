import type { KlineBar } from "@/app/api/stock/kline/route";
import { cached } from "./upstream-cache";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

async function getJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
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

export async function fetchNorthbound(): Promise<Northbound | null> {
  try {
    const json = await getJson<{ data?: { sh2hk?: any; hk2sz?: any; hk2sh?: any } }>(
      `https://push2.eastmoney.com/api/qt/kamt/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56`
    );
    const d = json?.data;
    if (!d) return null;
    const shIn = Number(d.hk2sz?.dayNetAmtIn ?? 0) * 1e4; // 港股通(沪) 反向为北向
    const szIn = Number(d.hk2sh?.dayNetAmtIn ?? 0) * 1e4;
    // 停止披露后东财把净买入字段填 "-"（NaN）或全 0 占位：识别后标记 stopped，避免展示误导性的「净流入 0」
    const invalid = !Number.isFinite(shIn) || !Number.isFinite(szIn) || (shIn === 0 && szIn === 0);
    if (invalid) {
      return { shIn: 0, szIn: 0, totalIn: 0, date: String(d.hk2sz?.date2 ?? ""), stopped: true };
    }
    return {
      shIn,
      szIn,
      totalIn: shIn + szIn,
      date: String(d.hk2sz?.date2 ?? ""),
    };
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

export async function fetchEtfQuote(secid: string): Promise<EtfQuote | null> {
  // 行情 20s / 净值 5min：ETF 详情一次要取 ~14 只，
  // 若每只都直通上游，单次页面渲染就是 14 个请求 × 2 个源，很容易把免费源打成限频。
  return (await cached<EtfQuote | null>(`etf:quote:${secid}`, 20_000, () => loadEtfQuote(secid))).data;
}

async function loadEtfQuote(secid: string): Promise<EtfQuote | null> {
  try {
    const code = secid.split(".")[1] ?? "";
    const [d, navInfo] = await Promise.all([
      getJson<{ data?: Record<string, any> }>(
        // f43 最新价 / f60 昨收 / f47 成交量 / f48 成交额 / f116 规模 / f168 换手率
        // 注意：f169/f170 在个股快照里分别是涨跌额/涨跌幅，**不是**溢价率，不可用于计算净值。
        `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f60,f47,f48,f116,f168&fltt=2&invt=2`
      ),
      code ? fetchEtfNav(code) : Promise.resolve(null),
    ]);
    const q = d?.data;
    if (!q) return null;
    const price = Number(q.f43) || 0;
    const prev = Number(q.f60) || 0;
    const nav = navInfo?.nav ?? null;
    return {
      code: String(q.f57 ?? code),
      name: String(q.f58),
      price,
      prevClose: prev,
      changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
      nav,
      navDate: navInfo?.date || null,
      premiumPct: nav != null && nav > 0 ? ((price - nav) / nav) * 100 : null,
      turnover: Number(q.f168) || 0,
      amount: Number(q.f48) || 0,
      volume: Number(q.f47) || 0,
      scale: Number(q.f116) || 0,
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
    return [];
  }
}