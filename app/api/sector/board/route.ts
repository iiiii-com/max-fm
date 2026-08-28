import { NextResponse } from "next/server";
import { fetchNorthbound } from "@/lib/data/market";

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

export interface BoardLeader {
  name: string;
  secid: string;
  pct: number;
  mainNet: number;
}

export interface BoardSector {
  code: string;
  name: string;
  price: number;
  changePct: number;
  mainNetIn: number;
  mainPct: number;
  amount: number;
  up: number;
  down: number;
  flat: number;
  leader: BoardLeader | null;
}

export interface BoardRankItem {
  code: string;
  name: string;
  mainFlow: number;
  pct: number | null;
}

export interface BoardHot {
  code: string;
  name: string;
  pct: number | null;
  up: number;
  down: number;
  flat: number;
}

async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

/** 行业板块全量行情（fid 排序，含涨跌家数 / 主力净占比 / 成交额） */
async function fetchSectors(pz: number, fid: string): Promise<BoardSector[]> {
  const j = await getJson<{ data?: { diff?: any[] } }>(
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=${fid}&fs=m:90+t:2+f:!50&fields=f12,f13,f14,f2,f3,f62,f184,f6,f104,f105,f106`
  );
  return ((j?.data?.diff ?? []) as any[]).map((q) => ({
    code: String(q.f12),
    name: String(q.f14),
    price: Number(q.f2) || 0,
    changePct: Number(q.f3) || 0,
    mainNetIn: Number(q.f62) || 0,
    mainPct: Number(q.f184) || 0,
    amount: Number(q.f6) || 0,
    up: Number(q.f104) || 0,
    down: Number(q.f105) || 0,
    flat: Number(q.f106) || 0,
    leader: null,
  }));
}

/** 板块领涨股（板块内主力净流入第一） */
async function fetchLeader(bk: string): Promise<BoardLeader | null> {
  try {
    const j = await getJson<{ data?: { diff?: any[] } }>(
      `https://push2.eastmoney.com/api/qt/clist/get?fid=f62&po=1&pz=1&pn=1&np=1&fltt=2&invt=2&fs=b:${encodeURIComponent(bk)}&fields=f12,f13,f14,f2,f3,f62`
    );
    const q = j?.data?.diff?.[0];
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

/** 板块主力资金流入 / 流出 Top */
async function fetchRank(fid: string, pz = 10): Promise<BoardRankItem[]> {
  const j = await getJson<{ data?: { diff?: any[] } }>(
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=${fid}&fs=m:90+t:2+f:!50&fields=f12,f14,f62,f3`
  );
  return ((j?.data?.diff ?? []) as any[]).map((d) => ({
    code: String(d.f12),
    name: String(d.f14),
    mainFlow: Number(d.f62) || 0,
    pct: d.f3 ?? null,
  }));
}

/** 板块涨幅热点榜（含涨跌家数） */
async function fetchHot(pz = 8): Promise<BoardHot[]> {
  const j = await getJson<{ data?: { diff?: any[] } }>(
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2+f:!50&fields=f12,f14,f3,f104,f105,f106`
  );
  return ((j?.data?.diff ?? []) as any[]).map((s) => ({
    code: String(s.f12),
    name: String(s.f14),
    pct: s.f3 ?? null,
    up: Number(s.f104) || 0,
    down: Number(s.f105) || 0,
    flat: Number(s.f106) || 0,
  }));
}

/**
 * 板块聚合端点：一次返回板块行情全列表 + 资金流入/流出排行 + 涨幅热点 + 北向，
 * 取代旧 /api/sector/flow 与 fund-rank / surge 的板块部分，供板块中心页与首页总览复用。
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const top = Math.min(100, Math.max(10, Number(sp.get("top")) || 60));
  const withLeaders = sp.get("leaders") === "1";

  try {
    const [list, rankIn, rankOut, hot, northbound] = await Promise.all([
      fetchSectors(top, "f62"),
      fetchRank("f62"),
      fetchRank("-f62"),
      fetchHot(8),
      fetchNorthbound(),
    ]);

    if (withLeaders) {
      const leaders = await Promise.all(list.slice(0, 30).map((s) => fetchLeader(s.code)));
      list.forEach((s, i) => {
        s.leader = leaders[i] ?? null;
      });
    }

    return NextResponse.json(
      {
        ok: true,
        updated: new Date().toISOString(),
        source: "东方财富板块行情（push2 clist）",
        list,
        rankIn,
        rankOut,
        hot,
        northbound,
      },
      { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "板块数据暂不可用" }, { status: 502 });
  }
}
