import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface FinanceTrendPoint {
  period: string; // 2026中报
  date: string;
  revenue: number | null; // 营业总收入（亿）
  netProfit: number | null; // 归母净利（亿）
  grossMargin: number | null; // 毛利率 %
  roe: number | null; // 加权 ROE %
  eps: number | null;
}

/**
 * 财务三表趋势（东财 F10 主要财务指标，近 8 期）
 * secid: 1.600519 → SECUCODE 600519.SH；0.300750 → 300750.SZ
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const [mkt, code] = secid.split(".");
  if (mkt !== "1" && mkt !== "0") {
    return NextResponse.json({ ok: false, error: "指数不适用财务趋势" }, { status: 200 });
  }
  const secucode = `${code}.${mkt === "1" ? "SH" : "SZ"}`;

  try {
    const url =
      `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_F10_FINANCE_MAINFINADATA` +
      `&columns=SECURITY_NAME_ABBR,REPORT_DATE,REPORT_DATE_NAME,TOTALOPERATEREVE,PARENTNETPROFIT,XSMLL,ROEJQ,EPSJB` +
      `&filter=(SECUCODE%3D%22${secucode}%22)&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORT_DATE`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://emweb.securities.eastmoney.com/" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`em ${res.status}`);
    const json = await res.json();
    const rows = json?.result?.data ?? [];
    if (!Array.isArray(rows) || !rows.length) throw new Error("empty");

    const trend: FinanceTrendPoint[] = rows.map((r: any) => ({
      period: String(r.REPORT_DATE_NAME ?? ""),
      date: String(r.REPORT_DATE ?? "").slice(0, 10),
      revenue: r.TOTALOPERATEREVE != null ? Number((r.TOTALOPERATEREVE / 1e8).toFixed(1)) : null,
      netProfit: r.PARENTNETPROFIT != null ? Number((r.PARENTNETPROFIT / 1e8).toFixed(1)) : null,
      grossMargin: r.XSMLL != null ? Number(r.XSMLL.toFixed(1)) : null,
      roe: r.ROEJQ != null ? Number(r.ROEJQ.toFixed(1)) : null,
      eps: r.EPSJB != null ? Number(r.EPSJB.toFixed(2)) : null,
    }));

    return NextResponse.json({ ok: true, name: String(rows[0]?.SECURITY_NAME_ABBR ?? secid), secid, trend });
  } catch {
    return NextResponse.json(
      { ok: false, error: "财务趋势数据暂不可用（东财 F10 受限，线上可用）" },
      { status: 502 }
    );
  }
}
