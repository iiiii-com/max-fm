import { NextResponse } from "next/server";
import { fetchQuotes, fetchGlobalQuotes, fetchSectors } from "@/lib/data/quotes";
import { saveSnapshot, loadSnapshot } from "@/lib/data/snapshots";

export const dynamic = "force-dynamic";

type Payload = {
  quotes: Awaited<ReturnType<typeof fetchQuotes>>;
  global: Awaited<ReturnType<typeof fetchGlobalQuotes>>;
  sectors: Awaited<ReturnType<typeof fetchSectors>>;
  time: number;
};

/**
 * 行情快照的进程内缓存（15 秒）。
 *
 * 为什么要加：Ticker / LiveCoreIndexes(25s) / GlobalIndexBoard(30s) 等多个客户端组件
 * 各自轮询本接口，且都带 `cache: "no-store"` 绕过 HTTP 缓存 —— 每个轮询都会真实打一遍
 * 东财 push2 的 3 个上游（个股/指数、全球、板块）。首屏一次就 9 个组件并发。
 * 这里做 15 秒合并：同窗口内只打一次上游，并发请求共享同一个 inflight Promise。
 *
 * 注意：15 秒是「上游免费源的刷新粒度」，不是数据时间戳；响应里的 time 是本次取数时间，
 * 前端展示「实时」时应以各 quote 自带的时间/涨跌为准（见 lib/data/quotes.ts）。
 *
 * 第二阶段（K 线体验优化）：加「上游超时 → 落库快照兜底」。
 * 线上实测冷实例首次取数会 2～15 秒（Vercel iad1 打国内上游），页面首屏全靠这个接口拿
 * 指数报价，用户看到的就是长时间「行情加载中」。现在给上游设 5 秒硬截止：超时就从
 * market_snapshots 读最近一份（明确返回 stale + dataAt，前端不把旧数据伪装成实时），
 * 保证首屏文案与图表框架先出来；后台那次真实的取数仍会继续并写回进程缓存。
 */
const TTL_MS = 15_000;
/** 上游硬截止：超过这个时间就先用快照，别让首屏干等。可用环境变量缩短（联调用）。 */
const UPSTREAM_DEADLINE_MS = Math.max(1, Number(process.env.QUOTES_UPSTREAM_DEADLINE_MS ?? 5_000) || 5_000);
const SNAPSHOT_KEY = "api:quotes";
/** 快照最多能用 24 小时（超出就承认拿不到数据，宁可报错也不显示隔天行情）。 */
const SNAPSHOT_MAX_AGE_MS = 24 * 3600_000;
/** 每实例最多 5 分钟写一次快照，避免把 Neon 额度写光。 */
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60_000;

let cacheAt = 0;
let cachePayload: Payload | null = null;
let inflight: Promise<Payload> | null = null;
let lastSnapshotAt = 0;

async function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`upstream deadline ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function load(): Promise<Payload> {
  const [quotes, global, sectors] = await Promise.all([fetchQuotes(), fetchGlobalQuotes(), fetchSectors()]);
  return { quotes, global, sectors, time: Date.now() };
}

/** 成功取数后落一份库快照（限频，失败不影响主流程）。 */
async function maybeSnapshot(payload: Payload) {
  if (Date.now() - lastSnapshotAt < SNAPSHOT_MIN_INTERVAL_MS) return;
  lastSnapshotAt = Date.now();
  try {
    await saveSnapshot(SNAPSHOT_KEY, payload, new Date(payload.time).toISOString(), "行情快照（指数/全球/板块）");
  } catch {
    /* 快照写库失败不影响行情返回 */
  }
}

export async function GET() {
  const age = Date.now() - cacheAt;
  if (cachePayload && age < TTL_MS) {
    // 命中缓存时给 15 秒的浏览器/CDN 缓存，让轮询也能被浏览器复用。
    return NextResponse.json(cachePayload, {
      headers: { "Cache-Control": "public, max-age=15, s-maxage=15", "X-Cache": "HIT" },
    });
  }
  // 单飞：并发请求共享同一次上游拉取，避免 9 个组件同时压垮上游。
  if (!inflight) {
    inflight = load()
      .then((p) => {
        cachePayload = p;
        cacheAt = Date.now();
        return p;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    const payload = await withDeadline(inflight, UPSTREAM_DEADLINE_MS);
    void maybeSnapshot(payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=15, s-maxage=15", "X-Cache": "MISS" },
    });
  } catch (e) {
    // 上游慢/挂：优先返回落库快照，明确标注 stale 与数据时间。
    const snap = await loadSnapshot<Payload>(SNAPSHOT_KEY, SNAPSHOT_MAX_AGE_MS);
    if (snap) {
      return NextResponse.json(
        { ...snap.body, ok: true, stale: true, dataAt: snap.dataAt },
        {
          headers: {
            "Cache-Control": "public, max-age=10, s-maxage=10",
            "X-Cache": "STALE",
            "X-Data-Age": String(Math.round(snap.ageMs / 1000)),
          },
        }
      );
    }
    const msg = e instanceof Error ? e.message : "行情数据源暂不可达";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
