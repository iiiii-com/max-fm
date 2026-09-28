import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };
const MARKETS = [
  { secid: "1.000001", code: "000001", name: "上证" },
  { secid: "0.399001", code: "399001", name: "深证" },
];

async function getJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * 市场宽度：沪深两市合计涨跌家数 / 红绿比 / 两市成交额。
 *
 * 口径与容错（两处历史缺陷已修）：
 *  1. 旧实现请求 `http://localhost:3333/api/quotes` —— 那是本地开发端口，生产不存在，
 *     本接口恒定 502，导致 K线实验室「市场宽度」模块永久空白。现改为直接抓交易所行情源。
 *  2. 涨跌家数 f104/f105/f106 在 `ulist.np` 接口里是**按指数分别**给出的（上证一份、深证一份），
 *     旧实现只取了其中一条。沪深两市必须相加才是全市场家数。
 *     成交额 f48 在 `ulist.np` 对指数返回 "-"，需走 `stock/get`。
 *  3. 任一分项取不到时返回 ok=false，前端显示「暂不可用」，不以 0 冒充。
 *
 * 温度判定：上涨占比 >60% 偏热，<40% 偏冷。
 */
export async function GET() {
  const ids = MARKETS.map((m) => m.secid).join(",");

  // 涨跌家数：ulist.np（f104/f105/f106 = 涨/跌/平）
  const breadthJ = await getJson<{ data?: { diff?: any[] } }>(
    `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${ids}&fields=f12,f104,f105,f106&fltt=2&invt=2`
  );
  // 成交额：stock/get（f48 = 成交额，f47 = 成交量）
  const amountJ = await getJson<{ data?: Record<string, any> }>(
    `https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001&fields=f43,f48&fltt=2&invt=2`
  );
  const amountJ2 = await getJson<{ data?: Record<string, any> }>(
    `https://push2.eastmoney.com/api/qt/stock/get?secid=0.399001&fields=f43,f48&fltt=2&invt=2`
  );

  const diff = breadthJ?.data?.diff;
  if (!Array.isArray(diff) || diff.length === 0) {
    return NextResponse.json({ ok: false, error: "涨跌家数数据源暂不可达" }, { status: 503 });
  }

  const n = (v: any) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };

  // 沪深两市家数相加
  let up = 0;
  let down = 0;
  let flat = 0;
  for (const q of diff) {
    up += n(q?.f104);
    down += n(q?.f105);
    flat += n(q?.f106);
  }
  const total = up + down + flat;
  if (total === 0) {
    return NextResponse.json({ ok: false, error: "涨跌家数数据源返回空值" }, { status: 503 });
  }

  // 两市成交额合计（亿元）
  const amounts = [amountJ?.data?.f48, amountJ2?.data?.f48].map(n).filter((x: number) => x > 0);
  const amountYi = amounts.length ? amounts.reduce((a, b) => a + b, 0) / 1e8 : null;

  const upRatio = (up / total) * 100;
  const stage = upRatio >= 60 ? "偏热" : upRatio <= 40 ? "偏冷" : "中性";

  return NextResponse.json(
    {
      ok: true,
      up,
      down,
      flat,
      upRatio: Number(upRatio.toFixed(1)),
      /** 沪深两市合计成交额（亿元）；取不到时为 null */
      amountYi: amountYi == null ? null : Number(amountYi.toFixed(0)),
      stage,
      source: "东方财富指数快照（f104/f105/f106 涨平跌家数、f48 成交额），沪深两市合计",
      updated: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } }
  );
}
