/**
 * 上游行情缓存（进程内 TTL + 单飞合并）
 *
 * 为什么需要：
 * 一个页面渲染会并发打 5~6 个上游接口（板块榜 / 行情快照 / 风险指标 / K线 / 财报…），
 * 而每个接口内部还可能再发 1~4 个请求。30 秒自动刷新一开，就是每秒十几二十个上游请求。
 * 免费行情源（东财 push2/push2his、datacenter-web）的限频阈值远低于此，
 * 于是站点**把自己的高频轮询打成限频**，表现出来就是各处随机出现
 * 「数据源暂不可用」「源暂缺 · 上游限频」——看起来像数据源坏了，其实是自伤。
 *
 * 这里提供两个能力：
 *  1. `cached(key, ttlMs, loader)`：TTL 内复用同一份结果；
 *  2. 单飞（single-flight）：同一个 key 并发到来时只真正打一次上游，其余等待同一结果。
 *
 * 注意：
 *  - 只用于**行情类**接口。政策/文章等低频内容不要走这里（它们有自己的同步任务）。
 *  - 上游失败时**不缓存失败结果**，但会把失败短暂记住（negative TTL），
 *    避免上游已经挂了还被持续重试放大限频。
 */

interface Entry<T> {
  value: T | null;
  at: number;
  inflight?: Promise<T | null>;
}

const store = new Map<string, Entry<unknown>>();

/** 清理过期的 key，防止 Map 无限增长（页面 key 数量有上限，但动态 secid 可能很多） */
function sweep(now: number) {
  if (store.size < 500) return;
  for (const [k, v] of store) {
    // 成功缓存超过 10 分钟就没必要留了（各调用点 TTL 都远小于此）
    if (now - v.at > 10 * 60 * 1000) store.delete(k);
  }
}

export interface CachedResult<T> {
  data: T | null;
  /** true = 命中 TTL 缓存 */
  hit: boolean;
  /** true = 这次真的打了上游 */
  fetched: boolean;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<CachedResult<T>> {
  const now = Date.now();
  sweep(now);
  const hit = store.get(key) as Entry<T> | undefined;

  // TTL 内且有成功值 → 直接复用
  if (hit && hit.value != null && now - hit.at < ttlMs) {
    return { data: hit.value, hit: true, fetched: false };
  }
  // 失败结果的负缓存：上游已经失败时，短时间内不再重试
  const failTtl = 8_000;
  if (hit && hit.value == null && now - hit.at < failTtl) {
    return { data: null, hit: true, fetched: false };
  }

  // 单飞：并发同 key 只打一次上游
  if (hit?.inflight) {
    const data = await hit.inflight;
    return { data, hit: false, fetched: false };
  }

  const inflight = (async () => {
    try {
      return await loader();
    } catch {
      return null;
    }
  })();
  const entry: Entry<T> = { value: null, at: now, inflight };
  store.set(key, entry);

  const data = await inflight;
  // 无论成功失败都更新 at，便于负缓存生效
  entry.value = data;
  entry.at = Date.now();
  delete entry.inflight;
  return { data, hit: false, fetched: true };
}

/** 仅测试用：清空缓存 */
export function __clearUpstreamCache() {
  store.clear();
}

/** 仅测试用：查看缓存条目数 */
export function __upstreamCacheSize() {
  return store.size;
}
