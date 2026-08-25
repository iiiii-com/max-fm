import { NextResponse } from "next/server";
import { aggregateBars } from "@/lib/data/indicators";

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
 * 个股/ETF K 线接口（多数据源容错，保证本地/线上双环境可用）
 * 1) 东方财富 push2his（线上 Vercel 可达，日/周/月 + 前复权）
 * 2) 新浪 getKLineData（本地/线上均可达，A 股日线；周/月由日线聚合）★ 本地环境关键源
 * 3) 腾讯 fqkline（部分市场兜底）
 * 背景：本机网络到东财/腾讯均不稳定（曾致"K 线数据暂不可用"），新浪为稳定第三源。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const periodRaw = (searchParams.get("period") ?? "day").trim();
  const period: KlinePeriod = periodRaw === "week" ? "week" : periodRaw === "month" ? "month" : "day";
  const days = Math.min(500, Math.max(10, Number(searchParams.get("days") ?? 250)));
  const [mkt, code] = secid.split(".");

  // ---- 源1：东方财富 ----
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
    const raw: string[] = json?.data?.klines ?? [];
    if (!Array.isArray(raw) || !raw.length) throw new Error("empty");
    const name = String(json?.data?.name ?? secid);
    const klines: KlineBar[] = raw.slice(-days).map((row) => {
      const [date, open, close, high, low, volume, amount] = row.split(",");
      return {
        date, open: Number(open), close: Number(close), high: Number(high), low: Number(low),
        volume: Math.round(Number(volume)), amount: Math.round(Number(amount)),
      };
    });
    return NextResponse.json({ name, code: String(json?.data?.code ?? code), secid, period, klines });
  } catch {
    /* fallthrough */
  }

  // ---- 源2：新浪（A 股/ETF 日线，周/月聚合）----
  if (mkt === "1" || mkt === "0") {
    try {
      const sym = `${mkt === "1" ? "sh" : "sz"}${code}`;
      const need = period === "day" ? days : Math.min(500, days * 5);
      const url = `https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_=/CN_MarketDataService.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=${need}`;
      const res = await fetch(url, {
        next: { revalidate: 120 },
        headers: { Referer: "https://finance.sina.com.cn/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      const text = await res.text();
      const m = text.match(/\((\[[\s\S]*?\])\)/);
      if (!m) throw new Error("sina empty");
      const rows = JSON.parse(m[1]) as Array<{ day: string; open: string; high: string; low: string; close: string; volume: string }>;
      if (!rows?.length) throw new Error("sina empty");
      let bars = rows.map((r) => ({
        date: r.day, open: Number(r.open), close: Number(r.close), high: Number(r.high), low: Number(r.low), volume: Math.round(Number(r.volume)),
      }));
      if (period !== "day") bars = aggregateBars(bars, period);
      const klines: KlineBar[] = bars.slice(-days).map((b) => ({ ...b, amount: 0 }));
      return NextResponse.json({ name: `${sym}`, code, secid, period, klines });
    } catch {
      /* fallthrough */
    }
  }

  // ---- 源3：腾讯 ----
  try {
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
      date: String(row[0]), open: Number(row[1]), close: Number(row[2]), high: Number(row[3]), low: Number(row[4]),
      volume: Math.round(Number(row[5]) * 100), amount: 0,
    }));
    return NextResponse.json({ name: String(node?.qt?.name ?? param), code, secid, period, klines });
  } catch {
    return NextResponse.json({ error: "K 线数据暂不可用" }, { status: 502 });
  }
}
