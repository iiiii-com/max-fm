import { NextResponse } from "next/server";
import { ETF_UNIVERSE } from "@/lib/data/etf-universe";

export const dynamic = "force-dynamic";

export interface StockHit {
  code: string;
  name: string;
  mkt: string;
  secid: string;
  kind: "stock" | "index" | "etf";
}

const EM_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";

/** ETF / LOF 代码段：沪市 5xxxxx、深市 15xxxx / 16xxxx（场内基金） */
const FUND_CODE_RE = /^(5\d{5}|1[56]\d{4})$/;

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

/** 本地匹配：ETF 清单（沪/深场内 ETF，代码与名称都可搜）+ 预置指数 */
function matchLocal(q: string): StockHit[] {
  const key = q.trim().toLowerCase();
  if (!key) return [];
  const etfs: StockHit[] = ETF_UNIVERSE.filter(
    (e) => e.code.includes(key) || e.name.toLowerCase().includes(key) || e.secid.toLowerCase().includes(key)
  )
    .slice(0, 6)
    .map((e) => ({
      code: e.code,
      name: e.name,
      mkt: e.secid.split(".")[0] ?? "1",
      secid: e.secid,
      kind: "etf" as const,
    }));
  const indexes = FALLBACK_INDEXES.filter(
    (ix) => ix.name.includes(q) || ix.code.toLowerCase().includes(key) || ix.secid.toLowerCase().includes(key)
  ).slice(0, 4);
  return [...etfs, ...indexes];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 1) return NextResponse.json({ hits: [] });

  // 本地预置（ETF 清单 + 指数）优先匹配：东财不可达时搜索仍可用，
  // 也保证「510300 沪深300ETF」这类场内基金一定能搜到。
  const local = matchLocal(q);
  const localKeys = new Set(local.map((h) => h.secid));

  try {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&token=${EM_TOKEN}&count=10`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`search api ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.QuotationCodeTable?.Data || [];
    const remote: StockHit[] = rows
      .filter((r: any) => ["0", "1"].includes(String(r.MktNum)))
      .map((r: any): StockHit | null => {
        const code = String(r.Code ?? "");
        const name = String(r.Name ?? "");
        const mkt = String(r.MktNum);
        const cls = String(r.Classify ?? "");
        if (!/^\d{6}$/.test(code)) return null;
        if (cls === "AStock") return { code, name, mkt, secid: `${mkt}.${code}`, kind: "stock" };
        if (cls === "Index") return { code, name, mkt, secid: `${mkt}.${code}`, kind: "index" };
        // 场外基金/LOF 一律不进结果，只保留名称含 ETF 的场内基金
        if (cls === "Fund" && FUND_CODE_RE.test(code) && /ETF/i.test(name))
          return { code, name, mkt, secid: `${mkt}.${code}`, kind: "etf" };
        return null;
      })
      .filter((x): x is StockHit => x !== null)
      .slice(0, 10);
    // 远程结果 + 本地未覆盖的（ETF 清单/全球指数），保持远程优先
    const merged = [...remote, ...local.filter((h) => !localKeys.has(h.secid) || !remote.some((r) => r.secid === h.secid))];
    const dedup: StockHit[] = [];
    const seen = new Set<string>();
    for (const h of [...remote, ...local]) {
      if (seen.has(h.secid)) continue;
      seen.add(h.secid);
      dedup.push(h);
    }
    return NextResponse.json({ hits: (dedup.length ? dedup : merged).slice(0, 12), source: "eastmoney" });
  } catch {
    // 东财不可达：ETF 清单 + 预置指数，保证搜索框永远有可用结果
    return NextResponse.json({ hits: local.slice(0, 12), source: "local-fallback" });
  }
}
