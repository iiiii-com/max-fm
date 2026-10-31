import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * 行情类接口的「落库快照」。
 *
 * 背景（用户反馈「数据更新不及时 / 有时整块没有数据」的根因）：
 * 东财 push2 集群在本机与部分网络下按**并发连接数**掐断连接（实测并发 8 全失败、
 * 串行全成功），一次页面渲染同时打十几路接口时会成批 UND_ERR_SOCKET，
 * 于是资金流/异动/板块这些面板偶发整块空白。
 *
 * lib/data/last-good.ts 已经做了「进程内 + 磁盘文件」兜底，但：
 *   1. serverless/多实例部署时，另一个实例的磁盘快照读不到；
 *   2. 进程重启后内存快照丢失，只剩最后一份文件；
 *   3. 没有统一的地方记录「这份数据是什么时候抓到的」。
 * 所以这里再落一份数据库快照：定时任务（task=market-prefetch）预取并写库，
 * 页面在上游失败时读快照，并把 dataAt 一并返回给前端标注时间。
 *
 * 存储方式：复用通用表工厂的 market_snapshots 表
 *   code      → 快照键（如 market:fund-rank / sector:board:60）
 *   name      → 人类可读标签（写日志用）
 *   detail    → JSON { body, dataAt }
 *   fetched_at→ 抓取时间（ms）
 */

export interface SnapshotRecord<T> {
  body: T;
  /** 数据抓取时间（ISO 字符串，展示给用户） */
  dataAt: string;
  /** 快照年龄（毫秒），用于判断是否过期 */
  ageMs: number;
}

const DEFAULT_MAX_AGE_MS = 30 * 60_000;

export async function saveSnapshot<T>(kind: string, body: T, dataAt = new Date().toISOString(), label = ""): Promise<void> {
  const ts = now();
  const payload = JSON.stringify({ body, dataAt });
  try {
    // 单键单行：先删后插。快照表只用于兜底，不需要保留历史版本。
    await db.delete(s.marketSnapshots).where(eq(s.marketSnapshots.code, kind));
    await db.insert(s.marketSnapshots).values({
      id: uid("snap"),
      code: kind,
      name: label || kind,
      detail: payload,
      fetchedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    } as any);
  } catch (e: any) {
    // 快照写库失败不能影响主流程（例如首次部署表还没建好）
    console.warn(`[snapshot] 写入失败 ${kind}:`, e?.message ?? e);
  }
}

export async function loadSnapshot<T>(kind: string, maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<SnapshotRecord<T> | null> {
  try {
    const rows = (await db
      .select({ detail: s.marketSnapshots.detail, fetchedAt: s.marketSnapshots.fetchedAt })
      .from(s.marketSnapshots)
      .where(eq(s.marketSnapshots.code, kind))
      .limit(1)) as Array<{ detail: string | null; fetchedAt: number | null }>;
    const row = rows[0];
    if (!row?.detail) return null;
    const fetchedAt = Number(row.fetchedAt ?? 0);
    const ageMs = fetchedAt > 0 ? Date.now() - fetchedAt : Number.POSITIVE_INFINITY;
    if (Number.isFinite(ageMs) && ageMs > maxAgeMs) return null;
    const parsed = JSON.parse(row.detail) as { body: T; dataAt?: string };
    const dataAt = parsed.dataAt ?? (fetchedAt > 0 ? new Date(fetchedAt).toISOString() : "");
    return { body: parsed.body, dataAt, ageMs: Number.isFinite(ageMs) ? ageMs : 0 };
  } catch (e: any) {
    console.warn(`[snapshot] 读取失败 ${kind}:`, e?.message ?? e);
    return null;
  }
}
