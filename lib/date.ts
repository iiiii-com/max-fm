/**
 * 日期助手：系统内所有"日期"（不带时间）统一用 yyyy-MM-dd 字符串表示。
 * 数据库列类型为 @db.Date，存取时通过 parseYmd/ymd 转换，避免时区漂移。
 */

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 本地时区下的今天 */
export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** "2026-08-22" -> Date (UTC 午夜，与 @db.Date 列一致) */
export function parseYmd(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`非法日期: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

/** 本地时区下 date 的星期几：1=周一 ... 7=周日 */
export function weekdayOf(ymdStr: string): number {
  const d = new Date(`${ymdStr}T12:00:00`);
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** 该日期所在周的周一（本地时区） */
export function weekStartYmd(ymdStr: string = todayYmd()): string {
  const d = new Date(`${ymdStr}T12:00:00`);
  const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(
    mon.getDate()
  ).padStart(2, "0")}`;
}

export function addDaysYmd(ymdStr: string, days: number): string {
  const d = new Date(`${ymdStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** [startYmd, endYmd] 闭区间内的所有日期字符串 */
export function eachYmd(startYmdStr: string, endYmdStr: string): string[] {
  const out: string[] = [];
  let cur = startYmdStr;
  while (cur <= endYmdStr) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}

export function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}
