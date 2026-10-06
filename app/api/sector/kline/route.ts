import { NextResponse } from "next/server";
import { pullSectorKline, type SectorKline } from "@/lib/data/sector-kline";

export const dynamic = "force-dynamic";

export type { SectorKline };

// ---- 服务端缓存（stale-while-revalidate）----
// 日线数据分钟级更新，3 分钟内直接复用缓存（减少对东财的请求 → 反向降低被拦截概率）；
// 拉取失败时回落最近成功数据并标注数据时点（stale + asOf），同时后台静默刷新供下次使用。
interface CacheEntry {
  list: SectorKline[];
  ts: number; // 写入时间戳
}
const klineCache = new Map<string, CacheEntry>(); // key: `${bk}:${lmt}`
const FRESH_MS = 3 * 60 * 1000;
const refreshing = new Set<string>(); // 防并发重复后台刷新

// 后台静默刷新：成功则回填缓存（fire-and-forget，不阻塞响应）
function bgRefresh(key: string, bk: string, lmt: number): void {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  void (async () => {
    try {
      const list = await pullSectorKline(bk, lmt);
      if (list.length) klineCache.set(key, { list, ts: Date.now() });
    } catch {
      // 静默：下次请求再试
    } finally {
      refreshing.delete(key);
    }
  })();
}

export async function GET(req: Request) {
  const bk = new URL(req.url).searchParams.get("bk")?.trim() ?? "";
  /**
   * 板块 K 线默认条数与上限。
   * 原先 Math.min(120, ...) 且默认 30 根 —— 板块 K 线因此只有约 5.8 个月（默认仅 1.5 个月）。
   * 实测东财板块接口 beg=19900101 可返回 6480 根 / 26.7 年（BK0475），
   * 故放开上限并把 beg 放到 1990；lmt 对该接口无效，真正限制是 beg。
   */
  const lmt = Math.min(8000, Math.max(30, Number(new URL(req.url).searchParams.get("lmt")) || 500));
  if (!/^BK\d+$/.test(bk)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const key = `${bk}:${lmt}`;
  const cached = klineCache.get(key);

  // 命中新鲜缓存：直接返回，不发起上游请求
  if (cached && Date.now() - cached.ts < FRESH_MS) {
    return NextResponse.json({ ok: true, bk, list: cached.list, cached: true, asOf: new Date(cached.ts).toISOString() });
  }

  try {
    const list = await pullSectorKline(bk, lmt);
    klineCache.set(key, { list, ts: Date.now() });
    return NextResponse.json({ ok: true, bk, list });
  } catch (e: any) {
    console.error("[sector-kline] error:", e?.message ?? e, "| bk:", bk);
    // 拉新失败但有历史缓存：回落旧数据（标注数据时点）+ 后台刷新，避免核心诉求落空
    if (cached && cached.list.length) {
      bgRefresh(key, bk, lmt);
      return NextResponse.json({ ok: true, bk, list: cached.list, stale: true, asOf: new Date(cached.ts).toISOString() });
    }
    return NextResponse.json({ ok: false, error: "板块 K 线暂不可用" }, { status: 502 });
  }
}
