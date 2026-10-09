import { NextResponse } from "next/server";
import { STATIC_CHAINS, getStaticChain } from "@/lib/data/chains";
import { buildChainIndex, relativeStrength, stageBreakdown, interpretStages, MIN_BARS, type MemberSeries } from "@/lib/data/chainIndexCalc";
import { fetchDailyCloses, mapLimit } from "@/lib/data/stock-kline";
import { fetchIndexKlineMulti } from "@/lib/data/index-kline";
import { getSession } from "@/lib/auth";
import { proGate } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * 产业链指数接口：用链上成员股的**真实收盘价**等权合成。
 *
 * 数据真实性纪律（这是本接口存在的全部理由）：
 *  - 只用真实收盘价，不引入任何估算的市值、权重或规模；
 *  - 每个数字都能被复算：等权口径、共同交易日、基点 1000 全部写进响应；
 *  - 成员覆盖率如实上报（链上共几家、有几家有 secid、实际算进几家、谁被剔除及原因）；
 *  - 取数失败不伪装成"没有数据"，而是单独列出失败项。
 *
 * 不做的事：不给链级规模/增速/市占率 —— 那些没有可核验的公开口径，
 * 编一个看起来合理的数字比留空有害得多。
 */

/** 单链最多取多少成员（再多只是拖慢且容易被上游限频） */
const MAX_MEMBERS = 20;

export async function GET(req: Request) {
  // 链指数是服务端计算型能力：取 M 个成员的日线 + 合成 + 基准对齐。
  // 免费版仍可看到完整的产业链结构（环节 / 代表公司 / 供需说明 / 跨链关联），
  // 这里锁的是"更深一层加工"，不是把结论藏起来。
  const gate = proGate(await getSession(), "chain-index");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim() ?? "";
  const days = Math.min(1500, Math.max(120, Number(searchParams.get("days") ?? 500)));
  const withBenchmark = searchParams.get("benchmark") !== "0";

  const chain = getStaticChain(slug);
  if (!chain) {
    return NextResponse.json(
      { ok: false, error: `未收录的产业链：${slug}`, hint: `可用 slug 见 /api/chain/index?list=1` },
      { status: 404 }
    );
  }

  // 成员来自静态图谱（人工整理的代表公司），带 secid 才能算
  const all = chain.segments.flatMap((s) => s.companies);
  // secid → 层级：同一只股票可能出现在多个环节，取第一次出现的层级（人工整理顺序即上游→下游）
  const stageOf = new Map<string, string>();
  for (const seg of chain.segments) {
    for (const c of seg.companies) {
      if (c.secid && !stageOf.has(c.secid)) stageOf.set(c.secid, seg.stage);
    }
  }
  const withId = all.filter((c) => c.secid);
  const withoutId = all.filter((c) => !c.secid);
  const picked = withId.slice(0, MAX_MEMBERS);

  // 并发压到 2：上游对本机连接极敏感，5 路并发就会全线被掐（实测）
  const fetched = await mapLimit(picked, 2, async (c) => {
    try {
      const bars = await fetchDailyCloses(c.secid!, days);
      return { secid: c.secid!, name: c.name, bars: bars.length, dates: bars.map((b) => b.date), closes: bars.map((b) => b.close), err: null as string | null };
    } catch (e: any) {
      return { secid: c.secid!, name: c.name, bars: 0, dates: [] as string[], closes: [] as number[], err: e?.message ?? "取数失败" };
    }
  });

  const series: MemberSeries[] = fetched.map((f) => ({
    secid: f.secid,
    name: f.name,
    bars: f.bars,
    dates: f.dates,
    closes: f.closes,
    stage: stageOf.get(f.secid),
  }));
  const result = buildChainIndex(series);

  // 环节级拆解 + 由数据推出的结论（可逐项验算，不是主观评论）
  const stages = stageBreakdown(series);
  const interpretation = interpretStages(stages, result.stats.ret);

  if (!result.points.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "可用成员不足，无法合成链指数",
        chain: { slug: chain.id, name: chain.name },
        excluded: result.excluded,
        fetchFailed: fetched.filter((f) => f.err).map((f) => `${f.name}（${f.secid}）：${f.err}`),
        hint: "链指数至少需要 2 个有足够日线的成员",
      },
      { status: 503 }
    );
  }

  // 基准：沪深300（真实指数日线，多源容错）
  let benchmark: Array<{ date: string; value: number }> = [];
  let benchmarkName: string | null = null;
  if (withBenchmark) {
    try {
      const { bars, source } = await fetchIndexKlineMulti("1.000300", days);
      if (bars.length) {
        benchmarkName = `沪深300（${source}）`;
        // 基准同样以窗口首日为基点，才能与链指数同起点比较
        const first = bars[0].close;
        benchmark = bars.map((b) => ({ date: b.date, value: Number(((b.close / first) * 1000).toFixed(2)) }));
      }
    } catch {
      // 基准取不到就不给相对强弱，而不是拿别的指数冒充
    }
  }

  const rs = benchmark.length ? relativeStrength(result.points, benchmark) : [];

  return NextResponse.json(
    {
      ok: true,
      updated: new Date().toISOString(),
      chain: { slug: chain.id, name: chain.name, prosperity: chain.prosperity },
      method: {
        weighting: "等权（每日取全体有效成员日收益的算术平均后累乘）",
        base: 1000,
        alignment: "只使用全体有效成员的共同交易日；任一成员缺失的交易日整行剔除",
        minBars: MIN_BARS,
        suspended: "停牌日与零价已剔除，不当作 0 收益",
      },
      coverage: {
        companiesInChain: all.length,
        withSecid: withId.length,
        usedInIndex: result.members.length,
        excludedByData: result.excluded,
        missingSecid: withoutId.map((c) => c.name),
        truncated: withId.length > MAX_MEMBERS ? withId.length - MAX_MEMBERS : 0,
        fetchFailed: fetched.filter((f) => f.err).map((f) => `${f.name}（${f.secid}）：${f.err}`),
      },
      stats: result.stats,
      stages,
      interpretation,
      members: result.members,
      points: result.points,
      benchmark: benchmarkName ? { name: benchmarkName, points: benchmark } : null,
      relativeStrength: rs,
      note: "链指数由代表公司等权合成，代表公司为人工整理的代表性样本，不等于该产业的全部上市公司；指数仅反映样本表现，不构成投资建议。",
    },
    // 含较长序列且逐链计算，缓存在浏览器侧即可
    { headers: { "Cache-Control": "private, max-age=1800" } }
  );
}