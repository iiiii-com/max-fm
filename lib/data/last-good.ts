/**
 * 最近一次成功结果缓存（stale-if-error）。
 *
 * 背景：东财 push2 会在并发过高或风控时整批掐断连接（实测并发 8 即 100% 失败），
 * 表现为「有时整块没有数据」。此前失败直接 502/503，用户看到空白卡片，
 * 无法区分「今天真的没数据」与「上游临时不可用」。
 *
 * 策略：成功时保存一份快照（内存 + 磁盘，磁盘让进程重启后仍可用于兜底）；
 * 失败时**明确标记 stale** 后返回最后一次成功值，前端据此显示「数据陈旧」，
 * 绝不把旧数据静默当成实时数据。
 * 只用于可容忍短暂陈旧、且前端有能力标注的榜单类接口；行情/K 线不使用。
 */

import fs from "node:fs";
import path from "node:path";

type Entry = { at: number; body: unknown };

const store = new Map<string, Entry>();

/** 落盘目录：<cwd>/data/cache/last-good（Vercel 只读 FS 时静默跳过） */
const DIR = path.join(process.cwd(), "data", "cache", "last-good");

function fileOf(key: string): string {
  return path.join(DIR, key.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".json");
}

function readFile(key: string): Entry | null {
  try {
    const raw = fs.readFileSync(fileOf(key), "utf8");
    const parsed = JSON.parse(raw) as Entry;
    if (!parsed || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeFile(key: string, entry: Entry): void {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileOf(key), JSON.stringify(entry), "utf8");
  } catch {
    // 只读文件系统（如 serverless）忽略：内存快照仍然可用
  }
}

/** 记录一次成功响应（内存 + 磁盘） */
export function saveLastGood(key: string, body: unknown): void {
  const entry: Entry = { at: Date.now(), body };
  store.set(key, entry);
  writeFile(key, entry);
}

/** 读取最近一次成功响应；超过 maxAgeMs 视为不可用（默认 30 分钟） */
export function loadLastGood<T = any>(key: string, maxAgeMs = 30 * 60_000): { at: number; body: T } | null {
  const hit = store.get(key) ?? readFile(key);
  if (!hit) return null;
  if (Date.now() - hit.at > maxAgeMs) return null;
  return { at: hit.at, body: hit.body as T };
}

/** 给陈旧数据加上显式标记，绝不静默冒充最新 */
export function markStale<T extends Record<string, any>>(
  body: T,
  // 既接受内存快照的毫秒时间戳，也接受落库快照的 ISO 字符串（dataAt），
  // 避免调用方为了传参再写一层转换、也避免把 ISO 字符串当毫秒数塞进 Date()。
  at: number | string,
): T & { stale: true; staleSince: string } {
  const ts = typeof at === "number" ? at : Date.parse(at) || Date.now();
  return { ...body, stale: true, staleSince: new Date(ts).toISOString() };
}
