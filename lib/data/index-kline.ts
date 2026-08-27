/**
 * 指数 K 线多源获取（东财 → 新浪 → 腾讯 三级容错）
 * - A 股指数（secid 1./0. 前缀）：东财 / 新浪 CN（sh/sz）/ 腾讯（sh/sz）
 * - 美股指数（100.SPX/NDX/DJIA）：东财 / 新浪 US（.INX/.IXIC/.DJI）/ 腾讯（usINX/usIXIC/usDJI）
 * - 恒生指数（100.HSI）：东财 / 腾讯（hkHSI）
 * - 日经/KOSPI/DAX/富时（100.N225/KS11/GDAXI/FTSE）：仅东财（本机网络受限时不可用，线上可用）
 *
 * 核验日期：2026-08-27
 */

export interface IndexKlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126";

/** 新浪美股代码映射（仅美股三大指数） */
export const SINA_US_SYMBOLS: Record<string, string> = {
  SPX: ".INX",
  NDX: ".IXIC",
  DJIA: ".DJI",
};

/** 腾讯 fqkline 代码映射（美股 + 恒指） */
export const TENCENT_SYMBOLS: Record<string, string> = {
  SPX: "usINX",
  NDX: "usIXIC",
  DJIA: "usDJI",
  HSI: "hkHSI",
};

/** 仅东财支持的指数（本机受限、线上可用） */
export const EASTMONEY_ONLY = ["N225", "KS11", "GDAXI", "FTSE"];

/** 从 secid（如 100.SPX / 1.000001 / 0.399001）解析市场与代码 */
export function splitSecid(secid: string) {
  const [mkt, code] = secid.split(".");
  return { mkt, code };
}

/** 源1：东方财富 push2his（全类型指数） */
export async function fetchEastmoneyIndex(secid: string, days: number): Promise<IndexKlineBar[] | null> {
  try {
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(
      secid
    )}&klt=101&fqt=0&beg=20200101&end=20261231&lmt=${days}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { Referer: "https://quote.eastmoney.com/", "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw: string[] = json?.data?.klines ?? [];
    if (!Array.isArray(raw) || !raw.length) return null;
    return raw.slice(-days).map((row) => {
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
  } catch {
    return null;
  }
}

/** 源2a：新浪 CN（A 股指数 sh/sz，secid 1./0. 前缀） */
export async function fetchSinaCnIndex(secid: string, days: number): Promise<IndexKlineBar[] | null> {
  const { mkt, code } = splitSecid(secid);
  if (mkt !== "1" && mkt !== "0") return null;
  const sym = `${mkt === "1" ? "sh" : "sz"}${code}`;
  try {
    const url = `https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_=/CN_MarketDataService.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=${days}`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { Referer: "https://finance.sina.com.cn/", "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const m = text.match(/\((\[[\s\S]*?\])\)/);
    if (!m) return null;
    const rows = JSON.parse(m[1]) as Array<{ day: string; open: string; high: string; low: string; close: string; volume: string }>;
    if (!rows?.length) return null;
    return rows.slice(-days).map((r) => ({
      date: r.day,
      open: Number(r.open),
      close: Number(r.close),
      high: Number(r.high),
      low: Number(r.low),
      volume: Math.round(Number(r.volume)),
    }));
  } catch {
    return null;
  }
}

/** 源2b：新浪 US（美股三大指数 SPX/NDX/DJIA） */
export async function fetchSinaUsIndex(code: string, days: number): Promise<IndexKlineBar[] | null> {
  const symbol = SINA_US_SYMBOLS[code];
  if (!symbol) return null;
  try {
    const url = `https://stock.finance.sina.com.cn/usstock/api/jsonp.php/var%20_=/US_MinKService.getDailyK?symbol=${symbol}&___qn=3`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://finance.sina.com.cn" },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 300 },
    });
    const text = await res.text();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.slice(-days).map((row: any) => ({
      date: String(row.d),
      open: Number(row.o),
      close: Number(row.c),
      high: Number(row.h),
      low: Number(row.l),
      volume: Number(row.v) || 0,
    }));
  } catch {
    return null;
  }
}

/** 源3：腾讯 fqkline（usINX/usIXIC/usDJI / hkHSI / sh/sz A股指数） */
export async function fetchTencentIndex(code: string, days: number): Promise<IndexKlineBar[] | null> {
  const sym = TENCENT_SYMBOLS[code];
  if (!sym) return null;
  try {
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${sym},day,,,${days},qfq`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 120 },
    });
    const json = await res.json();
    const node = json?.data?.[sym];
    const day = node?.day ?? node?.qfqday ?? [];
    if (!Array.isArray(day) || !day.length) return null;
    return day.slice(-days).map((row: any) => {
      const [date, open, close, high, low, volume] = row;
      return {
        date,
        open: Number(open),
        close: Number(close),
        high: Number(high),
        low: Number(low),
        volume: Math.round(Number(volume)),
      };
    });
  } catch {
    return null;
  }
}

/**
 * 综合获取指数 K 线（按 secid 自动选择可用源，按序容错）
 * @returns { bars, source } bars 为空数组表示全部源失败
 */
export async function fetchIndexKlineMulti(
  secid: string,
  days: number
): Promise<{ bars: IndexKlineBar[]; source: string }> {
  const { mkt, code } = splitSecid(secid);

  // 1) 东财（全类型）
  const em = await fetchEastmoneyIndex(secid, days);
  if (em?.length) return { bars: em, source: "东方财富" };

  // 2) A 股指数：新浪 CN
  if (mkt === "1" || mkt === "0") {
    const sina = await fetchSinaCnIndex(secid, days);
    if (sina?.length) return { bars: sina, source: "新浪" };
  }

  // 3) 全球指数（100. 前缀）
  if (mkt === "100") {
    // 美股三大指数：新浪 US
    const su = await fetchSinaUsIndex(code, days);
    if (su?.length) return { bars: su, source: "新浪美股" };
    // 美股 + 恒指：腾讯
    const tx = await fetchTencentIndex(code, days);
    if (tx?.length) return { bars: tx, source: "腾讯" };
  }

  return { bars: [], source: "" };
}
