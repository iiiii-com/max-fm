import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface NorthboundHolding {
  name: string;
  secid: string;
  marketCap: number; // 持股市值（元）
  ratio: number; // 占流通比 %
}

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

function parseNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchKamtKline(lmt: number): Promise<{
  sh: { date: string; value: number }[];
  sz: { date: string; value: number }[];
} | null> {
  try {
    const j = await getJson<{ data?: any }>(
      `https://push2his.eastmoney.com/api/qt/kamt.kline/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56&klt=101&lmt=${lmt}`
    );
    const d = j?.data;
    if (!d) return null;
    const series = (rows: string[]) =>
      (rows ?? []).map((r: string) => {
        const p = r.split(",");
        return { date: String(p[0]), value: parseNum(p[1]) * 1e4 };
      });
    return { sh: series(d.hk2sh), sz: series(d.hk2sz) };
  } catch {
    return null;
  }
}

async function fetchKamtRt(): Promise<{ north: number | null; date: string } | null> {
  try {
    const j = await getJson<{ data?: any }>(
      "https://push2.eastmoney.com/api/qt/kamt.rtmin/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56"
    );
    const d = j?.data;
    if (!d) return null;
    const rows: string[] = d.s2n ?? [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const p = (rows[i] ?? "").split(",");
      if (p.length > 2 && p[1] !== "-" && p[1] !== "" && parseNum(p[1]) !== 0) {
        return { north: parseNum(p[1]) * 1e4, date: String(d.s2nDate ?? "") };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// 陆股通持仓 Top10（月度披露，数据日期滞后属正常）
async function fetchHoldings(): Promise<{ list: NorthboundHolding[]; date: string } | null> {
  try {
    const j = await getJson<{ result?: { data?: any[] } }>(
      "https://datacenter-web.eastmoney.com/api/data/v1/get?" +
        "reportName=RPT_MUTUAL_HOLDSTOCKNORTH_STA" +
        "&columns=SECURITY_CODE,SECURITY_NAME,SECUCODE,HOLD_MARKET_CAP,FREE_SHARES_RATIO,A_SHARES_RATIO,TRADE_DATE" +
        "&pageNumber=1&pageSize=10&sortColumns=HOLD_MARKET_CAP&sortTypes=-1&source=WEB&client=WEB",
      15000
    );
    const rows = j?.result?.data;
    if (!Array.isArray(rows) || !rows.length) return null;
    const list: NorthboundHolding[] = rows.map((r) => {
      const [code, mkt] = String(r.SECUCODE ?? "").split(".");
      const secid = mkt === "SH" ? `1.${code}` : `0.${code}`;
      return {
        name: String(r.SECURITY_NAME),
        secid,
        marketCap: parseNum(r.HOLD_MARKET_CAP),
        ratio: parseNum(r.FREE_SHARES_RATIO ?? r.A_SHARES_RATIO),
      };
    });
    return { list, date: String(rows[0]?.TRADE_DATE ?? "").slice(0, 10) };
  } catch {
    return null;
  }
}

const STATIC_HOLDINGS: NorthboundHolding[] = [
  { name: "贵州茅台", secid: "1.600519", marketCap: 1400e8, ratio: 7.2 },
  { name: "宁德时代", secid: "0.300750", marketCap: 1300e8, ratio: 11.5 },
  { name: "美的集团", secid: "0.000333", marketCap: 700e8, ratio: 15.2 },
  { name: "招商银行", secid: "1.600036", marketCap: 600e8, ratio: 8.1 },
  { name: "长江电力", secid: "1.600900", marketCap: 500e8, ratio: 6.8 },
  { name: "五粮液", secid: "0.000858", marketCap: 450e8, ratio: 9.3 },
  { name: "中国平安", secid: "1.601318", marketCap: 400e8, ratio: 7.6 },
  { name: "紫金矿业", secid: "1.601899", marketCap: 350e8, ratio: 6.2 },
  { name: "汇川技术", secid: "0.300124", marketCap: 300e8, ratio: 14.1 },
  { name: "立讯精密", secid: "0.002475", marketCap: 280e8, ratio: 10.4 },
];

export async function GET() {
  const [kline, rt] = await Promise.all([fetchKamtKline(30), fetchKamtRt()]);
  const holdings = await fetchHoldings();

  const delay = !kline && !rt;
  const sh = kline?.sh ?? [];
  const sz = kline?.sz ?? [];
  const n = Math.min(sh.length, sz.length);
  const merged: { date: string; value: number }[] = [];
  for (let i = 0; i < n; i++) {
    merged.push({ date: sh[i].date, value: sh[i].value + sz[i].value });
  }

  let today: { sh: number; sz: number; total: number } | null = null;
  if (merged.length) {
    const last = merged[merged.length - 1];
    today = {
      sh: sh[sh.length - 1]?.value ?? 0,
      sz: sz[sz.length - 1]?.value ?? 0,
      total: last.value,
    };
  } else if (rt?.north != null) {
    today = { sh: 0, sz: 0, total: rt.north };
  }

  return NextResponse.json({
    ok: true,
    date: today ? merged[merged.length - 1]?.date ?? rt?.date ?? "" : rt?.date ?? "",
    delay,
    today,
    history30: merged,
    trend5: merged.slice(-5).map((r) => r.value),
    holdings: holdings
      ? { list: holdings.list, source: "eastmoney", date: holdings.date }
      : { list: STATIC_HOLDINGS, source: "static", date: "" },
  });
}