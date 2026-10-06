import { NextResponse } from "next/server";
import { pullSectorKline } from "@/lib/data/sector-kline";

export const dynamic = "force-dynamic";

/**
 * 行业高频景气度：从板块自身日线自算，不引入任何外部景气指标（外部源未接入前，
 * 任何"官方景气指数"都只会是编的）。
 *
 * 三个维度都是可核对的原始量：
 *   position 近 1 年收盘分位 —— 现在处在近一年的什么位置（0~100）
 *   momentum20/60  20/60 日累计收益 —— 趋势方向与斜率
 *   vol20          近 20 日年化波动 —— 景气是稳是烫
 * 综合景气度 = 位置分位 × 0.5 + 动量得分 × 0.5，权重与口径都写在输出里。
 *
 * 数据源用 push2his（板块 K 线主机），而不是 push2（板块列表/行情主机）：
 * 后者对本机连接会间歇性限频，板块列表拿不到时仍可用已知 BK code 直接算。
 */

/** 单板块至少需要多少根 K 线才给景气度 */
const MIN_BARS = 90;

function quantileOf(sorted: number[], cur: number): number {
  // 小于等于当前值的占比；并列时取上界，保守（分位偏高 = 更接近"贵/热"）
  let n = 0;
  for (const v of sorted) if (v <= cur) n++;
  return (n / sorted.length) * 100;
}

function stdev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(xs.length - 1, 1));
}

interface Sentiment {
  bk: string;
  bars: number;
  position: number | null;
  momentum20: number | null;
  momentum60: number | null;
  vol20: number | null;
  score: number | null;
  note?: string;
}

function scoreOf(s: Omit<Sentiment, "score" | "note">): number | null {
  if (s.position == null || s.momentum20 == null) return null;
  // 动量得分：把 60 日收益映射到 0~100（±20% 覆盖到两端）
  const momScore = Math.max(0, Math.min(100, 50 + (s.momentum60 ?? s.momentum20) * 250));
  return Number((s.position * 0.5 + momScore * 0.5).toFixed(1));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bks = (searchParams.get("bks") ?? searchParams.get("bk") ?? "BK0475")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^BK\d{3,4}$/.test(s))
    .slice(0, 40);

  if (!bks.length) {
    return NextResponse.json({ ok: false, error: "bks 参数需为 BK 板块代码，逗号分隔（如 bks=BK0475,BK0447）" }, { status: 400 });
  }

  const results = await Promise.all(
    bks.map(async (bk): Promise<Sentiment> => {
      const empty: Sentiment = { bk, bars: 0, position: null, momentum20: null, momentum60: null, vol20: null, score: null, note: "取数失败" };
      try {
        const bars = await pullSectorKline(bk, 400);
        if (!bars.length) return { ...empty, note: "无 K 线数据" };
        if (bars.length < MIN_BARS) {
          return { ...empty, bars: bars.length, note: `仅 ${bars.length} 根 K 线（需 ≥ ${MIN_BARS}），不给景气度` };
        }

        const closes = bars.map((b) => b.close);
        const last = closes[closes.length - 1];
        const win = closes.slice(-244); // 近一年
        const ret = (n: number) => (closes.length > n ? ((last / closes[closes.length - 1 - n] - 1) * 100) : null);
        const rets20 = closes.slice(-21).map((c, i, a) => (i === 0 ? 0 : c / a[i - 1] - 1));

        const base = {
          bk,
          bars: bars.length,
          position: Number(quantileOf([...win].sort((a, b) => a - b), last).toFixed(1)),
          momentum20: ret(20) == null ? null : Number(ret(20)!.toFixed(2)),
          momentum60: ret(60) == null ? null : Number(ret(60)!.toFixed(2)),
          vol20: Number((stdev(rets20) * Math.sqrt(244) * 100).toFixed(2)),
        };
        return { ...base, score: scoreOf(base) };
      } catch (e: any) {
        return { ...empty, note: e?.message ?? "取数异常" };
      }
    })
  );

  const usable = results.filter((r) => r.score != null);
  const degraded = results.filter((r) => r.score == null);

  return NextResponse.json(
    {
      ok: usable.length > 0,
      updated: new Date().toISOString(),
      source: "东财板块日线（push2his）自算，非外部景气指数",
      weighting: "景气度 = 近1年收盘分位 × 0.5 + 60日动量得分 × 0.5（动量 ±20% 映射到 0~100）",
      window: sampleWindow(usable),
      sectors: results,
      degraded: degraded.map((d) => `${d.bk}：${d.note}`),
    },
    { headers: { "Cache-Control": "public, max-age=900, s-maxage=900" } }
  );
}

/** 样本区间说明：各板块 K 线根数可能不同（有的刚上市），如实给出范围而不是假装一致 */
function sampleWindow(rows: Sentiment[]) {
  if (!rows.length) return null;
  const sessions = rows.map((r) => r.bars);
  return {
    sessionsMin: Math.min(...sessions),
    sessionsMax: Math.max(...sessions),
    positionWindow: "近 244 个交易日",
    annualization: 244,
  };
}