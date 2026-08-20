import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface SectorStock {
  name: string;
  secid: string;
  price: number;
  pct: number;
  mainNet: number;
}

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

export async function GET(req: Request) {
  const bk = new URL(req.url).searchParams.get("bk")?.trim() ?? "";
  if (!/^BK\d+$/.test(bk)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  let list: SectorStock[] = [];
  try {
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get?fid=f62&po=1&pz=10&pn=1&np=1&fltt=2&invt=2` +
      `&fs=b:${bk}&fields=f12,f13,f14,f2,f3,f62`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!res.ok) throw new Error(`detail api ${res.status}`);
    const json = await res.json();
    const diff = json?.data?.diff;
    if (Array.isArray(diff)) {
      list = diff.map((q) => ({
        name: String(q.f14),
        secid: `${q.f13}.${q.f12}`,
        price: Number(q.f2) || 0,
        pct: Number(q.f3) || 0,
        mainNet: Number(q.f62) || 0,
      }));
    }
  } catch {
    list = [];
  }
  return NextResponse.json({ ok: true, list });
}