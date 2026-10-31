/**
 * K 线「对齐到最新交易日」的纯函数层（从 app/api/stock/kline/route.ts 抽出）。
 *
 * 抽出的目的：这段逻辑是**用户可见的正确性核心**——
 *  - 周/月 K 的 date 若用周期起始日，图例会显示「最新 10-19」，看起来像两周没更新；
 *  - 盘中最后一根要叠加实时快照，否则当日价格永远缺一格；
 *  - 周/月量能是周期累计，绝不能被当日快照覆盖（否则看起来缩量 20 倍）。
 * 但它原来是路由内的私有函数、隐式依赖 fetchStockQuote，无法单独测试。
 * 现在把「纯计算」与「取快照」拆开：本文件不碰网络/数据库，可直接被单测覆盖。
 */

import type { KlineBar, KlinePeriod } from "./kline-types";

const CST_OFFSET_MS = 8 * 3600 * 1000;

/** 北京时间「今天」（yyyy-mm-dd）。UTC 服务器上直接 toISOString 会在 00:00–08:00 变成昨天 */
export function cstToday(now = Date.now()): string {
  return new Date(now + CST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 周 K 周期末（周五；节后非周一开始的周顺延到当周最近的周五） */
export function weekEndLabel(start: string): string {
  const d = new Date(start + "T00:00:00Z");
  if (!Number.isFinite(d.getTime())) return start;
  const dow = (d.getUTCDay() + 6) % 7; // 周一=0 … 周日=6
  d.setUTCDate(d.getUTCDate() + (4 - dow));
  return d.toISOString().slice(0, 10);
}

/** 月 K 周期末（自然月最后一天） */
export function monthEndLabel(start: string): string {
  const [y, m] = start.split("-").map(Number);
  if (!y || !m) return start;
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

/** 只需要这几个字段的实时快照（真正的 Quote 是它的超集） */
export interface SnapshotQuote {
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  amount?: number;
  tradeDate?: string;
}

/**
 * 对齐逻辑：
 * 1) 日 K：用实时快照补今天这根（或更新已有今天这根的 close/high/low/volume）；
 * 2) 周/月 K：bar 日期从「周期起始日」改为「周期末交易日」；
 * 3) 当前周期最后一根的日期收敛到实时交易日/今天，并叠加实时价与周期累计量能。
 */
export function finalizeBars(
  period: KlinePeriod,
  klines: KlineBar[],
  quote: SnapshotQuote | null,
  today: string = cstToday(),
): { bars: KlineBar[]; live: boolean; tradeDate?: string } {
  const tradeDate = quote?.tradeDate;
  const bars: KlineBar[] = klines.map((b) => ({ ...b }));
  const last = bars[bars.length - 1];

  if (period === "day") {
    if (quote && tradeDate && quote.price > 0) {
      if (tradeDate > last.date) {
        bars.push({
          date: tradeDate,
          open: quote.open || quote.price,
          close: quote.price,
          high: quote.high || quote.price,
          low: quote.low || quote.price,
          volume: quote.volume || 0,
          amount: quote.amount || 0,
        });
      } else if (tradeDate === last.date) {
        bars[bars.length - 1] = {
          ...last,
          close: quote.price,
          high: Math.max(last.high, quote.high || quote.price),
          low: Math.min(last.low, quote.low || quote.price),
          volume: quote.volume || last.volume,
          amount: quote.amount || last.amount,
        };
      }
    }
    // live 只在「快照交易日期就是今天」时置真（周末/节假日最新一根仍是上个交易日收盘）
    const live = !!tradeDate && tradeDate === today && bars[bars.length - 1].date === tradeDate;
    return { bars, live, tradeDate };
  }

  // 周/月：先记住原始周期起始日，再统一改成周期末日
  const rawStart = last.date;
  const anchor = tradeDate && tradeDate <= today ? tradeDate : today;
  bars.forEach((b, i) => {
    const end = period === "week" ? weekEndLabel(b.date) : monthEndLabel(b.date);
    b.date = i === bars.length - 1 && end > anchor ? anchor : end;
  });
  // 当前周期最后一根叠加实时价（盘中会变，收盘后等于收盘价）
  const cur = bars[bars.length - 1];
  if (quote && quote.price > 0 && tradeDate && tradeDate >= rawStart) {
    cur.close = quote.price;
    cur.high = Math.max(cur.high, quote.high || quote.price);
    cur.low = Math.min(cur.low, quote.low || quote.price);
    /**
     * 量能：周/月柱应是「本周期累计」，绝不能用当日快照的成交量覆盖
     * （原来是 cur.volume = quote.volume，于是月 K 最后一根只显示当天量能，
     *  看起来像成交量突然缩了 20 倍）。这里取两者较大值兜住两种来源：
     *  - 东财周/月 K：本身已含本周期累计（含盘中），保持不变即可；
     *  - 新浪日线聚合：日线只到上一交易日，缺今天的量，用当日快照补上。
     */
    cur.volume = Math.max(cur.volume, quote.volume || 0);
    cur.amount = Math.max(cur.amount, quote.amount || 0);
  }
  return { bars, live: false, tradeDate };
}
