/**
 * 进程内 TTL 缓存 + 单飞（single-flight）。
 *
 * 为什么需要它（数据成本）：
 * Neon 免费版按「CU-hours（活跃算力时长）+ 公网传输流量」计费，而本项目每个页面渲染
 * 都至少查一次库（layout 里的 getSession），/macro 一次要拉 6MB 全表。结果 100 CU-hours
 * 与 5GB/月的传输额度被同时吃光，compute 被挂起 → 全站 500。
 *
 * 这一层的目标不是「让数据更快」，而是「让同样的数据不要重复过网」：
 *   1. 同一进程内 N 秒内的相同读请求只打一次库（TTL）；
 *   2. 并发请求只保留一个在飞（single-flight），避免冷启动瞬间 10 个请求各查一遍。
 *
 * 三条纪律：
 *   - 只缓存「读」结果，写操作永远直接落库；
 *   - 数据库降级期间不写入缓存（否则把「空结果」当成真实数据缓存 N 秒，
 *     恢复后用户还会看到一段空窗）；
 *   - 后台任务（/api/tasks/run）跑完必须 invalidate()，否则用户看到的是同步前的旧数据。
 */

interface Entry<T> {
  at: number;
  value: T;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** 清理所有缓存（后台任务写入后调用），或只清理某个前缀 */
export function invalidateDataCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** 仅供测试/诊断：当前缓存条目数 */
export function dataCacheSize(): number {
  return store.size;
}

export interface CacheOptions {
  /**
   * 结果算出来之后决定「要不要缓存」。
   * 典型用法：数据库降级时返回的空数组不该被缓存，否则恢复后仍要等 TTL 过期。
   */
  skipIf?: () => boolean;
}

/**
 * 带 TTL 与单飞的读缓存。
 *
 * @param key    缓存键（含参数，如 `macro:series`、`policy:list`）
 * @param ttlMs  有效期；数据更新频率越低可以越长
 * @param fn     真正的取数函数
 */
export interface CachedResult<T> {
  value: T;
  /** 这份数据已经在缓存里放了多久（毫秒）；未命中时为 0 */
  ageMs: number;
  /** 是否来自缓存（命中或复用在飞请求） */
  hit: boolean;
}

/**
 * 与 cached 相同，但额外返回「命中信息与数据年龄」。
 *
 * HTTP 层需要它：把 age 写进 X-Data-Age 响应头，用户/排查时能一眼看出
 * 「这份 K 线是 3 秒前的还是 4 分钟前的」，而不是把缓存误当实时行情。
 */
export async function cachedMeta<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts?: CacheOptions
): Promise<CachedResult<T>> {
  // 命中：仍在有效期内直接返回
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return { value: hit.value as T, ageMs: Date.now() - hit.at, hit: true };
  }

  // 单飞：同一键已有请求在飞，直接复用，避免并发穿透（多个图表同时要同一份 K 线）
  const pending = inflight.get(key);
  if (pending) return { value: (await pending) as T, ageMs: 0, hit: true };

  const task = (async () => {
    try {
      const value = await fn();
      // 降级期间的空结果不缓存（见文件头纪律 2）
      if (!opts?.skipIf?.()) {
        store.set(key, { at: Date.now(), value });
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return { value: await task, ageMs: 0, hit: false };
}

/**
 * 带 TTL 与单飞的读缓存。
 *
 * @param key    缓存键（含参数，如 `macro:series`、`policy:list`）
 * @param ttlMs  有效期；数据更新频率越低可以越长
 * @param fn     真正的取数函数
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>, opts?: CacheOptions): Promise<T> {
  const res = await cachedMeta(key, ttlMs, fn, opts);
  return res.value;
}
