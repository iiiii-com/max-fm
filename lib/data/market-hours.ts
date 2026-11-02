/**
 * A 股交易时段判断（北京时间，与服务器时区无关）。
 *
 * 为什么需要它：
 * K 线/行情接口每次都要打上游（东财/新浪/腾讯），单次 2–4 秒。历史 K 线（除最后一根）
 * 是**不会变**的数据，只有「盘中最后一根」会持续跳动。如果全天都用同一个极短 TTL，
 * 要么白白重复拉取上游（慢+耗额度），要么缓存太久让用户看到过期的实时价。
 *
 * 所以缓存的 TTL 按「是否在交易时段」分两档：
 *   - 盘中：短 TTL（K 线 20s / 快照 15s），保证最后一根与实时价足够新；
 *   - 非盘中（含午休、收盘后、周末、节假日）：长 TTL（K 线 10min / 快照 60s），
 *     此时数据本来就不会变，缓存久一点既快又省。
 *
 * 注意：这里只做「周一至周五 + 时段」的判断，不含法定节假日日历 —— 节假日命中长 TTL
 * 的代价只是多缓存几分钟不变的数据（本来也不会变），不会产生错误数据。
 */

const CST_OFFSET_MS = 8 * 3600_000;

interface CstParts {
  /** 0=周日 … 6=周六 */
  day: number;
  hour: number;
  minute: number;
}

/** 取北京时间的星期/时/分（不依赖服务器 TZ） */
export function cstParts(now: Date = new Date()): CstParts {
  const d = new Date(now.getTime() + CST_OFFSET_MS);
  return { day: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/** 是否处于 A 股连续竞价时段（含集合竞价与尾盘，宽松一点没关系） */
export function isTradingTime(now: Date = new Date()): boolean {
  const { day, hour, minute } = cstParts(now);
  if (day === 0 || day === 6) return false;
  const m = hour * 60 + minute;
  const morning = m >= 9 * 60 + 15 && m <= 11 * 60 + 35;
  const afternoon = m >= 12 * 60 + 55 && m <= 15 * 60 + 10;
  return morning || afternoon;
}

/** K 线接口的缓存 TTL：盘中 20s（末根会动），非盘中 10 分钟（历史不会再变） */
export function klineTtlMs(now: Date = new Date()): number {
  return isTradingTime(now) ? 20_000 : 10 * 60_000;
}

/** 行情快照（quotes/quote/depth）TTL：盘中 15s，非盘中 60s */
export function quoteTtlMs(now: Date = new Date()): number {
  return isTradingTime(now) ? 15_000 : 60_000;
}
