import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface GlobalKlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

// 新浪美股指数代码映射
const SINA_SYMBOLS: Record<string, string> = {
  SPX: ".INX",
  NDX: ".IXIC",
  DJIA: ".DJI",
  N225: ".N225",
  GDAXI: ".GDAXI",
  FTSE: ".FTSE",
  FCHI: ".FCHI",
  HSI: ".HSI",
  TWII: ".TWII",
  KS11: "KS11",
};

// GET /api/global/kline?code=SPX&days=120
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") ?? "").toUpperCase().trim();
  const days = Math.min(800, Math.max(10, Number(searchParams.get("days")) || 120));
  const symbol = SINA_SYMBOLS[code];
  if (!symbol) return NextResponse.json({ error: "不支持的指数" }, { status: 400 });
  try {
    const url = `https://stock.finance.sina.com.cn/usstock/api/jsonp.php/var%20_=/US_MinKService.getDailyK?symbol=${symbol}&___qn=3`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126",
        Referer: "https://finance.sina.com.cn",
      },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 300 }, // 5 分钟缓存
    });
    if (!res.ok) throw new Error(`sina api ${res.status}`);
    const text = await res.text();
    // 响应格式：/*<script>...*/var _=([{...}]);
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) throw new Error("parse fail");
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr) || !arr.length) throw new Error("empty");
    const bars: GlobalKlineBar[] = arr.slice(-days).map((row: any) => ({
      date: String(row.d),
      open: Number(row.o),
      close: Number(row.c),
      high: Number(row.h),
      low: Number(row.l),
      volume: Number(row.v) || 0,
    }));
    return NextResponse.json({ ok: true, code, name: code, bars });
  } catch {
    return NextResponse.json({ error: "该指数历史 K 线暂不可用" }, { status: 502 });
  }
}
