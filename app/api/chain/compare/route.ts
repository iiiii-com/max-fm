import { NextResponse } from "next/server";
import { STATIC_CHAINS, getStaticChain } from "@/lib/data/chains";
import { buildChainIndex, relativeStrength, MIN_BARS, type MemberSeries } from "@/lib/data/chainIndexCalc";
import { fetchDailyCloses, mapLimit } from "@/lib/data/stock-kline";
import { fetchIndexKlineMulti } from "@/lib/data/index-kline";
import { alignReturns, annualCovariance, correlationMatrix } from "@/lib/data/portfolio-risk";
import { getSession } from "@/lib/auth";
import { proGate } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * 多链对比（专业版）：把多条产业链指数放在同一窗口并排。
 *
 * 为什么这是真护城河而不是功能开关：
 *   单条链指数要取 M 个成员的日线；对比 N 条链就是 N×M 次取数 + N 条曲线合成
 *   + N×N 相关矩阵。成本随链数线性增长、相关性部分平方增长 ——
 *   免费版不是"看不到"，而是结构上做不了这件事。
 *
 * 数据真实性纪律与单链一致：等权、共同交易日、基点 1000、覆盖率与失败项如实上报。
 * 关键差异：多链对比必须用**所有链的共同交易日**，否则不同链的收益区间不同、
 * 排名就没有可比性 —— 这一点在响应里显式说明。
 */

/** 对比的链数上限：每条链最多取 8 个成员，10 条链 = 80 次取数，再大只是拖慢 */
const MAX_CHAINS = 10;
const MAX_MEMBERS_PER_CHAIN = 8;

export async function GET(req: Request) {
  const gate = proGate(await getSession(), "chain-compare");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const days = Math.min(1000, Math.max(120, Number(searchParams.get("days") ?? 400)));
  const raw = searchParams.get("slugs");

  // 未指定就用默认观测池：覆盖主要产业方向，且都是成员数充足的大链
  const DEFAULT_SLUGS = [
    "semiconductor", "ai", "nev", "solar", "pharma", "defense",
    "consumer", "robot", "lowaltitude", "computing",
  ];
  const slugs = (raw ? raw.split(",") : DEFAULT_SLUGS)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_CHAINS);

  const unknown = slugs.filter((s) => !getStaticChain(s));
  const valid = slugs.filter((s) => getStaticChain(s));
  if (!valid.length) {
    return NextResponse.json(
      { ok: false, error: "没有有效的产业链 slug", unknown, hint: "见 /industry 的产业链列表" },
      { status: 400 }
    );
  }

  // 逐链取成员日线：链内并发 2（上游对本机连接敏感，实测 5 路就会全线被掐）
  const perChain = await mapLimit(valid, 1, async (slug) => {
    const chain = getStaticChain(slug)!;
    const companies = chain.segments.flatMap((s) => s.companies).filter((c) => c.secid);
    const picked = companies.slice(0, MAX_MEMBERS_PER_CHAIN);
    const fetched = await mapLimit(picked, 2, async (c) => {
      try {
        const bars = await fetchDailyCloses(c.secid!, days);
        return { secid: c.secid!, name: c.name, bars: bars.length, dates: bars.map((b) => b.date), closes: bars.map((b) => b.close), err: null as string | null };
      } catch (e: any) {
        return { secid: c.secid!, name: c.name, bars: 0, dates: [] as string[], closes: [] as number[], err: e?.message ?? "取数失败" };
      }
    });
    const series: MemberSeries[] = fetched.map((f) => ({ secid: f.secid, name: f.name, bars: f.bars, dates: f.dates, closes: f.closes }));
    return {
      slug,
      name: chain.name,
      prosperity: chain.prosperity,
      series,
      companiesTotal: chain.segments.flatMap((s) => s.companies).length,
      withSecid: companies.length,
      fetchFailed: fetched.filter((f) => f.err).map((f) => `${f.name}：${f.err}`),
    };
  });

  // 单链合成（各自口径）
  const built = perChain.map((c) => ({ ...c, idx: buildChainIndex(c.series) }));
  const usable = built.filter((c) => c.idx.points.length > 0);

  if (usable.length < 2) {
    return NextResponse.json(
      {
        ok: false,
        error: "可用链不足 2 条，无法对比",
        perChain: built.map((c) => ({
          slug: c.slug, name: c.name,
          used: c.idx.members.length,
          excluded: c.idx.excluded,
          fetchFailed: c.fetchFailed,
        })),
        hint: "每条链至少需要 2 个有足够日线的成员",
      },
      { status: 503 }
    );
  }

  /**
   * 统一到所有链的**共同交易日**。
   * 不统一的话各链区间不同、排名不可比 —— 那比不给对比更糟。
   */
  const aligned = alignReturns(
    usable.map((c) => ({
      asset: c.slug,
      dates: c.idx.points.map((p) => p.date),
      closes: c.idx.points.map((p) => p.value),
    }))
  );

  const firstDate = aligned.firstDate;
  const commonDates = firstDate ? [firstDate, ...aligned.dates] : [];

  // 在各链自己的曲线上按共同日期取值，重定基点为 1000
  const curves = usable.map((c, k) => {
    const map = new Map(c.idx.points.map((p) => [p.date, p.value]));
    const base = map.get(commonDates[0]) ?? null;
    const pts = commonDates
      .map((d) => ({ date: d, value: map.get(d) }))
      .filter((p): p is { date: string; value: number } => p.value != null)
      .map((p) => ({ date: p.date, value: Number(((p.value / base!) * 1000).toFixed(2)) }));
    return { slug: c.slug, name: c.name, prosperity: c.prosperity, points: pts, ret: aligned.returns[k] };
  });

  const sessions = aligned.returns[0]?.length ?? 0;
  if (sessions < 20) {
    return NextResponse.json(
      { ok: false, error: `共同交易日仅 ${sessions} 个，不足以对比`, hint: "缩短窗口或减少链数" },
      { status: 503 }
    );
  }

  // 区间收益（在共同窗口内，从曲线首末取值，与曲线一致）
  const rows = curves.map((c) => {
    const first = c.points[0]?.value ?? 1000;
    const lastV = c.points[c.points.length - 1]?.value ?? 1000;
    // 年化波动：该链在共同窗口内的日收益
    const cov = annualCovariance([c.ret]);
    const vol = Math.sqrt(Math.max(cov[0][0], 0)) * 100;
    return {
      slug: c.slug,
      name: c.name,
      prosperity: c.prosperity,
      ret: Number(((lastV / first - 1) * 100).toFixed(2)),
      vol: Number(vol.toFixed(2)),
    };
  });
  rows.sort((a, b) => b.ret - a.ret);
  rows.forEach((r, i) => Object.assign(r, { rank: i + 1 }));

  // 两两相关性（用共同窗口的日收益）
  const corr = correlationMatrix(annualCovariance(curves.map((c) => c.ret)));
  const corrOut = curves.map((a, i) => ({
    slug: a.slug,
    name: a.name,
    with: curves.map((b, j) => ({ slug: b.slug, name: b.name, rho: Number(corr[i][j].toFixed(4)) })),
  }));

  // 基准相对强弱（用排名第一的链做示例不够，这里给每条链 vs 沪深300）
  let benchmarkName: string | null = null;
  let rs: Array<{ slug: string; name: string; excess: number }> = [];
  try {
    const { bars, source } = await fetchIndexKlineMulti("1.000300", days);
    if (bars.length) {
      benchmarkName = `沪深300（${source}）`;
      const bmMap = new Map(bars.map((b) => [b.date, b.close]));
      const bmBase = bmMap.get(commonDates[0]);
      if (bmBase) {
        rs = curves.map((c) => {
          const lastP = c.points[c.points.length - 1];
          const bmLast = bmMap.get(lastP.date);
          const chainRet = lastP.value / 1000 - 1;
          const bmRet = bmLast != null ? bmLast / bmBase - 1 : null;
          return {
            slug: c.slug,
            name: c.name,
            excess: bmRet == null ? 0 : Number(((chainRet - bmRet) * 100).toFixed(2)),
          };
        });
        rs.sort((a, b) => b.excess - a.excess);
      }
    }
  } catch {
    // 基准取不到就不给超额，不拿别的指数冒充
  }

  return NextResponse.json(
    {
      ok: true,
      updated: new Date().toISOString(),
      window: { from: commonDates[0], to: commonDates[commonDates.length - 1], sessions },
      method: {
        weighting: "每条链内部等权，基点 1000",
        alignment: "所有链统一到**共同交易日**并重定基点，否则区间不同、排名不可比",
        minBars: MIN_BARS,
        membersPerChain: MAX_MEMBERS_PER_CHAIN,
      },
      ranking: rows,
      curves: curves.map((c) => ({ slug: c.slug, name: c.name, points: c.points })),
      correlation: corrOut,
      relativeStrength: benchmarkName ? { benchmark: benchmarkName, rows: rs } : null,
      coverage: built.map((c) => ({
        slug: c.slug,
        name: c.name,
        companiesInChain: c.companiesTotal,
        withSecid: c.withSecid,
        usedInIndex: c.idx.members.length,
        excluded: c.idx.excluded,
        fetchFailed: c.fetchFailed,
      })),
      unknown,
      note: "各链指数由代表公司等权合成，代表公司为人工整理的代表性样本，不等于该产业全部上市公司。排名为共同窗口内的相对表现，不构成投资建议。",
    },
    { headers: { "Cache-Control": "private, max-age=1800" } }
  );
}