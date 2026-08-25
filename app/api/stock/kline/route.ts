import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

export type KlinePeriod = "day" | "week" | "month";

const KLT: Record<KlinePeriod, number> = { day: 101, week: 102, month: 103 };

/**
 * 个股/ETF K 线接口
 * 主数据源：东方财富 push2his（稳定、支持日/周/月 + 前复权）；腾讯 fqkline 降级备用
 * （腾讯对高频访问有反爬拦截，曾导致"数据有时无法加载"）。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const periodRaw = (searchParams.get("period") ?? "day").trim();
  const period: KlinePeriod = periodRaw === "week" ? "week" : periodRaw === "month" ? "month" : "day";
  const days = Math.min(500, Math.max(10, Number(searchParams.get("days") ?? 250)));

  // 东财主源
  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(
      secid
    )}&klt=${KLT[period]}&fqt=1&beg=20200101&end=20261231&lmt=${days}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { Referer: "https://quote.eastmoney.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) throw new Error(`em ${res.status}`);
    const json = await res.json();
    const data = json?.data;
    const raw: string[] = data?.klines ?? [];
    if (!Array.isArray(raw) || !raw.length) throw new Error("empty");
    const klines: KlineBar[] = raw.slice(-days).map((row) => {
      const [date, open, close, high, low, volume, amount] = row.split(",");
      return {
        date,
        open: Number(open),
        close: Number(close),
        high: Number(high),
        low: Number(low),
        volume: Math.round(Number(volume)),
        amount: Math.round(Number(amount)),
      };
    });
    return NextResponse.json({ name: String(data?.name ?? secid), code: String(data?.code ?? secid), secid, period, klines });
  } catch {
    /* 东财失败 → 腾讯备用 */
  }

  // 腾讯备用（部分市场东财无数据时）
  try {
    const [mkt, code] = secid.split(".");
    const prefix = mkt === "1" ? "sh" : mkt === "0" ? "sz" : mkt === "100" ? "hk" : "sh";
    const param = `${prefix}${code}`;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param},${period},,,${days},qfq`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) throw new Error(`tx ${res.status}`);
    const json = await res.json();
    const node = json?.data?.[param];
    const raw: any[][] = node?.[`qfq${period}`] || node?.[period] || [];
    if (!Array.isArray(raw) || !raw.length) throw new Error("empty");
    const klines: KlineBar[] = raw.map((row: any[]) => ({
      date: String(row[0]),
      open: Number(row[1]),
      close: Number(row[2]),
      high: Number(row[3]),
      low: Number(row[4]),
      volume: Math.round(Number(row[5]) * 100),
      amount: 0,
    }));
    return NextResponse.json({ name: String(node?.qt?.name ?? param), code, secid, period, klines });
  } catch {
    return NextResponse.json({ error: "K 线数据暂不可用" }, { status: 502 });
  }
}
