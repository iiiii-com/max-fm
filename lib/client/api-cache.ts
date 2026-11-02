/**
 * 客户端「同源同 URL 请求合并 + 短 TTL 复用」。
 *
 * 背景（2026-11-02 线上实测，tmp/waterfall.py 抓 /lab）：
 * 一个页面里 Ticker、LiveCoreIndexes、GlobalIndexBoard、LabTerminal、MarketBreadth
 * 各自 `fetch("/api/quotes")` / `fetch("/api/market/breadth")`，且都带 `cache: "no-store"`。
 * 结果是**同一时刻对同一个接口发 3～4 个完全相同的请求**，在 Serverless 上每个都会
 * 命中一只冷实例（各自去等 2～3 秒的上游），把一个 160ms 的接口拖成 3.5 秒，
 * 还顺带把 Vercel 的函数调用数和 Neon 唤醒次数翻了几倍。
 *
 * 这一层做的事很少，但正是「少发请求」最直接的落点：
 *   1. 同一个 URL 在 TTL 内的第二次调用直接复用结果（内存）；
 *   2. 同一 URL 已有请求在飞时，后到的调用者等同一个 Promise（并发合并）；
 *   3. 失败不缓存（避免把一次 502 记住 8 秒），下一次调用会真正重试；
 *   4. `force: true` 用于「用户手动点刷新」这类必须穿透缓存的场景。
 *
 * 注意：这里缓存的是**接口响应**，不是页面数据快照；TTL 一律取小于服务端
 * `s-maxage` 的值（例如服务端 quotes=15s，这里 8s），保证不会比服务端更旧。
 *
 * 为什么把 Map 挂在 globalThis 上：Turbopack 会按路由/入口把同一个模块拆进不同
 * chunk，页面里两个组件若来自不同入口，模块级的 Map 会有**两份实例**，就合并不到
 * 一起（实测 /lab 仍发出 3 份 /api/quotes）。挂到 globalThis 后，同一次页面会话里
 * 无论代码被拆成几份，用的都是同一份缓存与同一张在飞表。
 */

interface Entry {
  at: number;
  data: unknown;
}

interface ApiCacheHost {
  store: Map<string, Entry>;
  inflight: Map<string, Promise<unknown>>;
}

const HOST_KEY = "__maxApiCache";

function host(): ApiCacheHost {
  const g = globalThis as unknown as Record<string, ApiCacheHost | undefined>;
  let h = g[HOST_KEY];
  if (!h) {
    h = { store: new Map<string, Entry>(), inflight: new Map<string, Promise<unknown>>() };
    g[HOST_KEY] = h;
  }
  return h;
}

export interface FetchJsonOptions {
  /** 本地复用窗口，默认 8 秒；应小于服务端 s-maxage */
  ttlMs?: number;
  /** true 时忽略本地缓存直接请求（手动刷新按钮用） */
  force?: boolean;
  /** 请求失败时的兜底值；不传则返回 null */
  fallback?: unknown;
  /** 外部取消信号（页面卸载/切换标的时中止在飞请求） */
  signal?: AbortSignal;
}

/** 清空客户端缓存（切换账号/退出登录等场景） */
export function clearJsonCache(prefix?: string): void {
  const { store } = host();
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) if (k.startsWith(prefix)) store.delete(k);
}

/** 供诊断/测试：当前本地缓存条目数 */
export function jsonCacheSize(): number {
  return host().store.size;
}

export async function fetchJson<T = unknown>(url: string, opts: FetchJsonOptions = {}): Promise<T | null> {
  const ttl = opts.ttlMs ?? 8_000;
  const { store, inflight } = host();

  if (!opts.force) {
    const hit = store.get(url);
    if (hit && Date.now() - hit.at < ttl) return hit.data as T;
    const pending = inflight.get(url);
    if (pending) return (await pending) as T;
  }

  const task = (async () => {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: opts.signal });
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      store.set(url, { at: Date.now(), data });
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, task);
  const out = (await task) as T | null;
  if (out == null) return (opts.fallback as T) ?? null;
  return out;
}

/**
 * K 线请求合并。实验室主图、BatchScanner、TechLevels、StockDeepView 会对
 * **同一个 secid / 周期 / 根数**各发一次（每次 200KB～1MB），是首屏最大的重复流量。
 * 统一走这里后，同参请求只发一次。
 */
export function fetchKline<T = unknown>(
  secid: string,
  period: "day" | "week" | "month" = "day",
  days = 500,
  opts: FetchJsonOptions = {}
): Promise<T | null> {
  const url = `/api/stock/kline?secid=${encodeURIComponent(secid)}&period=${period}&days=${days}`;
  // 日线盘中 20s、盘后 10min；客户端 TTL 取更短的一侧，避免比服务端更旧。
  const ttl = opts.ttlMs ?? (period === "day" ? 20_000 : 120_000);
  return fetchJson<T>(url, { ...opts, ttlMs: ttl });
}
