import { NextResponse } from "next/server";

/** 东财行情列表通用请求（涨跌幅/资金/成交额榜） */
async function fetchList(fid: string, fields: string, pz = 12) {
  const url =
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=${fid}&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=${fields}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
    signal: AbortSignal.timeout(10000),
  });
  const j = await res.json();
  return j?.data?.diff ?? [];
}

/** 异动原因判定 */
function reasonTag(item: any): string {
  const pct = item.f3 as number | undefined;
  const flow = item.f62 as number | undefined;
  const tags: string[] = [];
  if (pct != null) {
    if (pct >= 9.5) tags.push("涨停/大涨");
    else if (pct <= -9.5) tags.push("跌停/大跌");
    else if (pct >= 5) tags.push("大幅上涨");
    else if (pct <= -5) tags.push("大幅下跌");
  }
  if (flow != null) {
    if (flow > 5e8) tags.push("主力抢筹");
    else if (flow < -5e8) tags.push("主力出逃");
  }
  return tags.length ? tags.join(" · ") : "异动观察";
}

function marketOf(code: string): string {
  if (code.startsWith("6") || code.startsWith("9")) return "沪";
  if (code.startsWith("0") || code.startsWith("3")) return "深";
  if (code.startsWith("68")) return "科创板";
  if (code.startsWith("30")) return "创业板";
  return "A股";
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [gainer, flow, turnover] = await Promise.all([
      fetchList("f3", "f12,f14,f2,f3,f62"),
      fetchList("f62", "f12,f14,f2,f3,f62"),
      fetchList("f6", "f12,f14,f2,f3,f6"),
    ]);

    // 合并去重：涨幅榜前 8 + 资金榜前 6 + 成交额榜前 6
    const merged = new Map<string, any>();
    const push = (arr: any[], limit: number) =>
      (arr ?? []).slice(0, limit).forEach((it: any) => {
        if (it?.f12 && !merged.has(it.f12)) merged.set(it.f12, it);
      });
    push(gainer, 8);
    push(flow, 6);
    push(turnover, 6);

    const surges = [...merged.values()].map((it: any) => ({
      code: it.f12,
      name: it.f14,
      market: marketOf(it.f12),
      price: it.f2 ?? null,
      pct: it.f3 ?? null,
      mainFlow: it.f62 ?? null,
      turnover: it.f6 ?? null,
      reason: reasonTag(it),
    }));

    // 行业板块热点（涨幅前 8）
    const sectorRes = await fetch(
      "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=8&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2+f:!50&fields=f12,f14,f3,f104,f105,f106",
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" }, signal: AbortSignal.timeout(10000) }
    );
    const sectorJ = await sectorRes.json();
    const sectors = ((sectorJ?.data?.diff ?? []) as any[]).map((s) => ({
      code: s.f12,
      name: s.f14,
      pct: s.f3 ?? null,
      up: s.f104 ?? 0,
      down: s.f105 ?? 0,
      flat: s.f106 ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      updated: new Date().toISOString(),
      source: "东方财富实时行情（push2.eastmoney.com）",
      surges,
      sectors,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
