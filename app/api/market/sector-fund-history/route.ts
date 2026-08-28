import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 板块主力资金近 N 日历史（东财 fflow daykline，secid 形如 90.BK0737） */
export async function GET(req: Request) {
  const secid = new URL(req.url).searchParams.get("secid") ?? "90.BK0737";
  const days = Math.min(30, Math.max(5, Number(new URL(req.url).searchParams.get("days")) || 10));
  try {
    const res = await fetch(
      `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=${days}&klt=101&secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&fltt=2`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" }, signal: AbortSignal.timeout(10000) }
    );
    const j = await res.json();
    const rows = (j?.data?.klines ?? []) as string[];
    // 行：日期,主力,小单,中单,大单,超大单,主力%,...
    const trend = rows.map((line) => {
      const p = line.split(",");
      return { date: p[0]?.slice(0, 10) ?? "", main: p[1] ? Number(p[1]) : null };
    });
    return NextResponse.json(
      { ok: true, name: j?.data?.name ?? "", secid, updated: new Date().toISOString(), source: "东财板块资金 fflow", trend },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
