/**
 * 日线落库缓存。
 *
 * 为什么必须有：上游 push2his 会按 IP 限频，而链指数（20 只成员）、多链对比
 * （最多 80 只）、组合诊断、行业景气都要批量取日线 —— 每次重抓必然被全线掐断
 * （本机实测：并发 5 路 ×（fetch 重试 + curl 兜底）就整片 UND_ERR_SOCKET）。
 * 进程内内存缓存只在单实例有效，Vercel 每次冷启动都是新进程，所以必须落库。
 *
 * 存储形态：一只标的**一行**，序列 JSON 放 detail 列。
 * 不按「一行一根 K 线」存 —— 385 只 × 500 根 = 19 万行，而这张表是全站最宽的表，
 * 落成 19 万行约 200MB 只为存 6MB 有效数据；取数时本来也是整段取。
 *
 * 失败策略：缓存读/写失败**绝不阻断取数** —— 它是优化，不是依赖。
 * 任何异常都吞掉并继续走网络，否则一个缓存表的问题会变成全站数据不可用。
 */

import { db, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface CachedBar {
  date: string;
  close: number;
}

/**
 * 日线数据的有效期。
 * 日线一天只变一次，但收盘后到次日开盘之间可能补数据，所以给 6 小时 ——
 * 足够把同一交易日内的重复请求全部吃掉，又不会跨日沿用旧收盘。
 */
const TTL_MS = 6 * 60 * 60 * 1000;

const rowId = (secid: string, days: number) => `bars:${secid}:${days}`;

/** 读取缓存；无记录、过期、或解析失败都返回 null（由调用方回源） */
export async function readBars(secid: string, days: number): Promise<CachedBar[] | null> {
  try {
    await bootstrap();
    const rows = (await db
      .select()
      .from(s.dailyBars)
      .where(eq(s.dailyBars.id, rowId(secid, days)))
      .limit(1)) as any[];
    const row = rows[0];
    if (!row) return null;
    const age = Date.now() - Number(row.fetchedAt ?? 0);
    if (!Number.isFinite(age) || age > TTL_MS) return null;
    const parsed = JSON.parse(String(row.detail ?? "[]"));
    if (!Array.isArray(parsed) || !parsed.length) return null;
    // 结构自证：外部数据可能被截断，宁可回源也不要喂半条序列进计算
    const ok = parsed.every(
      (b: any) => typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && typeof b?.close === "number" && b.close > 0
    );
    if (!ok) return null;
    return parsed as CachedBar[];
  } catch {
    return null;
  }
}

/** 写入缓存（upsert）；失败静默 —— 缓存写不进去不该让这次取数失败 */
export async function writeBars(secid: string, days: number, bars: CachedBar[]): Promise<void> {
  if (!bars.length) return;
  try {
    await bootstrap();
    const id = rowId(secid, days);
    const existing = (await db.select().from(s.dailyBars).where(eq(s.dailyBars.id, id)).limit(1)) as any[];
    const payload = {
      id,
      code: secid,
      value: bars.length,
      detail: JSON.stringify(bars),
      fetchedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (existing[0]) {
      await db.update(s.dailyBars).set(payload).where(eq(s.dailyBars.id, id));
    } else {
      await db.insert(s.dailyBars).values(payload as any);
    }
  } catch {
    // 静默：缓存是优化，不是依赖
  }
}

/** 缓存覆盖情况（供诊断用，不影响取数） */
export async function barCacheStats(): Promise<{ rows: number }> {
  try {
    await bootstrap();
    const rows = (await db.select().from(s.dailyBars)) as any[];
    return { rows: rows.length };
  } catch {
    return { rows: 0 };
  }
}