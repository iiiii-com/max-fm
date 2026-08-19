import type { KlineBar } from "@/app/api/stock/kline/route";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

export async function fetchKline(secid: string, days = 250): Promise<KlineBar[] | null> {
  try {
    const [mkt, code] = secid.split(".");
    const prefix = mkt === "1" ? "sh" : mkt === "0" ? "sz" : "sh";
    const param = `${prefix}${code}`;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param},day,,,${days},qfq`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) throw new Error(`kline api ${res.status}`);
    const json = await res.json();
    const node = json?.data?.[param];
    const raw: any[][] = node?.qfqday || node?.day || [];
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