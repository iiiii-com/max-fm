import { NextResponse } from "next/server";
import { fetchQuotes, fetchGlobalQuotes, fetchSectors } from "@/lib/data/quotes";

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
 */
const TTL_MS = 15_000;
let cacheAt = 0;
let cachePayload: Payload | null = null;
let inflight: Promise<Payload> | null = null;

async function load(): Promise<Payload> {
  const [quotes, global, sectors] = await Promise.all([fetchQuotes(), fetchGlobalQuotes(), fetchSectors()]);
  return { quotes, global, sectors, time: Date.now() };
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
  const payload = await inflight;
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=15, s-maxage=15", "X-Cache": "MISS" },
  });
}
