import { NextResponse } from "next/server";
import { fetchQuotes, fetchGlobalQuotes, fetchSectors } from "@/lib/data/quotes";

export const dynamic = "force-dynamic";

export async function GET() {
  const [quotes, global, sectors] = await Promise.all([fetchQuotes(), fetchGlobalQuotes(), fetchSectors()]);
  // 行情 20 秒级缓存：浏览器与 CDN 共享，减少重复请求（与免费源 15-20 秒延迟匹配）
  return NextResponse.json(
    { quotes, global, sectors, time: Date.now() },
    { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } }
  );
}
