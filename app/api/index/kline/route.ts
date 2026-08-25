import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface IndexKlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

/**
 * 指数 K 线接口（东财 push2his）
 * 支持全球指数 secid：100.SPX（标普500）/ 100.NDX（纳指）/ 100.DJIA（道指）/
 * 100.HSI（恒指）/ 100.N225（日经）/ 1.000001（上证）等。
 * 说明：腾讯 fqkline 对 100. 前缀美股指数处理错误且易被反爬拦截，故指数走东财数据源。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const days = Math.min(500, Math.max(5, Number(searchParams.get("days") ?? 60)));
  const end = "20261231";
  const beg = "20200101";

  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(
      secid
    )}&klt=101&fqt=0&beg=${beg}&end=${end}&lmt=${days}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: {
        Referer: "https://quote.eastmoney.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });
    if (!res.ok) throw new Error(`eastmoney ${res.status}`);
    const json = await res.json();
    const data = json?.data;
    const raw: string[] = data?.klines ?? [];
    if (!Array.isArray(raw) || !raw.length) throw new Error("empty");

    const klines: IndexKlineBar[] = raw.slice(-days).map((row) => {
      const [date, open, close, high, low, volume] = row.split(",");
      return {
        date,
        open: Number(open),
        close: Number(close),
        high: Number(high),
        low: Number(low),
        volume: Math.round(Number(volume)),
      };
    });

    return NextResponse.json({
      name: String(data?.name ?? secid),
      code: String(data?.code ?? secid.split(".")[1]),
      secid,
      klines,
    });
  } catch {
    return NextResponse.json({ error: "指数 K 线暂不可用" }, { status: 502 });
  }
}
