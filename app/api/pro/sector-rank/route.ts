import { NextResponse } from "next/server";
import { pullSectorKline } from "@/lib/data/sector-kline";
import { getSession } from "@/lib/auth";
import { proGate } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * 行业景气排行（专业版）：对多个板块批量算景气度并横向排序。
 *
 * 与单板块景气接口的关系：那一个回答"这个行业热不热"，这一个回答
 * "在所有行业里它排第几、还有谁比它更热"。后者才是配置决策真正需要的，
 * 也是成本随板块数线性增长的那部分 —— 所以归专业版。
 *
 * 口径与单板块接口**完全一致**（同一套因子与权重），否则两个页面会给出
 * 互相矛盾的数字，那种不一致比没有排行更糟。
 */

/** 批量上限：20 个板块 × 每个一次上游请求，再大只是拖慢且容易被限频 */
const MAX_BOARDS = 20;
const MIN_BARS = 90;

/** 默认观测池：东财行业板块里流动性最好的若干条，用户可用 bks 覆盖 */
const DEFAULT_BOARDS = [
  "BK0475", "BK0447", "BK0473", "BK1036", "BK1031", "BK1032", "BK1211", "BK1216",
  "BK1041", "BK0448", "BK1037", "BK0456", "BK0422", "BK0486", "BK1202", "BK1204",
  "BK0739", "BK0509",
];

/**
 * 板块名映射：push2his 的日线接口只返回行情不返回板块名，而名称要用的
 * 板块列表接口走的是另一个主机（push2，本机常被限频）。
 * 因此这里只对**已知的默认池**做映射，用户自定义的 bks 显示代码本身 ——
 * 宁可在界面上显示 BK0475，也不要猜一个可能对不上的中文名。
 */
const BOARD_LABELS: Record<string, string> = {
  BK0475: "银行", BK0447: "保险", BK0473: "证券", BK1036: "半导体",
  BK1031: "光伏设备", BK1032: "风电设备", BK1211: "汽车", BK1216: "医药生物",
  BK1041: "医疗器械", BK0448: "通信设备", BK1037: "消费电子", BK0456: "家用电器",
  BK0422: "物流", BK0486: "传媒", BK1202: "房地产", BK1204: "国防军工",
  BK0739: "工程机械", BK0509: "白酒",
};

function quantileOf(sorted: number[], cur: number): number {
  let n = 0;
  for (const v of sorted) if (v <= cur) n++;
  return (n / sorted.length) * 100;
}

function stdev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(xs.length - 1, 1));
}

/** 与 /api/sector/sentiment 同一套因子与权重 */
function scoreOf(position: number, momentum60: number | null, momentum20: number): number {
  const momScore = Math.max(0, Math.min(100, 50 + (momentum60 ?? momentum20) * 250));
  return Number((position * 0.5 + momScore * 0.5).toFixed(1));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export async function GET(req: Request) {
  const gate = proGate(await getSession(), "sector-rank");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("bks");
  const bks = (raw ? raw.split(",") : DEFAULT_BOARDS)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^BK\d{3,4}$/.test(s))
    .slice(0, MAX_BOARDS);

  if (!bks.length) {
    return NextResponse.json({ ok: false, error: "bks 需为 BK 板块代码，逗号分隔" }, { status: 400 });
  }

  const rows = await mapLimit(bks, 4, async (bk) => {
    try {
      const bars = await pullSectorKline(bk, 400);
      if (bars.length < MIN_BARS) {
        return { bk, ok: false as const, note: bars.length ? `仅 ${bars.length} 根 K 线` : "无数据" };
      }
      const closes = bars.map((b) => b.close);
      const last = closes[closes.length - 1];
      const win = closes.slice(-244);
      const ret = (n: number) =>
        closes.length > n ? Number(((last / closes[closes.length - 1 - n] - 1) * 100).toFixed(2)) : null;
      const rets20 = closes.slice(-21).map((c, i, a) => (i === 0 ? 0 : c / a[i - 1] - 1));
      const position = Number(quantileOf([...win].sort((a, b) => a - b), last).toFixed(1));
      const momentum20 = ret(20);
      const momentum60 = ret(60);
      return {
        bk,
        ok: true as const,
        bars: bars.length,
        position,
        momentum20,
        momentum60,
        vol20: Number((stdev(rets20) * Math.sqrt(244) * 100).toFixed(2)),
        score: momentum20 == null ? null : scoreOf(position, momentum60, momentum20),
        from: bars[0].date,
        to: bars[bars.length - 1].date,
      };
    } catch (e: any) {
      return { bk, ok: false as const, note: e?.message ?? "取数异常" };
    }
  });

  const usable = rows.filter((r) => r.ok && (r as any).score != null) as Array<
    Extract<(typeof rows)[number], { ok: true }> & { score: number }
  >;
  const degraded = rows.filter((r) => !r.ok || (r as any).score == null).map((r) => `${r.bk}：${(r as any).note ?? "score 不可算"}`);

  if (!usable.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "没有板块能算出景气度（上游限频或数据不足）",
        degraded,
        hint: "这不是数据为空，是取数失败；稍后重试或缩小 bks 范围",
      },
      { status: 503 }
    );
  }

  // 按景气分降序，并给出每个板块在本次观测池内的排名分位
  const ranked = [...usable].sort((a, b) => (b.score as number) - (a.score as number));
  const n = ranked.length;
  const items = ranked.map((r, i) => ({
    rank: i + 1,
    of: n,
    rankPct: Number((((n - i) / n) * 100).toFixed(1)),
    bk: r.bk,
    name: BOARD_LABELS[r.bk] ?? r.bk,
    score: r.score,
    position: r.position,
    momentum20: r.momentum20,
    momentum60: r.momentum60,
    vol20: r.vol20,
    bars: r.bars,
    from: r.from,
    to: r.to,
  }));

  return NextResponse.json(
    {
      ok: true,
      updated: new Date().toISOString(),
      source: "东财板块日线（push2his）自算，与单板块景气接口同一套因子",
      weighting: "景气度 = 近1年收盘分位 × 0.5 + 60日动量得分 × 0.5（动量 ±20% 映射到 0~100）",
      window: {
        positionWindow: "近 244 个交易日",
        annualization: 244,
        sessionsMin: Math.min(...items.map((i) => i.bars)),
        sessionsMax: Math.max(...items.map((i) => i.bars)),
      },
      count: n,
      items,
      degraded,
      note: "排名是本次观测池内的相对位置，不是全市场排名；换 bks 就会变，对比时请固定同一组板块。",
    },
    { headers: { "Cache-Control": "private, max-age=900" } }
  );
}