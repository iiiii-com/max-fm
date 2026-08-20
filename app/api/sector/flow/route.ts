import { NextResponse } from "next/server";
import { fetchSectorFlow, fetchNorthbound } from "@/lib/data/market";

export const dynamic = "force-dynamic";

export interface SectorLeader {
  name: string;
  secid: string;
  pct: number;
  mainNet: number;
}

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

async function fetchSectorLeader(bk: string): Promise<SectorLeader | null> {
  try {
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get?fid=f62&po=1&pz=1&pn=1&np=1&fltt=2&invt=2` +
      `&fs=b:${encodeURIComponent(bk)}&fields=f12,f13,f14,f2,f3,f62`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) throw new Error(`leader api ${res.status}`);
    const json = await res.json();
    const q = json?.data?.diff?.[0];
    if (!q || !q.f12) return null;
    return {
      name: String(q.f14),
      secid: `${q.f13}.${q.f12}`,
      pct: Number(q.f3) || 0,
      mainNet: Number(q.f62) || 0,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [sectors, northbound] = await Promise.all([fetchSectorFlow(30), fetchNorthbound()]);
  const leaders = await Promise.all(sectors.map((s) => fetchSectorLeader(s.code)));
  return NextResponse.json({
    ok: true,
    sectors: sectors.map((s, i) => ({ ...s, leader: leaders[i] ?? null })),
    northbound,
  });
}