/**
 * 个股 → 产业链 归属查询。
 *
 * GET /api/stock/chain?secid=1.600519
 *
 * 个股名称来自东财行情源（与 /api/stock/fundamentals 同一数据面），
 * 再用 chain_nodes.companies 里已存的 375 个环节公司名反查归属。
 * 不硬编码任何个股代码，也不猜测匹配 —— 匹配不上就返回 chains: []，
 * 前端整块不渲染，不显示占位文案。
 */
import { NextResponse } from "next/server";
import { getChainIndexRows } from "@/lib/data/queries";
import { indexByCompany, type StockChainRef } from "@/lib/data/chainIndex";
import { cached } from "@/lib/data/upstream-cache";

export const dynamic = "force-dynamic";

const TTL = 5 * 60 * 1000;

/** 个股名称：与 /api/stock/fundamentals 同一数据面、同一字段 f58 */
async function fetchStockName(secid: string): Promise<string | null> {
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58&fltt=2&invt=2`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const d = (await res.json())?.data;
  const n = d?.f58;
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secid = (url.searchParams.get("secid") ?? "").replace(/[^\d.]/g, "");
  if (!secid || !secid.includes(".")) {
    return NextResponse.json({ ok: false, error: "secid 格式应为 市场.代码，如 1.600519" }, { status: 400 });
  }

  try {
    const out = await cached(`stock-chain:${secid}`, TTL, async () => {
      // 个股名称：与 fundamentals 同源，避免同一页面出现两个不同名字
      const name = await fetchStockName(secid).catch(() => null);
      if (!name) return { ok: true, secid, name: null, chains: [] };

      const rows = await getChainIndexRows();
      const refs: StockChainRef[] = indexByCompany(rows).get(name) ?? [];

      // 同一公司可能落在同一条链的多个环节（如比亚迪 = 动力电池 + 整车制造），
      // 合并成一条链下的多环节，避免页面上出现两条同名链
      const byChain = new Map<string, { chainSlug: string; chainName: string; nodes: StockChainRef[] }>();
      for (const r of refs) {
        const cur = byChain.get(r.chainSlug) ?? {
          chainSlug: r.chainSlug,
          chainName: r.chainName,
          nodes: [],
        };
        cur.nodes.push({ ...r, peers: r.peers.filter((p) => p !== name) });
        byChain.set(r.chainSlug, cur);
      }
      const chains = [...byChain.values()].sort((a, b) => a.chainName.localeCompare(b.chainName, "zh"));
      return { ok: true, secid, name, chains };
    });

    return NextResponse.json(out.data ?? { ok: false, error: "上游不可达" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
