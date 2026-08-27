import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 市场宽度：涨跌家数 / 红绿比 / 两市成交额（东财实时）
 * 温度判定：上涨占比 >60% 偏热，<40% 偏冷
 */
export async function GET() {
  try {
    const [breadthRes, quotesRes] = await Promise.all([
      fetch(
        "https://push2.eastmoney.com/api/qt/ulist.np/get?secids=1.000001&fields=f104,f105,f106&fltt=2",
        { next: { revalidate: 20 }, headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
      ),
      fetch(`http://localhost:3333/api/quotes`, { cache: "no-store" }),
    ]);
    const bj = await breadthRes.json();
    const diff = bj?.data?.diff?.[0];
    const up = Number(diff?.f104 ?? 0);
    const down = Number(diff?.f105 ?? 0);
    const flat = Number(diff?.f106 ?? 0);
    const qj = await quotesRes.json();
    const quotes = qj?.quotes ?? [];
    const sh = quotes.find((x: any) => x.code === "000001");
    const sz = quotes.find((x: any) => x.code === "399001");
    const amount = (Number(sh?.amount ?? 0) + Number(sz?.amount ?? 0)) / 1e12;

    const total = up + down + flat || 1;
    const upRatio = (up / total) * 100;
    const stage = upRatio >= 60 ? "偏热" : upRatio <= 40 ? "偏冷" : "中性";

    return NextResponse.json({
      ok: true,
      up, down, flat,
      upRatio: Number(upRatio.toFixed(1)),
      amount: Number(amount.toFixed(2)), // 万亿
      stage,
      updated: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "市场宽度数据暂不可用" }, { status: 502 });
  }
}
