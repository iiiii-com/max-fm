import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 个股/指数历史估值（PE/PB 近 5 年，东财 RPT_VALUEANALYSIS_DET）→ 当前分位 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid") ?? "1.600519";
  // 东财 secuCode：1.600519 → 600519.SH；0.300750 → 300750.SZ
  const [mkt, code] = secid.split(".");
  if (!mkt || !code) return NextResponse.json({ ok: false, error: "secid 格式错误" }, { status: 400 });
  // 指数（000001 等）用 SECURITY_CODE 过滤；个股用 SECUCODE（600519.SH）
  const isIndex = ["000001", "399001", "399006", "000300", "000905", "000688"].includes(code);
  if (!isIndex && mkt !== "1" && mkt !== "0") {
    return NextResponse.json({ ok: false, error: "估值分位暂仅支持 A 股个股/指数" }, { status: 400 });
  }
  try {
    // 近 5 年历史估值（约 1220 交易日）
    const filter = isIndex ? `(SECURITY_CODE%3D%22${code}%22)` : `(SECUCODE%3D%22${code}.${mkt === "1" ? "SH" : "SZ"}%22)`;
    const url =
      `https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_VALUEANALYSIS_DET` +
      `&columns=SECURITY_CODE,TRADE_DATE,PE_TTM,PB_MRQ&filter=${filter}` +
      `&pageNumber=1&pageSize=1240&sortTypes=-1&sortColumns=TRADE_DATE`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://emweb.securities.eastmoney.com/" },
      signal: AbortSignal.timeout(12000),
    });
    const j = await res.json();
    const rows = (j?.result?.data ?? []) as Array<{ TRADE_DATE: string; PE_TTM: number | null; PB_MRQ: number | null }>;
    if (!rows.length) return NextResponse.json({ ok: false, error: "无历史估值数据" }, { status: 404 });

    const pts = rows
      .filter((r) => r.PE_TTM != null && r.PE_TTM > 0)
      .map((r) => ({ date: r.TRADE_DATE.slice(0, 10), pe: Number(r.PE_TTM), pb: r.PB_MRQ != null ? Number(r.PB_MRQ) : null }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const pes = pts.map((p) => p.pe);
    const cur = pes[pes.length - 1];
    const min = Math.min(...pes);
    const max = Math.max(...pes);
    const avg = pes.reduce((a, b) => a + b, 0) / pes.length;
    // 当前 PE 的历史百分位（低于当前值的比例）
    const pctile = (pes.filter((p) => p <= cur).length / pes.length) * 100;

    // 采样降密度（每 5 个点取 1，最多 248 点用于曲线）
    const sampled = pts.filter((_, i) => i % 5 === 0 || i === pts.length - 1);

    return NextResponse.json(
      {
        ok: true,
        secuCode: isIndex ? code : `${code}.${mkt === "1" ? "SH" : "SZ"}`,
        updated: new Date().toISOString(),
        source: "东财历史估值（RPT_VALUEANALYSIS_DET）",
        current: { pe: Number(cur.toFixed(2)), pb: pts[pts.length - 1].pb != null ? Number(pts[pts.length - 1].pb!.toFixed(2)) : null },
        stats: {
          min: Number(min.toFixed(2)),
          max: Number(max.toFixed(2)),
          avg: Number(avg.toFixed(2)),
          pctile: Number(pctile.toFixed(1)), // 当前 PE 历史分位 %
          samples: pts.length,
          period: `${pts[0]?.date} ~ ${pts[pts.length - 1]?.date}`,
        },
        series: sampled.map((p) => ({ date: p.date, pe: Number(p.pe.toFixed(2)) })),
      },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
