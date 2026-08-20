import { NextResponse } from "next/server";
import { fetchKline } from "@/lib/data/kline";

export const dynamic = "force-dynamic";

export interface CrisisBar {
  date: string;
  close: number;
}

// GET /api/crisis/kline?secid=100.SPX&from=2007-01-01&to=2009-12-31
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const bars = await fetchKline(secid, 8000);
  if (!bars?.length) return NextResponse.json({ error: "K线不可用" }, { status: 502 });
  const filtered = bars.filter((b) => (!from || b.date >= from) && (!to || b.date <= to));
  if (!filtered.length) return NextResponse.json({ error: "K线不可用" }, { status: 502 });
  const normalized: CrisisBar[] = filtered.map((b) => ({ date: b.date, close: b.close }));
  return NextResponse.json({ ok: true, bars: normalized });
}