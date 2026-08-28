import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchRank(fid: string, fs: string, pz = 10) {
  const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=${fid}&fs=${encodeURIComponent(fs)}&fields=f12,f14,f62,f3`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
    signal: AbortSignal.timeout(10000),
  });
  const j = await res.json();
  return ((j?.data?.diff ?? []) as any[]).map((d) => ({
    code: d.f12, name: d.f14, mainFlow: d.f62 ?? 0, pct: d.f3 ?? null,
  }));
}

/** 板块/个股主力资金流入流出排名（东财 clist f62，A股） */
export async function GET() {
  try {
    const [sectorIn, sectorOut, stockIn, stockOut] = await Promise.all([
      fetchRank("f62", "m:90+t:2+f:!50"), // 板块流入 Top
      fetchRank("-f62", "m:90+t:2+f:!50"), // 板块流出 Top（fid 负数=倒序）
      fetchRank("f62", "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"), // 个股流入 Top
      fetchRank("-f62", "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"), // 个股流出 Top
    ]);
    return NextResponse.json(
      {
        ok: true,
        updated: new Date().toISOString(),
        source: "东方财富资金流（push2 clist f62）",
        sectorIn, sectorOut, stockIn, stockOut,
      },
      { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
