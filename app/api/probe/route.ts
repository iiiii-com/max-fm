import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const targets = [
    { name: "gov-search", url: "https://sousuo.www.gov.cn/search-gov/data?t=zhengcelibrary_gw&q=%E9%87%91%E8%9E%8D&p=1&n=3" },
    { name: "gov-home", url: "https://www.gov.cn/zhengce/zuixin/" },
    { name: "pbc", url: "https://www.pbc.gov.cn" },
    { name: "mof", url: "https://www.mof.gov.cn" },
    { name: "ndrc", url: "https://www.ndrc.gov.cn" },
  ];
  const out: any[] = [];
  for (const t of targets) {
    try {
      const r = await fetch(t.url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" }, signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      out.push({ name: t.name, status: r.status, bytes: text.length });
    } catch (e: any) {
      out.push({ name: t.name, status: "ERR", error: String(e?.message || e).slice(0, 80) });
    }
  }
  return NextResponse.json(out);
}