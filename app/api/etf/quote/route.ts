import { NextResponse } from "next/server";
import { fetchEtfQuote, computeIndicators } from "@/lib/data/market";
import { fetchKline } from "@/lib/data/kline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secid = new URL(req.url).searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  try {
    const [quote, klines] = await Promise.all([fetchEtfQuote(secid), fetchKline(secid)]);
    if (!quote) return NextResponse.json({ error: "ETF 数据暂不可用" }, { status: 502 });
    return NextResponse.json({ ok: true, quote, signals: computeIndicators(klines ?? []) });
  } catch {
    return NextResponse.json({ error: "ETF 数据暂不可用" }, { status: 502 });
  }
}