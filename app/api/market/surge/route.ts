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

/** 异动分档：把涨停榜/涨幅榜/异动榜/跌幅榜合并后的列表按档位归类 */
export type SurgeBucket = "limit-up" | "big-up" | "watch" | "big-down" | "limit-down";

/**
 * 异动原因判定。
 *
 * 旧实现把不同来源的榜单（涨停 / 涨幅 / 异动 / 跌幅）直接拼在一起返回，
 * 排序完全不连续（实测出现 9.27 → 9.99 → 10.01 → 4.16 → 9.8），
 * 界面上看起来像排序坏了。现在给出明确档位 + 档内排序依据。
 * 同时对「既没涨跌幅越界也没资金异动」的情况给出具体说明，而不是笼统的「异动观察」。
 */
function classify(item: any): { bucket: SurgeBucket; reason: string } {
  const pct = item.f3 as number | undefined;
  const flow = item.f62 as number | undefined;
  const turnover = item.f6 as number | undefined;
  const tags: string[] = [];

  let bucket: SurgeBucket = "watch";
  if (pct != null) {
    if (pct >= 9.5) {
      bucket = "limit-up";
      tags.push("涨停/大涨");
    } else if (pct >= 5) {
      bucket = "big-up";
      tags.push("大幅上涨");
    } else if (pct <= -9.5) {
      bucket = "limit-down";
      tags.push("跌停/大跌");
    } else if (pct <= -5) {
      bucket = "big-down";
      tags.push("大幅下跌");
    }
  }
  if (flow != null) {
    if (flow > 5e8) tags.push("主力抢筹");
    else if (flow < -5e8) tags.push("主力出逃");
  }
  // 无越界信号时说明它到底是被哪一项选进来的
  if (!tags.length) {
    if (pct != null) tags.push(`涨跌幅 ${pct >= 0 ? "+" : ""}${pct}%`);
    else if (turnover != null) tags.push("成交额居前");
    else tags.push("入选异动榜");
  }
  return { bucket, reason: tags.join(" · ") };
}

const BUCKET_ORDER: SurgeBucket[] = ["limit-up", "big-up", "watch", "big-down", "limit-down"];

function marketOf(code: string): string {
  // 注意顺序：科创板 68x / 创业板 30x 都以 6、3 开头，必须先判
  if (code.startsWith("68")) return "科创板";
  if (code.startsWith("30")) return "创业板";
  if (code.startsWith("6") || code.startsWith("9")) return "沪";
  if (code.startsWith("0")) return "深";
  if (code.startsWith("3")) return "深";
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

    // 归入明确档位并做**档内排序**，使整体顺序连续（涨停 → 大涨 → 异动 → 大跌 → 跌停）
    const ranked = [...merged.values()]
      .map((it: any) => {
        const c = classify(it);
        return {
          code: it.f12,
          name: it.f14,
          market: marketOf(it.f12),
          price: it.f2 ?? null,
          pct: it.f3 ?? null,
          mainFlow: it.f62 ?? null,
          turnover: it.f6 ?? null,
          reason: c.reason,
          bucket: c.bucket,
        };
      })
      .sort((a, b) => {
        const ba = BUCKET_ORDER.indexOf(a.bucket);
        const bb = BUCKET_ORDER.indexOf(b.bucket);
        if (ba !== bb) return ba - bb;
        // 同档内按涨跌幅绝对值从大到小
        return Math.abs(Number(b.pct ?? 0)) - Math.abs(Number(a.pct ?? 0));
      });
    const surges = ranked;

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
