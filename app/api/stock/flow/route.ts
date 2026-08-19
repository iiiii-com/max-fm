import { NextResponse } from "next/server";
import { fetchStockFlow, computeIndicators, scoreStock } from "@/lib/data/market";
import { fetchKline, fetchFundamentals } from "@/lib/data/kline";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ok: true, flow, signals, score });
  } catch {
    return NextResponse.json({ error: "资金流数据暂不可用" }, { status: 502 });
  }
}