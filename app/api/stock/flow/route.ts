import { NextResponse } from "next/server";
import { fetchStockFlow, computeIndicators, scoreStock } from "@/lib/data/market";
import { fetchKline, fetchFundamentals } from "@/lib/data/kline";
import { quoteTtlMs } from "@/lib/data/market-hours";

export const dynamic = "force-dynamic";

/**
 * 资金流 + 技术信号 + 评分。
 *
 * 线上实测（2026-11-02）：本接口每次 0.9–2.0 秒，原来没有任何 Cache-Control，
 * Next 默认给 `public, max-age=0, must-revalidate` —— CDN 完全不缓存，
 * 于是个股页每刷新一次就重新等上游一轮。这里按行情档位给 s-maxage：
 * 盘中 30 秒（资金流会变），收盘后 5 分钟（不会再变）。
 */
export async function GET(req: Request) {
  const secid = new URL(req.url).searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  try {
    const [flow, klines, fund] = await Promise.all([
      fetchStockFlow(secid),
      fetchKline(secid),
      fetchFundamentals(secid),
    ]);
    const signals = computeIndicators(klines ?? []);
    const score = scoreStock(flow, signals, fund);
    const ttlSec = Math.max(30, Math.round(quoteTtlMs() / 1000) * 2);
    return NextResponse.json(
      { ok: true, flow, signals, score },
      { headers: { "Cache-Control": `public, max-age=0, s-maxage=${ttlSec}, stale-while-revalidate=120` } }
    );
  } catch {
    return NextResponse.json({ error: "资金流数据暂不可用" }, { status: 502 });
  }
}