import { NextResponse } from "next/server";
import { cachedMeta } from "./cache";

/**
 * 给「返回 JSON 的行情类接口」加一层进程内 TTL 缓存 + CDN 缓存头。
 *
 * 背景（2026-11-02 线上实测，`tmp/api-latency.py`）：
 * `/api/stock/kline` 在 Vercel 上每次都要 1.9–4.3 秒（median≈2.4s），且响应头是
 * `public, max-age=0, must-revalidate` —— 说明它既没有服务端缓存，也不允许 CDN 缓存，
 * 于是「每刷新一次页面」「每换一只标的」都要重新打一次上游。K 线实验室首屏要等 6–8 秒
 * 才出现图表，主要是这里的锅。
 *
 * 现在的策略：
 *  - 进程内 TTL 缓存（single-flight）：同一实例上并发/重复请求只打一次上游；
 *  - 响应头改成 `s-maxage=<ttl>`：允许 Vercel CDN 在 TTL 内直接命中，跨用户复用；
 *  - 浏览器侧给一个小的 `max-age`（默认 20 秒，且不超过 s-maxage）：这样页面里
 *    `<link rel="preload" as="fetch">` 先把 K 线拉起来、组件真正挂载时的 fetch
 *    能直接命中浏览器缓存，而不是再走一次 160ms 的边缘往返；
 *  - `X-Data-Age` 回传这份数据的年龄，前端/排查时能判断是不是缓存；
 *  - **只缓存 200**：4xx/5xx（上游抖动、参数错误）绝不缓存，避免把一次失败固化 TTL 那么久。
 *
 * 缓存内容的「新鲜度责任」由调用方通过 ttlMs 决定，见 lib/data/market-hours.ts。
 */
export async function cachedJsonResponse(
  key: string,
  ttlMs: number,
  build: () => Promise<NextResponse>,
  /** 浏览器可复用的秒数（默认 20）；用于 preload + 组件 fetch 命中同一次响应 */
  browserMaxAgeSec = 20
): Promise<NextResponse> {
  const ttlSec = Math.max(1, Math.round(ttlMs / 1000));
  const browserMaxAge = Math.min(ttlSec, Math.max(0, Math.round(browserMaxAgeSec)));
  const cacheHeaders = {
    "Cache-Control": `public, max-age=${browserMaxAge}, s-maxage=${ttlSec}, stale-while-revalidate=60`,
  };

  // 非 200 的响应不缓存：用 sentinel 把它带出来，由下面原样返回
  let uncacheable: NextResponse | null = null;

  let meta: { value: { status: number; body: unknown }; ageMs: number; hit: boolean };
  try {
    meta = await cachedMeta(
      key,
      ttlMs,
      async () => {
        const res = await build();
        if (res.status !== 200) {
          uncacheable = res;
          // 抛出以跳过缓存写入（cachedMeta 不缓存异常路径）
          throw new Error("__uncacheable__");
        }
        const body = await res.json().catch(() => null);
        return { status: res.status, body };
      },
      // 上游数据本身不涉及 DB 降级，这里不设置 skipIf
      undefined
    );
  } catch {
    if (uncacheable) {
      const res = uncacheable as NextResponse;
      // 失败响应也给出很短的 CDN 缓存，避免上游抖动时被瞬间打爆，但不进进程缓存
      res.headers.set("Cache-Control", "public, max-age=0, s-maxage=5");
      return res;
    }
    return NextResponse.json({ error: "数据源暂时不可用" }, { status: 502 });
  }

  if (!meta.value.body) {
    return NextResponse.json({ error: "数据源返回空内容" }, { status: meta.value.status || 502 });
  }

  return NextResponse.json(meta.value.body, {
    status: meta.value.status,
    headers: {
      ...cacheHeaders,
      "X-Cache": meta.hit ? "HIT" : "MISS",
      "X-Data-Age": (Math.round(meta.ageMs / 100) / 10).toFixed(1),
    },
  });
}
