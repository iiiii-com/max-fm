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

  // 2024-08 起北向净买入不再实时披露，东财接口返回全 0 占位：识别后置空并告知
  const hasRealData = merged.some((r) => r.value !== 0) || rt?.north != null;
  const effectiveHistory = hasRealData ? merged : [];
  const disclosure = hasRealData
    ? ""
    : "自 2024-08 起北向资金净买入不再实时披露，以下展示季度持仓口径";

  let today: { sh: number; sz: number; total: number } | null = null;
  if (effectiveHistory.length) {
    const last = effectiveHistory[effectiveHistory.length - 1];
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
    date: today ? effectiveHistory[effectiveHistory.length - 1]?.date ?? rt?.date ?? "" : rt?.date ?? "",
    delay,
    disclosure,
    today,
    history30: effectiveHistory,
    trend5: effectiveHistory.slice(-5).map((r) => r.value),
    holdings: holdings
      ? { list: holdings.list, source: "eastmoney", date: holdings.date }
      : { list: [], source: "none", date: "" }, // 持仓接口失败时返回空列表，不使用任何编造数据
  });
}