/**
 * 个股日线收盘价取数（push2his）。
 *
 * 抽成共享模块的原因：watchlist 组合诊断与产业链指数都需要"批量取多只股票的日线"，
 * 各自抄一份的话，重试/超时/停牌过滤的口径就会慢慢分叉 ——
 * 同一天的两个页面给出不一致的收益，比其中一个页面没有数据更糟。
 */

import { readBars, writeBars } from "@/lib/data/bar-cache";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Referer: "https://quote.eastmoney.com/",
};

// Windows 下 curl 位于 System32（Schannel TLS 栈），对东财的成功率显著高于 Node 的 undici。
// 与 lib/data/sector-kline.ts 同一套降级策略：fetch 重试 → curl 兜底。
const CURL_BIN = process.platform === "win32" ? "C:\\Windows\\System32\\curl.exe" : "curl";

export interface DailyClose {
  date: string;
  close: number;
}

function parseKlines(klines: unknown, days: number): DailyClose[] {
  if (!Array.isArray(klines)) return [];
  const out: DailyClose[] = [];
  for (const row of (klines as string[]).slice(-days)) {
    const p = String(row ?? "").split(",");
    const close = Number(p[1]);
    // 停牌日与零价直接丢弃：当成 0 会把收益算成 -100%
    if (p[0] && close > 0) out.push({ date: p[0], close });
  }
  return out;
}

/**
 * 单进程内存缓存。
 *
 * 为什么必须有：链指数要取 20 只成员的日线，组合诊断要取自选股 —— 每次请求都重新
 * 抓一遍会瞬间打出几十个请求，直接触发上游限频（本机实测：并发 5 路 ×（2 次 fetch
 * 重试 + curl 兜底）就会全线 UND_ERR_SOCKET）。
 * 日线数据一天只变一次，30 分钟内复用完全够用。
 *
 * 局限：只在单进程内有效；跨实例由 lib/data/bar-cache.ts 的落库缓存兜住。
 */
const cache = new Map<string, { bars: DailyClose[]; ts: number }>();
const TTL_MS = 30 * 60 * 1000;

function cacheGet(key: string): DailyClose[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.bars;
}

/** 单只标的的日线收盘价（多源容错：内存缓存 → 落库缓存 → fetch 重试 → curl 兜底） */
export async function fetchDailyCloses(secid: string, days: number): Promise<DailyClose[]> {
  const key = `${secid}:${days}`;
  const mem = cacheGet(key);
  if (mem) return mem;

  // ② 落库缓存：跨进程 / 跨 serverless 实例有效，是限频场景下的主要依靠
  const persisted = await readBars(secid, days);
  if (persisted) {
    cache.set(key, { bars: persisted, ts: Date.now() });
    return persisted;
  }

  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}` +
    `&klt=101&fqt=1&beg=19900101&end=20500101&fields1=f1,f2&fields2=f51,f53`;

  // ③ fetch 重试两次（上游会概率性掐断连接）
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000), cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        const bars = parseKlines(j?.data?.klines, days);
        if (bars.length) {
          cache.set(key, { bars, ts: Date.now() });
          void writeBars(secid, days, bars);
          return bars;
        }
      }
    } catch {
      // 落到 curl 兜底
    }
  }

  // ④ curl 兜底（Schannel TLS 栈，对东财成功率显著更高）
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  try {
    const { stdout } = await promisify(execFile)(
      CURL_BIN,
      ["-s", "--max-time", "12", "-A", UA["User-Agent"], "-H", `Referer: ${UA.Referer}`, url],
      { timeout: 15000, maxBuffer: 32 * 1024 * 1024 }
    );
    const bars = parseKlines(JSON.parse(stdout)?.data?.klines, days);
    if (bars.length) {
      cache.set(key, { bars, ts: Date.now() });
      void writeBars(secid, days, bars);
      return bars;
    }
  } catch (e: any) {
    throw new Error(`取数失败（缓存/ fetch / curl 均未成功）：${e?.message ?? e}`);
  }
  throw new Error("kline empty（缓存 / fetch / curl 均未取到数据）");
}

/** 有限并发：一次全发会被上游打到限频，反而整体失败 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}