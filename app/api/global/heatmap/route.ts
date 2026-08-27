import { NextResponse } from "next/server";
import { HEAT_GROUPS, ALL_HEAT_ITEMS, parseSinaLine, type HeatQuote } from "@/lib/data/global-heatmap";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126";

/** 新浪实时行情（含美股 gb_ / 港股 hk / 全球指数 b_ / A股 sh·sz） */
async function fetchSinaQuotes(symbols: string[]): Promise<Map<string, HeatQuote>> {
  const map = new Map<string, HeatQuote>();
  if (!symbols.length) return map;
  try {
    const url = `https://hq.sinajs.cn/list=${symbols.join(",")}`;
    const res = await fetch(url, {
      next: { revalidate: 20 },
      headers: { Referer: "https://finance.sina.com.cn/", "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const lines = text.split("\n");
    for (let i = 0; i < symbols.length && i < lines.length; i++) {
      const q = parseSinaLine(symbols[i], lines[i]);
      if (q && Number.isFinite(q.price)) map.set(symbols[i], q);
    }
  } catch {
    /* 新浪不可达则跳过 */
  }
  return map;
}

/** 东财实时（受限项：日经/台湾/德国/法国；本机可能不可达） */
async function fetchEastmoneyQuotes(secids: string[]): Promise<Map<string, HeatQuote>> {
  const map = new Map<string, HeatQuote>();
  if (!secids.length) return map;
  try {
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids.join(",")}&fields=f2,f3,f4,f12,f14&fltt=2&invt=2`;
    const res = await fetch(url, {
      next: { revalidate: 20 },
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    const list = json?.data?.diff || [];
    if (Array.isArray(list)) {
      for (const q of list) {
        if (!q) continue;
        map.set(String(q.f12), {
          code: String(q.f12),
          name: String(q.f14),
          price: Number(q.f2),
          changePct: Number.isFinite(Number(q.f3)) ? Number(q.f3) : null,
        });
      }
    }
  } catch {
    /* 东财不可达 */
  }
  return map;
}

export async function GET() {
  const sinaItems = ALL_HEAT_ITEMS.filter((i) => i.sina);
  const emItems = ALL_HEAT_ITEMS.filter((i) => !i.sina && i.secid);

  const [sinaMap, emMap] = await Promise.all([
    fetchSinaQuotes(sinaItems.map((i) => i.sina!)),
    fetchEastmoneyQuotes(emItems.map((i) => i.secid!)),
  ]);

  const groups = HEAT_GROUPS.map((g) => ({
    market: g.market,
    flag: g.flag,
    items: g.items.map((it) => {
      const sinaQ = it.sina ? sinaMap.get(it.sina) : undefined;
      const emQ = it.secid ? emMap.get(it.code) : undefined;
      const q = sinaQ ?? emQ;
      return {
        code: it.code,
        name: it.name,
        region: it.region,
        drill: it.drill,
        // 无数据 → null（受限，前端灰显"数据源受限"），不造假
        price: q?.price ?? null,
        changePct: q?.changePct ?? null,
        timestamp: q?.timestamp ?? null,
      };
    }),
  }));

  return NextResponse.json({
    ok: true,
    updated: new Date().toISOString(),
    groups,
  });
}
