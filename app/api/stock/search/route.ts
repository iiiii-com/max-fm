import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EM_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";

export interface StockHit {
  code: string;
  name: string;
  mkt: string;
  secid: string;
  kind: "stock" | "index";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 1) return NextResponse.json({ hits: [] });
  try {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&token=${EM_TOKEN}&count=8`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) throw new Error(`search api ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.QuotationCodeTable?.Data || [];
    const hits: StockHit[] = rows
      .filter((r: any) => ["0", "1"].includes(String(r.MktNum)) && ["AStock", "Index"].includes(String(r.Classify)))
      .slice(0, 12)
      .map((r: any) => ({
        code: String(r.Code),
        name: String(r.Name),
        mkt: String(r.MktNum),
        secid: `${r.MktNum}.${r.Code}`,
        kind: String(r.Classify) === "Index" ? ("index" as const) : ("stock" as const),
      }));
    return NextResponse.json({ hits });
  } catch {
    return NextResponse.json({ hits: [], error: "搜索服务暂不可用" });
  }
}