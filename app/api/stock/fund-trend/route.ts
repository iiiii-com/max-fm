import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 个股主力资金分时（东财 fflow klt=1 分钟级；非交易时段返回空） */
export async function GET(req: Request) {
  const secid = new URL(req.url).searchParams.get("secid") ?? "1.600519";
  try {
    const res = await fetch(
      `https://push2his.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=0&klt=1&secid=${secid}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" }, signal: AbortSignal.timeout(10000) }
    );
    const j = await res.json();
    const rows = (j?.data?.klines ?? []) as string[];
    // 行格式：时间,主力净流入,小单,中单,大单,超大单,...
    const trend = rows.map((line) => {
      const p = line.split(",");
      return { t: p[0]?.slice(11) ?? "", main: p[1] ? Number(p[1]) : null };
    });
    return NextResponse.json(
      {
        ok: true,
        updated: new Date().toISOString(),
        source: "东方财富 fflow 分钟级资金",
        name: j?.data?.name ?? "",
        inTrading: trend.length > 0,
        trend,
      },
      { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
