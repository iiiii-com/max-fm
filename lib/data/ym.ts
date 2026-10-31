/**
 * 「月/日」口径的纯函数（北京时间）。
 *
 * 为什么单独成模块：月报的 slug、发布时间、历史月补齐都依赖这几个函数，
 * 而它们曾经出过真实事故——
 *  - currentYm 用 toISOString() 取月：UTC 服务器上每月 1 日 00:00–08:00（CST）会算成上个月；
 *  - 历史月报 publishDate 不用月末而用生成当天，导致排序错乱；
 *  - prevYm 在 1 月没有回退到上一年 12 月。
 * 放在纯模块里可以脱离数据库/网络直接单测（tests/ym.test.ts）。
 */

const CST_OFFSET_MS = 8 * 3600 * 1000;

/** 北京时间今日 yyyy-mm-dd */
export function cstToday(now = Date.now()): string {
  return new Date(now + CST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 当前月份 yyyy-mm（北京时间） */
export function currentYm(now = Date.now()): string {
  return new Date(now + CST_OFFSET_MS).toISOString().slice(0, 7);
}

/** 某月最后一天（历史月报的发布时间用它，保证按 publishDate 排序时旧月在前） */
export function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return `${ym}-01`;
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

/** 上月 yyyy-mm（用于「每月 1–5 日补齐上个月月报」），1 月回退到上一年 12 月 */
export function prevYm(ym = currentYm()): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** 人类可读月份标签：2026-10 → 2026 年 10 月 */
export function monthLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  return `${m[1]} 年 ${Number(m[2])} 月`;
}
