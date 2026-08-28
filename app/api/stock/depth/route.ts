import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 盘口摘要 + 当日分时 + 五档买卖盘（东财 push2 + 腾讯 qt，A股/指数） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid") ?? "1.600519";
  try {
    // 1. 盘口摘要
    const q = await fetch(
      `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f168,f169,f170,f171`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" }, signal: AbortSignal.timeout(10000) }
    );
    const qj = await q.json();
    const d = qj?.data ?? {};

    // 0. 五档买卖盘（腾讯 qt.gtimg.cn，A股个股；指数无盘口返回 null）
    let levels: Array<{ side: "bid" | "ask"; price: number; vol: number }> | null = null;
    try {
      const [mkt, code] = secid.split(".");
      if (mkt === "1" || mkt === "0") {
        const tencentSym = `${mkt === "1" ? "sh" : "sz"}${code}`;
        const tq = await fetch(`https://qt.gtimg.cn/q=${tencentSym}`, {
          headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000),
        });
        const txt = await tq.text();
        const m = txt.match(/="([^"]*)"/);
        if (m) {
          const p = m[1].split("~");
          if (p.length > 29) {
            levels = [];
            for (let i = 0; i < 5; i++) {
              const bidP = parseFloat(p[9 + i * 2]);
              const bidV = parseFloat(p[10 + i * 2]);
              const askP = parseFloat(p[19 + i * 2]);
              const askV = parseFloat(p[20 + i * 2]);
              if (isFinite(bidP) && bidP > 0) levels.push({ side: "bid", price: bidP, vol: bidV });
              if (isFinite(askP) && askP > 0) levels.push({ side: "ask", price: askP, vol: askV });
            }
            levels.sort((a, b) => (a.side === b.side ? (a.side === "bid" ? b.price - a.price : a.price - b.price) : a.side === "ask" ? 1 : -1));
          }
        }
      }
    } catch {
      levels = null; // 腾讯失败或指数无盘口
    }

    // 2. 当日分时（trends2，点序列 f51 时间/f52 价/f53 均价/f54 成交量/f55 成交额/f56 均价累计）
    const t = await fetch(
      `https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=1&iscr=0`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" }, signal: AbortSignal.timeout(10000) }
    );
    const tj = await t.json();
    const raw = (tj?.data?.trends ?? []) as string[];
    const trends = raw.map((line) => {
      const p = line.split(",");
      return {
        t: p[0]?.slice(11) ?? "", // 09:30
        price: p[1] ? Number(p[1]) : null, // 最新价
        avg: p[2] ? Number(p[2]) : null, // 当日均价
        high: p[3] ? Number(p[3]) : null, // 分时高
        low: p[4] ? Number(p[4]) : null, // 分时低
        vol: p[5] ? Number(p[5]) : null, // 成交量（手）
        amount: p[6] ? Number(p[6]) : null, // 成交额（元）
      };
    });

    const div = (v: number | undefined) => (v == null ? null : v / 100);
    return NextResponse.json(
      {
        ok: true,
        updated: new Date().toISOString(),
        source: "东方财富实时（push2.eastmoney.com）",
        name: d.f58,
        code: d.f57,
        price: div(d.f43),
        high: div(d.f44),
        low: div(d.f45),
        open: div(d.f46),
        prevClose: div(d.f60),
        volume: d.f47 ?? null,
        amount: d.f48 ?? null,
        volumeRatio: d.f50 ?? null, // 量比（百分比，83 = 0.83）
        limitUp: div(d.f51),
        limitDown: div(d.f52),
        turnover: d.f168 ?? null, // 换手率（百分比 20 = 0.2%）
        change: d.f169 != null ? div(d.f169) : null,
        changePct: d.f170 != null ? div(d.f170) : null,
        amplitude: d.f171 != null ? div(d.f171) : null, // 振幅（百分比）
        trends: trends.slice(-242), // 最近 242 个分时点（约一个交易日）
        levels, // 五档买卖盘（腾讯 qt，A股个股；指数为 null）
        preClose: tj?.data?.preClose ?? div(d.f60),
      },
      { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
