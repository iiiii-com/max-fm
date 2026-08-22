import { NextResponse } from "next/server";
import { fetchKline, type KlinePeriod } from "@/lib/data/kline";

export const dynamic = "force-dynamic";

export interface CrisisBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

// GET /api/crisis/kline?secid=100.SPX&from=2007-01-01&to=2009-12-31&period=month
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const periodRaw = (searchParams.get("period") ?? "day").trim();
  const period: KlinePeriod = periodRaw === "month" ? "month" : periodRaw === "week" ? "week" : "day";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const bars = await fetchKline(secid, 8000, { from, to }, period);
  if (!bars?.length) return NextResponse.json({ error: "K线不可用" }, { status: 502 });
  const normalized: CrisisBar[] = bars.map((b) => ({
    date: b.date,
    open: b.open,
    close: b.close,
    high: b.high,
    low: b.low,
    volume: b.volume,
  }));
  return NextResponse.json({ ok: true, bars: normalized, period });
}
