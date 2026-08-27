import { NextResponse } from "next/server";
import { fetchIndexKlineMulti, type IndexKlineBar } from "@/lib/data/index-kline";

export const dynamic = "force-dynamic";

export interface IndexKlineBar_ {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

/**
 * 指数 K 线接口（多源容错：东财 → 新浪/腾讯）
 * 支持全球指数 secid：100.SPX（标普500）/ 100.NDX（纳指）/ 100.DJIA（道指）/
 * 100.HSI（恒指）/ 100.N225（日经）/ 1.000001（上证）等。
 * 修复：本机环境东财不可达时自动降级新浪/腾讯；N225/KS11/GDAXI/FTSE 仅东财支持（线上可用）。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const days = Math.min(500, Math.max(5, Number(searchParams.get("days") ?? 60)));

  const { bars, source } = await fetchIndexKlineMulti(secid, days);

  if (!bars.length) {
    return NextResponse.json(
      { error: "指数 K 线暂不可用（本机数据源受限，请刷新重试或访问线上版本）" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    name: secid,
    code: secid.split(".")[1],
    secid,
    source,
    klines: bars,
  });
}

export type { IndexKlineBar_ as IndexKlineBar };
