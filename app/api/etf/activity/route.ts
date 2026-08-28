import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** ETF 成交活跃度榜（东财 ETF clist f6 成交额 Top10） */
export async function GET() {
  try {
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f6&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f12,f14,f2,f3,f6,f168`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
      signal: AbortSignal.timeout(10000),
    });
    const j = await res.json();
    const list = ((j?.data?.diff ?? []) as any[]).map((d) => {
      const t = d.f168;
      return {
        code: d.f12, name: d.f14, price: d.f2 ?? null, pct: d.f3 ?? null,
        amount: d.f6 ?? 0,
        // 货币 ETF 等 f168 返回异常大值 → 视为无效显示 —
        turnover: t != null && isFinite(t) && Math.abs(t) < 100 ? t : null,
      };
    });
    return NextResponse.json(
      { ok: true, updated: new Date().toISOString(), source: "东方财富 ETF 行情", list },
      { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
