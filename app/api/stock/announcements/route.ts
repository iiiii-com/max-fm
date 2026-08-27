import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 个股公告聚合（东财公告，A股） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid") ?? "1.600519";
  const [mkt, code] = secid.split(".");
  if (!mkt || !code || mkt === "100") return NextResponse.json({ ok: false, error: "公告仅支持 A 股" }, { status: 400 });
  try {
    const res = await fetch(
      `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=12&page_index=1&ann_type=A&client_source=web&stock_list=${code}`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://data.eastmoney.com/" }, signal: AbortSignal.timeout(10000) }
    );
    const j = await res.json();
    const list = (j?.data?.list ?? []) as Array<{ title: string; notice_date: string; columns?: Array<{ column_name?: string }> }>;
    const anns = list.map((a) => ({
      title: a.title?.replace(/^[^:]+:[^:]+:/, "") ?? "",
      date: (a.notice_date ?? "").slice(0, 10),
      type: a.columns?.[0]?.column_name ?? "",
    }));
    return NextResponse.json(
      { ok: true, anns, updated: new Date().toISOString(), source: "东方财富公告（data.eastmoney.com）" },
      { headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
