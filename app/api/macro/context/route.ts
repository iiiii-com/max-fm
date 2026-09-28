import { NextResponse } from "next/server";
import shIndexStatic from "@/data/sh-index.json";
import { cached } from "@/lib/data/upstream-cache";

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

type Bar = { date: string; close: number };

/**
 * 拉取上证综指最近 N 根日线（真实行情源）。失败返回 null。
 * 需要约 400 根才能同时算出近 1 年涨跌与 250 日均线。
 */
async function fetchLiveBars(need = 400): Promise<Bar[] | null> {
  try {
    // 注意：不要加 lmt 参数（该接口对 lmt 组合会返回空 data），用 beg 限定起始日期
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000001&klt=101&fqt=0` +
      `&beg=20240101&end=20500101&fields1=f1,f2,f3&fields2=f51,f53&ut=fa5fd1943c7b386f172d6893dbfba10b`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!res.ok) return null;
    const j: any = await res.json();
    const rows: string[] = j?.data?.klines ?? [];
    if (!Array.isArray(rows) || rows.length < 60) return null;
    const out: Bar[] = [];
    for (const r of rows) {
      const [d, c] = String(r).split(",");
      const close = Number(c);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(close)) out.push({ date: d, close });
    }
    return out.length >= 60 ? out.slice(-need) : null;
  } catch {
    return null;
  }
}

/** 静态快照（data/sh-index.json，行格式：日期,开,收,高,低,量） */
function staticBars(): Bar[] {
  const rows = shIndexStatic as unknown as string[][];
  return rows
    .map((r) => ({ date: String(r[0]), close: Number(r[2]) }))
    .filter((b) => Number.isFinite(b.close));
}

/**
 * 宏观环境实时研判（真实数据自算）
 *
 * 数据源优先级：东方财富上证综指日线（实时）→ data/sh-index.json（本地快照，降级时标注）。
 * 旧实现只用静态 JSON，导致仪表盘长期冻结在快照日期（如 2026-08-21），
 * 与同屏展示的实时指数互相矛盾。现固定输出 source / asOf / stale，前端必须能看出新鲜度。
 */
export async function GET() {
  // 经 TTL+单飞缓存：多个组件/多个页面同时要宏观研判时只打一次上游
  const live = (await cached("macro:sh-bars", 300_000, fetchLiveBars)).data;
  const bars = live ?? staticBars().slice(-400);
  if (bars.length < 60) return NextResponse.json({ error: "宏观研判数据不可用" }, { status: 503 });

  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1];
  const asOf = bars[bars.length - 1].date;
  const stale = !live;

  // 近 1 年（约 250 交易日）
  const yAgo = closes[Math.max(0, closes.length - 251)];
  const yearChg = ((last - yAgo) / yAgo) * 100;

  // 距 250 日线
  const win = closes.slice(-250);
  const ma250 = win.reduce((a, b) => a + b, 0) / win.length;
  const vsMa250 = ((last - ma250) / ma250) * 100;

  // 年化波动（近 60 日收益标准差）
  const rets: number[] = [];
  for (let i = closes.length - 60; i < closes.length; i++) {
    if (i > 0 && closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
  const annVol = Math.sqrt(variance) * Math.sqrt(250) * 100;

  // 宏观阶段：仅由「近 1 年涨跌」这一个信号判定，避免多信号互相打架
  let stage: string;
  let score: number;
  if (yearChg > 15) { stage = "扩张期"; score = 78; }
  else if (yearChg > 0) { stage = "复苏期"; score = 65; }
  else if (yearChg > -10) { stage = "放缓期"; score = 48; }
  else { stage = "收缩期"; score = 30; }

  // 资产偏好：由「趋势位置（距 250 日线）」判定，与阶段判定解耦并在 summary 里显式说明两者关系，
  // 避免出现「复苏期 · 权益偏防御」这种读者无法自洽的结论。
  const trendUp = vsMa250 > 0;
  const equityPref = trendUp ? "权益偏进攻" : "权益偏防御";

  // 阶段与趋势是否同向，用于给读者一句可自洽的解释
  const coherent = (stage === "扩张期" || stage === "复苏期") === trendUp;
  const trendNote = trendUp
    ? "指数站上 250 日线，中期趋势向上"
    : "指数仍低于 250 日线，中期趋势尚未修复";

  const summary =
    `近 1 年 ${yearChg >= 0 ? "+" : ""}${yearChg.toFixed(1)}% → ${stage}（环节 1 宏观研判）；` +
    `${trendNote}（${vsMa250 >= 0 ? "+" : ""}${vsMa250.toFixed(1)}%）→ ${equityPref}。` +
    (coherent ? "" : `注意：阶段判定（${stage}）与趋势位置（${trendNote}）当前不同向，配置结论以趋势位置为准。`);

  return NextResponse.json(
    {
      ok: true,
      asOf,
      source: live ? "东方财富上证综指日线（实时）" : "本地快照 data/sh-index.json（行情源不可达，已降级）",
      stale,
      index: {
        name: "上证综指",
        close: Number(last.toFixed(2)),
        yearChg: Number(yearChg.toFixed(2)),
        vsMa250: Number(vsMa250.toFixed(2)),
        annVol: Number(annVol.toFixed(1)),
        bars: closes.length,
      },
      macro: { stage, score, equityPref, trendUp, summary },
    },
    // 不做 HTTP 层缓存：这个模块要与同屏的实时指数一致，
    // 60s 的 max-age 会让页面在行情刷新后仍显示上一轮的研判结果。
    { headers: { "Cache-Control": "no-store" } }
  );
}
