import type { KlineBar } from "@/app/api/stock/kline/route";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

export type KlinePeriod = "day" | "week" | "month";

export async function fetchKline(secid: string, days = 250, range?: { from?: string; to?: string }, period: KlinePeriod = "day"): Promise<KlineBar[] | null> {
  // 按时间段直取：gtimg 支持 param=code,day,起始,结束,条数,qfq
  if (range?.from || range?.to) {
    const from = range.from ?? "1990-01-01";
    const to = range.to ?? "2050-01-01";
    const gt = await fetchKlineGtimg(secid, Math.min(days, 2000), { from, to }, period);
    if (gt && gt.length) return gt;
    const fallback = await fetchKline(secid, days, undefined, period);
    return fallback ? fallback.filter((b) => b.date >= from && b.date <= to) : null;
  }
  const gtimg = await fetchKlineGtimg(secid, Math.min(days, 2000), undefined, period);
  if (gtimg && gtimg.length >= days) return gtimg;
  const em = await fetchKlineEastmoney(secid, days, period);
  if (em && (!gtimg || em.length > gtimg.length)) return em;
  return gtimg;
}

async function fetchKlineGtimg(secid: string, days: number, range?: { from: string; to: string }, period: KlinePeriod = "day"): Promise<KlineBar[] | null> {
  try {
    const [mkt, code] = secid.split(".");
    const prefix = mkt === "1" ? "sh" : mkt === "0" ? "sz" : mkt === "100" ? "us" : "sh";
    const param = `${prefix}${code}`;
    const datePart = range ? `${range.from},${range.to},${days}` : `,,,${days}`;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param},${period},${datePart},qfq`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) throw new Error(`kline api ${res.status}`);
    const json = await res.json();
    const node = json?.data?.[param];
    const raw: any[][] = node?.[`qfq${period}`] || node?.[period] || node?.qfqday || node?.day || [];
    if (!Array.isArray(raw) || !raw.length) return null;
    return raw.map((row: any[]) => ({
      date: String(row[0]),
      open: Number(row[1]),
      close: Number(row[2]),
      high: Number(row[3]),
      low: Number(row[4]),
      volume: Math.round(Number(row[5]) * 100),
      amount: 0,
    }));
  } catch {
    return null;
  }
}

async function fetchKlineEastmoney(secid: string, days: number, period: KlinePeriod = "day"): Promise<KlineBar[] | null> {
  try {
    const klt = period === "week" ? 102 : period === "month" ? 103 : 101;
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}` +
      `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58` +
      `&klt=${klt}&fqt=1&lmt=${days}&end=20500101`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) throw new Error(`eastmoney kline ${res.status}`);
    const json = await res.json();
    const raw: string[] = json?.data?.klines ?? [];
    if (!Array.isArray(raw) || !raw.length) return null;
    return raw.map((line: string) => {
      const row = line.split(",");
      return {
        date: String(row[0]),
        open: Number(row[1]),
        close: Number(row[2]),
        high: Number(row[3]),
        low: Number(row[4]),
        volume: Math.round(Number(row[5])),
        amount: Number(row[6]) || 0,
      };
    });
  } catch {
    return null;
  }
}

export async function fetchFundamentals(secid: string): Promise<Record<string, any> | null> {
  try {
    const fields = "f57,f58,f43,f116,f117,f162,f167,f92,f168,f164,f60";
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) throw new Error(`fundamentals ${res.status}`);
    const json = await res.json();
    const d = json?.data;
    if (!d) return null;
    return {
      name: d.f58, code: d.f57, price: d.f43,
      totalMv: d.f116, floatMv: d.f117,
      pe: d.f162, pb: d.f167, bps: d.f92, eps: d.f164, turnover: d.f168, prevClose: d.f60,
    };
  } catch {
    return null;
  }
}