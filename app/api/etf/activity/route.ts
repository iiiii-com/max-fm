import { NextResponse } from "next/server";
import { fetchEtfBoard } from "@/lib/data/market";

export const dynamic = "force-dynamic";

/**
 * ETF 成交活跃度 Top10（市场洞察 ETF 专区顶部使用）。
 *
 * 之前这里用 f168 当换手率 —— 但 clist 的 f168 是资金净流入字段，换手率是 f8。
 * 现已统一改为从 fetchEtfBoard() 取数（与 /api/etf/list 同一份缓存），
 * 避免两套字段映射各错各的。
 */
export async function GET() {
  const board = await fetchEtfBoard();
  if (!board) {
    return NextResponse.json({ ok: false, error: "ETF 数据源暂不可用" }, { status: 502 });
  }
  const list = board
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((d) => ({
      code: d.code,
      name: d.name,
      secid: d.secid,
      cat: d.cat,
      price: d.price,
      pct: d.changePct,
      amount: d.amount,
      turnover: d.turnover,
    }));
  const degraded = board.every((d) => d.sourceMode === "sina");
  return NextResponse.json(
    {
      ok: true,
      updated: new Date().toISOString(),
      source: degraded ? "新浪财经行情（降级）" : "东方财富 ETF 板块行情",
      degraded,
      list,
    },
    { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } }
  );
}
