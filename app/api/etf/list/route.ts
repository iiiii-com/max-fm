import { NextResponse } from "next/server";
import { fetchEtfBoard, ETF_CATS, type EtfCat } from "@/lib/data/market";

export const dynamic = "force-dynamic";

const SORTS = ["amount", "pct", "pct_asc", "turnover", "code"] as const;
type Sort = (typeof SORTS)[number];

/**
 * ETF 全市场榜单（活跃度榜）。
 *
 * 为什么不是「全量 1654 只」：东财 clist 单页上限 100 条，全量要 17 个请求，
 * 30 秒刷新一轮就是对免费源自伤（见 lib/data/upstream-cache 注释）。
 * 这里取 4 个 ETF 板块各自的成交额前 100，合计约 400 只主流 ETF ——
 * 覆盖宽基/行业/跨境/商品/货币里所有真正有流动性的品种，够用且请求数可控。
 *
 * 参数：cat=全部|宽基|行业|跨境|商品|债券|货币|策略，sort，q（代码/名称），offset，limit(≤100)
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const catRaw = sp.get("cat")?.trim() || "全部";
  const cat = (ETF_CATS as string[]).includes(catRaw) ? (catRaw as EtfCat) : null;
  const sortRaw = sp.get("sort") as Sort | null;
  const sort: Sort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : "amount";
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));

  const board = await fetchEtfBoard();
  if (!board) {
    return NextResponse.json(
      { ok: false, error: "ETF 榜单暂不可用：上游行情源超时，请稍后重试" },
      { status: 502 }
    );
  }

  let list = cat ? board.filter((d) => d.cat === cat) : board.slice();
  if (q) {
    list = list.filter((d) => d.code.includes(q) || d.name.toLowerCase().includes(q));
  }

  switch (sort) {
    case "pct":
      list.sort((a, b) => b.changePct - a.changePct);
      break;
    case "pct_asc":
      list.sort((a, b) => a.changePct - b.changePct);
      break;
    case "turnover":
      list.sort((a, b) => (b.turnover ?? -1) - (a.turnover ?? -1));
      break;
    case "code":
      list.sort((a, b) => a.code.localeCompare(b.code));
      break;
    default:
      list.sort((a, b) => b.amount - a.amount);
  }

  const total = list.length;
  const up = list.filter((d) => d.changePct > 0).length;
  const down = list.filter((d) => d.changePct < 0).length;
  const amount = list.reduce((s, d) => s + d.amount, 0);
  const avgPct = total ? list.reduce((s, d) => s + d.changePct, 0) / total : 0;
  const items = list.slice(offset, offset + limit);
  const degraded = board.length > 0 && board.every((d) => d.sourceMode === "sina");

  return NextResponse.json(
    {
      ok: true,
      updated: new Date().toISOString(),
      cat: catRaw,
      sort,
      total,
      stats: { up, down, flat: total - up - down, avgPct, amount },
      items,
      degraded,
      note: degraded
        ? "东财榜单接口暂不可用，已切换新浪行情兜底（覆盖主流 ETF，不含换手率）"
        : "活跃 ETF 榜单：各板块（沪深/跨境/商品/货币）成交额前 100 合并去重；数据约 15~20 秒延迟",
      source: degraded ? "新浪财经行情（降级）" : "东方财富 ETF 板块行情",
    },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } }
  );
}
