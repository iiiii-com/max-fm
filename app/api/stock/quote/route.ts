import { NextResponse } from "next/server";
import { fetchStockQuote } from "@/lib/data/quotes";

export const dynamic = "force-dynamic";

/**
 * 单只 A 股实时快照：GET /api/stock/quote?secid=1.600519
 *
 * 个股页的 K 线只更新到最近一根日线，盘中价格会「停在昨收」。
 * 该接口补实时价（东财 push2 优先，新浪 hq 兜底），缓存 15 秒。
 * 两个源都失败 → 502，前端保留日线收盘并标注「延迟」。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secid = (searchParams.get("secid") || "").trim();
  if (!/^\d\.\d{6}$/.test(secid)) {
    return NextResponse.json({ ok: false, error: "secid 参数不合法" }, { status: 400 });
  }
  try {
    const quote = await fetchStockQuote(secid);
    if (!quote) {
      return NextResponse.json(
        { ok: false, error: "实时行情暂不可用，请稍后重试" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true, quote, time: Date.now() },
      { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "实时行情暂不可用，请稍后重试" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
