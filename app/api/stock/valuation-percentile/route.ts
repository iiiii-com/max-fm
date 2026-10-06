import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 个股/指数历史估值（PE/PB 近 5 年，东财 RPT_VALUEANALYSIS_DET）→ 当前分位
 *
 * 返回结构说明（K线实验室 04 模块此前因读错结构而整块空白）：
 *   current : 最新一期的 PE-TTM / PB-MRQ
 *   stats   : **PE 口径**的统计（min/max/avg/pctile/samples/period），保持历史字段不变
 *   pbStats : **PB 口径**的同结构统计（新增）
 *   bands   : PE / PB 各自的 P10/P25/P50/P75/P90 分位值（新增，供分位带渲染）
 *   series  : 降采样后的 PE 曲线（samples 为未降采样的真实交易日数）
 */
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
    // 近 5 年历史估值（约 1240 个交易日）
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
      .map((r) => ({ date: r.TRADE_DATE.slice(0, 10), pe: Number(r.PE_TTM), pb: r.PB_MRQ != null && r.PB_MRQ > 0 ? Number(r.PB_MRQ) : null }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    /** 分位：小于等于当前值的样本占比 */
    const percentileOf = (arr: number[], cur: number) => (arr.filter((p) => p <= cur).length / arr.length) * 100;
    /** P10/P25/P50/P75/P90：对已排序序列做线性插值取分位 */
    const quantiles = (sorted: number[]) => {
      if (!sorted.length) return null;
      const at = (p: number) => {
        const idx = ((sorted.length - 1) * p) / 100;
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
      };
      return {
        p10: Number(at(10).toFixed(2)),
        p25: Number(at(25).toFixed(2)),
        p50: Number(at(50).toFixed(2)),
        p75: Number(at(75).toFixed(2)),
        p90: Number(at(90).toFixed(2)),
      };
    };
    const statOf = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const cur = arr[arr.length - 1];
      return {
        min: Number(sorted[0].toFixed(2)),
        max: Number(sorted[sorted.length - 1].toFixed(2)),
        avg: Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)),
        pctile: Number(percentileOf(arr, cur).toFixed(1)), // 当前值的历史分位 %
        samples: arr.length,
        bands: quantiles(sorted),
      };
    };

    const pes = pts.map((p) => p.pe);
    const pbs = pts.map((p) => p.pb).filter((v): v is number => v != null && v > 0);
    const cur = pes[pes.length - 1];

    // 最小样本量守卫：样本太少时分位数没有意义（3 天的「历史分位 100%」是噪声不是结论）。
    // PB 原本就有 ≥20 的守卫，PE 漏了 —— 两侧口径必须一致，否则同一张图上一半可信一半不可信。
    const MIN_SAMPLES = 20;
    if (pes.length < MIN_SAMPLES) {
      return NextResponse.json(
        { ok: false, error: `历史估值序列仅 ${pes.length} 个交易日（需 ≥ ${MIN_SAMPLES}），不给分位数` },
        { status: 404 }
      );
    }

    const peStat = statOf(pes);
    const last = pts[pts.length - 1];

    // 采样降密度（每 5 个点取 1，最多约 248 点用于曲线）
    const sampled = pts.filter((_, i) => i % 5 === 0 || i === pts.length - 1);

    return NextResponse.json(
      {
        ok: true,
        secuCode: isIndex ? code : `${code}.${mkt === "1" ? "SH" : "SZ"}`,
        updated: new Date().toISOString(),
        source: "东财历史估值（RPT_VALUEANALYSIS_DET）",
        current: { pe: Number(cur.toFixed(2)), pb: last.pb != null ? Number(last.pb.toFixed(2)) : null },
        // 保持原有 PE 统计字段（老消费方依赖），额外挂 bands
        stats: { ...peStat, period: `${pts[0]?.date} ~ ${last?.date}` },
        pbStats: pbs.length >= MIN_SAMPLES ? statOf(pbs) : null,
        bands: { pe: peStat.bands, pb: pbs.length >= MIN_SAMPLES ? quantiles([...pbs].sort((a, b) => a - b)) : null },
        series: sampled.map((p) => ({ date: p.date, pe: Number(p.pe.toFixed(2)) })),
      },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
