import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface StockHit {
  code: string;
  name: string;
  mkt: string;
  secid: string;
  kind: "stock" | "index";
}

const EM_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";

/** 本地预置指数兜底（东财搜索不可达时保底 + 全球指数补充） */
const FALLBACK_INDEXES: StockHit[] = [
  { code: "000001", name: "上证指数", mkt: "1", secid: "1.000001", kind: "index" },
  { code: "399001", name: "深证成指", mkt: "0", secid: "0.399001", kind: "index" },
  { code: "399006", name: "创业板指", mkt: "0", secid: "0.399006", kind: "index" },
  { code: "000300", name: "沪深300", mkt: "1", secid: "1.000300", kind: "index" },
  { code: "000905", name: "中证500", mkt: "1", secid: "1.000905", kind: "index" },
  { code: "000688", name: "科创50", mkt: "1", secid: "1.000688", kind: "index" },
  { code: "HSI", name: "恒生指数", mkt: "100", secid: "100.HSI", kind: "index" },
  { code: "SPX", name: "标普500", mkt: "100", secid: "100.SPX", kind: "index" },
  { code: "NDX", name: "纳斯达克", mkt: "100", secid: "100.NDX", kind: "index" },
  { code: "DJIA", name: "道琼斯", mkt: "100", secid: "100.DJIA", kind: "index" },
  { code: "N225", name: "日经225", mkt: "100", secid: "100.N225", kind: "index" },
  { code: "KS11", name: "韩国KOSPI", mkt: "100", secid: "100.KS11", kind: "index" },
  { code: "GDAXI", name: "德国DAX", mkt: "100", secid: "100.GDAXI", kind: "index" },
  { code: "FTSE", name: "英国富时100", mkt: "100", secid: "100.FTSE", kind: "index" },
];

/** 本地指数匹配（name 或 code 包含关键字） */
function matchFallback(q: string): StockHit[] {
  const key = q.trim().toLowerCase();
  if (!key) return [];
  return FALLBACK_INDEXES.filter(
    (ix) => ix.name.includes(q) || ix.code.toLowerCase().includes(key) || ix.secid.toLowerCase().includes(key)
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 1) return NextResponse.json({ hits: [] });

  // 本地预置指数优先匹配（全球指数 + A股指数，保底可用）
  const local = matchFallback(q);
  const localKeys = new Set(local.map((h) => h.secid));

  try {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&token=${EM_TOKEN}&count=8`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`search api ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.QuotationCodeTable?.Data || [];
    const remote: StockHit[] = rows
      .filter((r: any) => ["0", "1"].includes(String(r.MktNum)) && ["AStock", "Index"].includes(String(r.Classify)))
      .slice(0, 10)
      .map((r: any) => ({
        code: String(r.Code),
        name: String(r.Name),
        mkt: String(r.MktNum),
        secid: `${r.MktNum}.${r.Code}`,
        kind: String(r.Classify) === "Index" ? ("index" as const) : ("stock" as const),
      }));
    // 远程结果 + 预置全球指数（避免重复；远程含 A 股指数时也保留）
    const merged = [...remote, ...local.filter((h) => !remote.some((r) => r.secid === h.secid))];
    return NextResponse.json({ hits: merged.slice(0, 12), source: "eastmoney" });
  } catch {
    // 东财不可达：仅返回预置指数匹配（A股/全球指数）
    return NextResponse.json({ hits: local, source: "local-fallback" });
  }
}
