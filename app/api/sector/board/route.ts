import { NextResponse } from "next/server";
import { fetchNorthbound } from "@/lib/data/market";
import { cached } from "@/lib/data/upstream-cache";

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

export interface BoardLeader {
  name: string;
  secid: string;
  pct: number | null;
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
  /** 东财细分层级后缀：0=无后缀，2/3 对应名称尾部的 Ⅱ/Ⅲ。用于识别互为分册的重复板块 */
  tier: number;
  leader: BoardLeader | null;
  laggard: BoardLeader | null;
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

/** 板块全列表接口（东财 m:90 t:2 = 行业板块，共 496 个，含互为父子的多层级板块） */
const BOARD_LIST_URL = "https://push2.eastmoney.com/api/qt/clist/get";

/**
 * 从板块名称尾部解析东财细分层级后缀。
 * 东财对同一行业的细分板块用罗马数字分册（如 航海装备Ⅱ / 航海装备Ⅲ），
 * 它们与无后缀的母板块是同一批股票的子集，混排排名会重复计算资金流。
 */
function tierOf(name: string): number {
  const m = /([ⅠⅡⅢ])$/.exec(name);
  if (!m) return 0;
  return m[1] === "Ⅰ" ? 1 : m[1] === "Ⅱ" ? 2 : 3;
}

/** 去掉层级后缀，得到归一化板块名，用于跨层级去重 */
export function baseName(name: string): string {
  return name.replace(/[ⅠⅡⅢ]$/, "");
}

const BOARD_FIELDS = "f12,f13,f14,f2,f3,f62,f184,f6,f104,f105,f106,f128,f140,f136,f207,f208,f222";

function mapBoard(q: any): BoardSector {
  const leaderName = q.f128 != null && q.f128 !== "-" ? String(q.f128) : "";
  const leaderCode = q.f140 != null && q.f140 !== "-" ? String(q.f140) : "";
  const lagName = q.f207 != null && q.f207 !== "-" ? String(q.f207) : "";
  const lagCode = q.f208 != null && q.f208 !== "-" ? String(q.f208) : "";
  const n = (v: any) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  return {
    code: String(q.f12),
    name: String(q.f14),
    price: n(q.f2),
    changePct: n(q.f3),
    mainNetIn: n(q.f62),
    mainPct: n(q.f184),
    amount: n(q.f6),
    up: n(q.f104),
    down: n(q.f105),
    flat: n(q.f106),
    tier: tierOf(String(q.f14)),
    // 领涨/领跌股由列表接口内联返回（f128/f140/f136、f207/f208/f222），无需逐板块二次请求
    leader: leaderName ? { name: leaderName, secid: `1.${leaderCode}`, pct: q.f136 == null ? null : n(q.f136) } : null,
    laggard: lagName ? { name: lagName, secid: `1.${lagCode}`, pct: q.f222 == null ? null : n(q.f222) } : null,
  };
}

/** 行业板块行情（按 fid 排序）。po=1 降序 / po=0 升序。返回 total 以披露真实板块总数。 */
async function fetchSectors(pz: number, fid: string, po: 0 | 1 = 1): Promise<{ list: BoardSector[]; total: number }> {
  const j = await getJson<{ data?: { total?: number; diff?: any[] } }>(
    `${BOARD_LIST_URL}?pn=1&pz=${pz}&po=${po}&np=1&fltt=2&invt=2&fid=${fid}&fs=m:90+t:2+f:!50&fields=${BOARD_FIELDS}`
  );
  const list = ((j?.data?.diff ?? []) as any[]).map(mapBoard);
  return { list, total: Number(j?.data?.total) || list.length };
}

/**
 * 板块资金流入 / 流出排名。
 * 注意：东财的排序方向由 po 参数控制，**不能**用 fid 取负（如 fid=-f62）来反转方向——
 * 那样只会再取一次降序榜，导致「流出榜」里出现正值和与流入榜重复的行。
 */
async function fetchRank(po: 0 | 1, pz = 10): Promise<BoardRankItem[]> {
  const j = await getJson<{ data?: { diff?: any[] } }>(
    `${BOARD_LIST_URL}?pn=1&pz=${pz}&po=${po}&np=1&fltt=2&invt=2&fid=f62&fs=m:90+t:2+f:!50&fields=f12,f14,f62,f3`
  );
  return ((j?.data?.diff ?? []) as any[]).map((d) => {
    const f = Number(d.f3);
    return {
      code: String(d.f12),
      name: String(d.f14),
      mainFlow: Number(d.f62) || 0,
      pct: Number.isFinite(f) ? f : null,
    };
  });
}

/** 板块涨幅热点榜（含涨跌家数） */
async function fetchHot(pz = 8): Promise<BoardHot[]> {
  const j = await getJson<{ data?: { diff?: any[] } }>(
    `${BOARD_LIST_URL}?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2+f:!50&fields=f12,f14,f3,f104,f105,f106`
  );
  return ((j?.data?.diff ?? []) as any[]).map((s) => ({
    code: String(s.f12),
    name: String(s.f14),
    pct: s.f3 == null ? null : Number(s.f3),
    up: Number(s.f104) || 0,
    down: Number(s.f105) || 0,
    flat: Number(s.f106) || 0,
  }));
}

/**
 * 板块聚合端点：一次返回板块行情全列表 + 资金流入/流出排行 + 涨幅热点 + 北向，
 * 取代旧 /api/sector/flow 与 fund-rank / surge 的板块部分，供板块中心页与首页总览复用。
 *
 * 口径说明（对外披露，避免跨层级重复计算）：
 *  - 板块集合为东财行业板块全集（共 496 个），其中存在父子层级（电力 ⊂ 公用事业、
 *    商用载货车 ⊂ 商用车）与 Ⅱ/Ⅲ 分册，**不可跨层级求和**。
 *  - 因此本接口不提供「主力净流入合计」，只提供可加总语义成立的涨跌家数。
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const top = Math.min(200, Math.max(10, Number(sp.get("top")) || 60));

  try {
    // 4 个上游请求经 TTL + 单飞合并：同一秒内多个页面/多个组件同时要这份数据时只打一次东财，
    // 避免站点的 30s 自动刷新把免费源打成限频。
    const [full, rankIn, rankOut, hot, northbound] = await Promise.all([
      cached<{ list: BoardSector[]; total: number }>(`sector:list:${top}`, 20_000, () => fetchSectors(top, "f62", 1)),
      cached<BoardRankItem[]>("sector:rankIn", 20_000, () => fetchRank(1, 10)),
      cached<BoardRankItem[]>("sector:rankOut", 20_000, () => fetchRank(0, 10)),
      cached<BoardHot[]>("sector:hot", 30_000, () => fetchHot(8)),
      cached<Awaited<ReturnType<typeof fetchNorthbound>>>("sector:northbound", 60_000, () => fetchNorthbound()),
    ]);

    const list0: BoardSector[] = full.data?.list ?? [];
    if (list0.length === 0 && rankIn.data == null) {
      return NextResponse.json({ ok: false, error: "板块数据源暂不可达（上游限频或网络异常）" }, { status: 503 });
    }
    const total = full.data?.total ?? list0.length;

    // 跨层级去重：归一化名称后只保留主力净流入绝对值最大的一个分册，
    // 避免「互联网电商 / 电力 / 公用事业」在同一张表里出现两行数值完全相同的记录。
    const byBase = new Map<string, BoardSector>();
    for (const s of list0) {
      const key = baseName(s.name);
      const prev = byBase.get(key);
      if (!prev || Math.abs(s.mainNetIn) > Math.abs(prev.mainNetIn)) byBase.set(key, s);
    }

    return NextResponse.json(
      {
        ok: true,
        updated: new Date().toISOString(),
        source: "东方财富板块行情（push2 clist）",
        universe: {
          total,
          returned: list0.length,
          deduped: byBase.size,
          note: "东财行业板块全集；存在父子层级与 Ⅱ/Ⅲ 分册，跨层级不可求和",
        },
        list: [...byBase.values()],
        rankIn: rankIn.data ?? [],
        rankOut: rankOut.data ?? [],
        hot: hot.data ?? [],
        northbound: northbound.data,
        degraded: {
          list: full.data == null,
          rankIn: rankIn.data == null,
          rankOut: rankOut.data == null,
          hot: hot.data == null,
          northbound: northbound.data == null,
        },
      },
      { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "板块数据暂不可用" }, { status: 502 });
  }
}
