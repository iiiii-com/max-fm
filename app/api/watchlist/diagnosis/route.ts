import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { proGate } from "@/lib/plan";
import {
  alignReturns, annualCovariance, annualVol, correlationMatrix,
  minVarianceWeights, portfolioVol, TRADING_DAYS,
  type PriceSeries,
} from "@/lib/data/portfolio-risk";

export const dynamic = "force-dynamic";

/**
 * 自选股组合批量诊断（专业版）。
 *
 * 这是最实的护城河，而且是**算力型**而非功能型：
 *   单标的诊断用一次取数就够了；整组诊断要 N 次取数 + N×N 协方差矩阵，
 *   成本随标的数平方增长。免费版不是"看不到"，而是结构上做不了。
 *
 * 输出口径全部可复核：窗口、样本数、每个标的的年化波动、相关性最高的一对，
 * 以及等权/最小方差两种口径的对照。不做集中度评分之类的黑箱指标。
 */

/** 单次诊断的标的数上限：30 只 → 900 个协方差分量，够了，再大只是拖慢响应 */
const MAX_SYMBOLS = 30;

/** 上游单标的日线（push2his）。只要收盘价，不需要开高低与成交量。 */
async function fetchCloses(secid: string, days: number): Promise<{ date: string; close: number }[]> {
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}` +
    `&klt=101&fqt=1&beg=19900101&end=20500101&fields1=f1,f2&fields2=f51,f53`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Referer: "https://quote.eastmoney.com/",
    },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const klines = (j?.data?.klines ?? []) as string[];
  const out: { date: string; close: number }[] = [];
  for (const row of klines.slice(-days)) {
    const p = row.split(",");
    const close = Number(p[1]);
    if (p[0] && close > 0) out.push({ date: p[0], close });
  }
  return out;
}

/** 有限并发：一次全发会把上游打到限频，反而整体失败 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  // 批量诊断归专业版：不是藏数据，是这道计算的成本随标的数平方增长
  const gate = proGate(session, "batch-diagnosis");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const days = Math.min(1200, Math.max(120, Number(new URL(req.url).searchParams.get("days") ?? 500)));

  const rows = (await db
    .select({ secid: s.watchlists.code, name: s.watchlists.name })
    .from(s.watchlists)
    .where(eq(s.watchlists.uid, session.id))) as Array<{ secid: string; name: string | null }>;

  if (!rows.length) {
    return NextResponse.json({
      ok: false,
      error: "自选列表为空，先添加标的再做组合诊断",
      hint: "在行情页或个股页点「加自选」，这里会读取账号下的自选列表",
    }, { status: 400 });
  }

  const picked = rows.slice(0, MAX_SYMBOLS);
  const truncated = rows.length - picked.length;

  const fetched = await mapLimit(picked, 5, async (r) => {
    try {
      // 板块（BK）与指数走的是同一套日线接口，secid 前缀不同，直接透传
      const bars = await fetchCloses(r.secid, days);
      if (bars.length < 2) return { ...r, bars, err: "无日线数据" as string | null };
      return { ...r, bars, err: null };
    } catch (e: any) {
      return { ...r, bars: [] as { date: string; close: number }[], err: e?.message ?? "取数失败" };
    }
  });

  const usable = fetched.filter((f) => f.bars.length >= 60);
  const failed = fetched
    .filter((f) => f.bars.length < 60)
    .map((f) => `${f.name ?? f.secid}（${f.secid}）：${f.err ?? `仅 ${f.bars.length} 根日线，不足 60`}`);

  if (usable.length < 2) {
    return NextResponse.json({
      ok: false,
      error: "可用标的不足 2 个，无法计算组合协方差",
      failed,
      hint: "组合诊断至少要两个标的；单个标的请看个股页的风险指标",
    }, { status: 503 });
  }

  const series: PriceSeries[] = usable.map((f) => ({
    asset: f.secid,
    dates: f.bars.map((b) => b.date),
    closes: f.bars.map((b) => b.close),
  }));

  const { dates, returns } = alignReturns(series);
  if (returns.length < 2 || returns[0].length < 60) {
    return NextResponse.json({
      ok: false,
      error: `共同交易日不足（${returns[0]?.length ?? 0} 个），无法算协方差`,
      failed,
    }, { status: 503 });
  }

  const cov = annualCovariance(returns);
  const vol = annualVol(cov);
  const corr = correlationMatrix(cov);
  const n = usable.length;
  const equal = Array(n).fill(1 / n);
  const minVar = minVarianceWeights(cov);

  // 相关性最高的一对（排除对角线）——分散化最该先处理的那两个
  let topPair: { a: string; b: string; rho: number } | null = null;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (!topPair || corr[i][j] > topPair.rho)
        topPair = { a: usable[i].name ?? usable[i].secid, b: usable[j].name ?? usable[j].secid, rho: Number(corr[i][j].toFixed(4)) };

  /** 集中度：等权组合的赫芬达尔指数，等权时恒为 1/n —— 这里报的是最小方差权重的集中度 */
  const hhi = Number(minVar.reduce((a, w) => a + w * w, 0).toFixed(4));

  return NextResponse.json(
    {
      ok: true,
      updated: new Date().toISOString(),
      window: { from: dates[0], to: dates[dates.length - 1], sessions: dates.length, tradingDaysPerYear: TRADING_DAYS },
      count: n,
      truncated,
      assets: usable.map((f, i) => ({
        secid: f.secid,
        name: f.name ?? f.secid,
        vol: Number(vol[i].toFixed(4)),
        bars: f.bars.length,
      })),
      portfolio: {
        equalWeight: Number(portfolioVol(equal, cov).toFixed(4)),
        minVariance: Number(portfolioVol(minVar, cov).toFixed(4)),
        minVarianceWeights: minVar.map((v) => Number(v.toFixed(4))),
        concentrationHHI: hhi,
        effectiveN: Number((1 / (hhi || 1)).toFixed(2)),
      },
      topPair,
      corr,
      failed,
      note: "组合波动由各标的同期日收益的样本协方差自算；权重为无约束最小方差解，仅作风险对照，不构成调仓建议。",
    },
    { headers: { "Cache-Control": "private, max-age=900" } }
  );
}