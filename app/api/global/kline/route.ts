import { NextResponse } from "next/server";
import {
  fetchEastmoneyIndex,
  fetchSinaUsIndex,
  fetchTencentIndex,
  EASTMONEY_ONLY,
} from "@/lib/data/index-kline";

export const dynamic = "force-dynamic";

export interface GlobalKlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

/** 新浪美股指数代码映射（仅美股三大指数有历史 K） */
const SINA_SYMBOLS: Record<string, string> = {
  SPX: ".INX",
  NDX: ".IXIC",
  DJIA: ".DJI",
};

// GET /api/global/kline?code=SPX&days=120
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").toUpperCase().trim();
  const days = Math.min(800, Math.max(10, Number(searchParams.get("days")) || 120));

  // 1) 新浪美股（SPX/NDX/DJIA）
  if (SINA_SYMBOLS[code]) {
    const bars = await fetchSinaUsIndex(code, days);
    if (bars?.length) return NextResponse.json({ ok: true, code, name: code, source: "新浪美股", bars });
  }

  // 2) 腾讯（美股三大指数 + 恒指 hkHSI）
  const tx = await fetchTencentIndex(code, days);
  if (tx?.length) return NextResponse.json({ ok: true, code, name: code, source: "腾讯", bars: tx });

  // 3) 东财（N225/KS11/GDAXI/FTSE 等仅东财支持；本机受限时不可用，线上可用）
  if (EASTMONEY_ONLY.includes(code)) {
    const em = await fetchEastmoneyIndex(`100.${code}`, days);
    if (em?.length) return NextResponse.json({ ok: true, code, name: code, source: "东方财富", bars: em });
    return NextResponse.json(
      { error: "该指数历史 K 线暂不可用（数据源受限，线上版本可用）" },
      { status: 502 }
    );
  }

  return NextResponse.json({ error: "不支持的指数" }, { status: 400 });
}
