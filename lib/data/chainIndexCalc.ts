/**
 * 产业链指数：用链上成员股的**真实收盘价**合成，全部可复现。
 *
 * 为什么这是研究级能力：链级的规模/增速没有可核验的公开口径（站内已明确不展示），
 * 但"这条链近期相对强弱如何、回撤多深"完全可以从成员股真实价格算出来，
 * 而且每一步都能被复算 —— 这比任何二手结论都靠得住。
 *
 * 口径纪律（写进输出，不藏在代码里）：
 *  - **等权**。不假装市值加权：市值需要额外的取数口径（总股本/流通股本、时点），
 *    混进来就变成一个无法复现的数字。等权口径简单且可核对。
 *  - 成员只在**共同交易日**上参与合成，任一成员缺失的交易日整行剔除。
 *  - 停牌/零价被丢弃（见 fetchDailyCloses），不是当成 0 收益。
 *  - 成员覆盖率如实上报：链上有几家公司、其中几家有 secid、实际算进去几家。
 *  - 基点 1000，从窗口首日开始累乘，便于跨链对比（同一起点）。
 */

import { alignReturns, annualCovariance, annualVol, TRADING_DAYS } from "./portfolio-risk";

export interface MemberSeries {
  secid: string;
  name: string;
  /** 该成员在窗口内的日线根数（用于说明为什么被剔除） */
  bars: number;
  dates: string[];
  closes: number[];
  /** 所属层级（上游/中游/下游）—— 用于环节级拆解，缺失则该成员不计入任何段 */
  stage?: string;
}

export interface MemberResult {
  secid: string;
  name: string;
  /** 窗口内区间收益（%） */
  ret: number;
  bars: number;
}

export interface ChainIndexResult {
  /** 指数曲线（基点 1000） */
  points: Array<{ date: string; value: number }>;
  /** 参与合成的成员 */
  members: MemberResult[];
  /** 因数据不足被剔除的成员 */
  excluded: Array<{ secid: string; name: string; reason: string }>;
  stats: {
    /** 窗口内区间收益 % */
    ret: number;
    /** 年化波动 % */
    vol: number;
    /** 最大回撤 %（负数） */
    maxDrawdown: number;
    /** 交易日数 */
    sessions: number;
  };
}

const BASE = 1000;

/** 最少需要多少根日线才纳入合成（不足则没有可比性） */
export const MIN_BARS = 60;

/**
 * 等权合成链指数。
 * 收益口径：每日取全体有效成员日收益的算术平均（等权再平衡），再累乘。
 */
export function buildChainIndex(members: MemberSeries[]): ChainIndexResult {
  const usable = members.filter((m) => m.bars >= MIN_BARS && m.dates.length === m.closes.length);
  const excluded = members
    .filter((m) => !usable.includes(m))
    .map((m) => ({ secid: m.secid, name: m.name, reason: m.bars ? `仅 ${m.bars} 根日线（需 ≥ ${MIN_BARS}）` : "无日线数据" }));

  if (usable.length < 2) {
    return { points: [], members: [], excluded, stats: { ret: 0, vol: 0, maxDrawdown: 0, sessions: 0 } };
  }

  // 复用组合风险模块的日期对齐：任一成员缺失的交易日整行剔除
  const { dates, returns, firstDate } = alignReturns(
    usable.map((m) => ({ asset: m.secid, dates: m.dates, closes: m.closes }))
  );
  if (returns.length < 2 || returns[0].length < 2 || !firstDate) {
    return { points: [], members: [], excluded, stats: { ret: 0, vol: 0, maxDrawdown: 0, sessions: 0 } };
  }

  const n = returns.length; // 成员数
  const t = returns[0].length; // 共同交易日数（收益率个数）

  // 每日等权平均收益
  const daily: number[] = [];
  for (let i = 0; i < t; i++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += returns[k][i];
    daily.push(s / n);
  }

  // 累乘成指数。points 的第一个点对应共同窗口**首日**（值为 BASE），
  // 首日由 alignReturns 的 firstDate 给出 —— dates 里只有收益率对应的日期，不含它。
  const points: Array<{ date: string; value: number }> = [{ date: firstDate, value: BASE }];
  let v = BASE;
  let peak = BASE;
  let maxDd = 0;
  for (let i = 0; i < t; i++) {
    v *= 1 + daily[i];
    points.push({ date: dates[i + 1], value: Number(v.toFixed(2)) });
    if (v > peak) peak = v;
    const dd = (v / peak - 1) * 100;
    if (dd < maxDd) maxDd = dd;
  }

  const ret = (v / BASE - 1) * 100;

  // 年化波动：直接用日收益序列（等权组合的日收益），不是成员波动的平均
  const cov = annualCovariance([daily]);
  const vol = annualVol(cov)[0] * 100;

  // 成员区间收益：各自首末收盘（同一共同窗口）
  const membersOut: MemberResult[] = usable.map((m, k) => {
    const first = returns[k].length ? m.closes[m.closes.length - 1 - t] : m.closes[0];
    const last = m.closes[m.closes.length - 1];
    return {
      secid: m.secid,
      name: m.name,
      ret: first > 0 ? Number(((last / first - 1) * 100).toFixed(2)) : 0,
      bars: m.bars,
    };
  });

  return {
    points,
    members: membersOut.sort((a, b) => b.ret - a.ret),
    excluded,
    stats: {
      ret: Number(ret.toFixed(2)),
      vol: Number(vol.toFixed(2)),
      maxDrawdown: Number(maxDd.toFixed(2)),
      sessions: t,
    },
  };
}

/**
 * 相对强弱：链指数相对基准（如沪深300）的超额。
 * 两条曲线各自以窗口首日为基点归一化，因此比较的是**同起点的相对表现**。
 */
export function relativeStrength(
  chain: Array<{ date: string; value: number }>,
  benchmark: Array<{ date: string; value: number }>
): Array<{ date: string; excess: number }> {
  const bm = new Map(benchmark.map((p) => [p.date, p.value]));
  const c0 = chain[0]?.value;
  const b0 = benchmark[0]?.value;
  if (!c0 || !b0) return [];
  const out: Array<{ date: string; excess: number }> = [];
  for (const p of chain) {
    const b = bm.get(p.date);
    if (b == null) continue;
    // 链相对基准的累计超额（百分点）
    out.push({ date: p.date, excess: Number((((p.value / c0) / (b / b0) - 1) * 100).toFixed(2)) });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 环节级拆解：上游 / 中游 / 下游各段的表现对比
 * ------------------------------------------------------------------ */

export interface StageResult {
  stage: string;
  /** 段内等权区间收益 % */
  ret: number;
  /** 段内参与计算的成员数 */
  count: number;
  /** 段内成员（按收益降序） */
  members: Array<{ secid: string; name: string; ret: number }>;
}

/**
 * 按层级拆解：对每段内部的成员做同样的等权合成，输出各段区间收益。
 *
 * 为什么值得单独算：整链涨 20% 可能是三段齐涨，也可能是中游涨 60% 而上游跌 ——
 * 这两种情况的含义完全不同。只看整链会把这个差别抹掉。
 *
 * 口径与整链一致：段内等权、同一共同窗口、基点 1000。
 * 段内不足 2 个有效成员时不给该段结论（单个股票的"段表现"就是个股表现，不是段）。
 */
export function stageBreakdown(members: MemberSeries[], minBars = MIN_BARS): StageResult[] {
  const stages = ["上游", "中游", "下游"];
  const out: StageResult[] = [];

  for (const stage of stages) {
    const group = members.filter((m) => m.stage === stage && m.bars >= minBars && m.dates.length === m.closes.length);
    if (group.length < 2) {
      out.push({ stage, ret: 0, count: group.length, members: [] });
      continue;
    }
    const idx = buildChainIndex(group);
    if (!idx.points.length) {
      out.push({ stage, ret: 0, count: group.length, members: [] });
      continue;
    }
    out.push({
      stage,
      ret: idx.stats.ret,
      count: idx.members.length,
      members: idx.members.map((m) => ({ secid: m.secid, name: m.name, ret: m.ret })),
    });
  }
  return out;
}

/**
 * 从环节拆解推出**可核对的结论**（不是主观评论）。
 *
 * 每一句都由具体数字支撑，并且能在面板上被逐项验算：
 *   - 最强/最弱段及其收益差（分化度）
 *   - 分化度是否显著（阈值 5 个百分点，低于则视为三段同步）
 *   - 整链更接近哪一段（判断行情由谁驱动）
 * 数据不足时明确说"不给结论"，而不是硬凑一句话。
 */
export function interpretStages(
  stages: StageResult[],
  chainRet: number
): { points: string[]; insufficient: boolean } {
  const valid = stages.filter((s) => s.members.length >= 2);
  if (valid.length < 2) {
    return {
      points: ["有效层级不足两段，无法判断行情由哪一段驱动（段内需至少 2 只有足够日线的成员）"],
      insufficient: true,
    };
  }

  const sorted = [...valid].sort((a, b) => b.ret - a.ret);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const spread = Number((best.ret - worst.ret).toFixed(2));

  const points: string[] = [];
  points.push(
    `窗口内 ${best.stage} 表现最强（${fmtPct(best.ret)}），${worst.stage} 最弱（${fmtPct(worst.ret)}），` +
      `段间分化 ${spread.toFixed(2)} 个百分点。`
  );

  if (spread < 5) {
    points.push("三段收益差不足 5 个百分点，可视为同涨同跌，整链表现不由某一段单独驱动。");
  } else {
    // 整链更接近哪一段：差值小的一方即驱动段
    const dBest = Math.abs(chainRet - best.ret);
    const dWorst = Math.abs(chainRet - worst.ret);
    const driver = dBest <= dWorst ? best : worst;
    const other = driver === best ? worst : best;
    points.push(
      `整链 ${fmtPct(chainRet)} 更接近${driver.stage}的 ${fmtPct(driver.ret)}（相差 ${Math.abs(chainRet - driver.ret).toFixed(2)} 个百分点），` +
        `而${other.stage}为 ${fmtPct(other.ret)} —— 本轮行情主要由${driver.stage}驱动。`
    );
    if (driver === worst) {
      points.push("注意：驱动段恰是最弱段，说明强势成员集中在其它层级，整链收益被平均后低于最强段。");
    }
  }

  if (valid.length < 3) {
    points.push(`仅有 ${valid.length} 个层级有足够成员参与计算，其余层级成员不足 2 只或日线不够，未纳入拆解。`);
  }

  return { points, insufficient: false };
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export { TRADING_DAYS };