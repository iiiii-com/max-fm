import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { aiGenerate, aiGenerateOrFallback, hasAI } from "@/lib/ai";
import { getPolicies, getTemperatures, getFeelingAggregates } from "@/lib/data/queries";
import { fetchQuotes, fetchSectors } from "@/lib/data/quotes";
import { syncMacroReal, computeMacroTemperature, backfillMacroTemperatureHistory } from "@/lib/data/macro-sync";
import { syncPoliciesReal } from "@/lib/data/policy-sync";
import { ensureMonthlyReports } from "@/lib/data/monthly-report";
// 任务写库后必须让读缓存失效，否则页面在 TTL 内仍然显示同步前的旧数据。
import { invalidateDataCache } from "@/lib/data/cache";
// 行情面板的定时预取：直接把三个接口的 GET 处理器跑一遍，让它们走各自完整的
// 「取数 → 归一化 → 落库快照/内存快照」路径，避免在任务里重写一套取数逻辑而产生口径分叉。
import { GET as fundRankGET } from "@/app/api/market/fund-rank/route";
import { GET as surgeGET } from "@/app/api/market/surge/route";
import { GET as sectorBoardGET } from "@/app/api/sector/board/route";

export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  // 只接受 Authorization 头，不再接受 URL 里的 ?secret=。
  // 原因：vercel.json 里的明文 secret 会随仓库泄露，且 URL 会进访问日志 / Referer。
  // Vercel 平台在配置了 CRON_SECRET 环境变量后，会自动带上该头。
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET 未配置；为避免任务被任意触发，已拒绝无鉴权请求" },
      { status: 503 }
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const task = searchParams.get("task") || "all";
  const force = searchParams.get("force") === "1";
  const results: string[] = [];

  const run = async (name: string, fn: () => Promise<string>) => {
    const t0 = Date.now();
    try {
      const detail = await fn();
      results.push(`${name}: OK (${detail})`);
      await db.insert(s.taskLogs).values({ id: uid("log"), taskName: name, status: "success", detail, durationMs: Date.now() - t0, tokens: 0, createdAt: now() } as any);
    } catch (e: any) {
      results.push(`${name}: FAIL (${e?.message})`);
      await db.insert(s.taskLogs).values({ id: uid("log"), taskName: name, status: "failed", detail: String(e?.message || e), durationMs: Date.now() - t0, tokens: 0, createdAt: now() } as any);
    } finally {
      // 无论成功失败都清读缓存：成功要让新数据立刻可见，
      // 失败也可能有部分写成功（例如 macro-sync 单个指标失败但其它已落库）。
      invalidateDataCache();
    }
  };

  const dailyReview = async () => {
    const [quotes, sectors] = await Promise.all([fetchQuotes(), fetchSectors()]);
    const today = new Date().toISOString().slice(0, 10);
    const top = [...sectors].sort((a: any, b: any) => b.changePct - a.changePct)[0];
    const fb = `# 今日复盘\n\n**指数表现**：${quotes.slice(0, 4).map((q: any) => `${q.name} ${q.price}（${q.changePct >= 0 ? "+" : ""}${q.changePct}%）`).join("，")}。\n\n**领涨板块**：${top?.name ?? "—"}（${top?.changePct ?? 0}%）。\n\n**数据来源**：东方财富公开行情接口。\n\n*内容由 AI 自动生成，不构成投资建议。*`;
    const prompt = `今天是 ${today}。基于以下行情生成 A 股收盘复盘（300-500 字 Markdown，日期写 ${today}）：指数=${quotes.slice(0, 4).map((q: any) => `${q.name} ${q.price} ${q.changePct}%`).join(";")}；板块=${sectors.slice(0, 6).map((x: any) => `${x.name} ${x.changePct}%`).join(";")}。包含：指数表现、板块热点、资金面、明日关注。`;
    const content = await aiGenerateOrFallback(prompt, fb, { model: "cheap", maxTokens: 1200 });
    // 幂等：任务可能被重复触发（daily cron 与 task=all 的补跑），
    // 旧实现直接 insert，导致同一个 slug 一天出现多条复盘。
    const slug = `daily-${today}`;
    const existing = await db
      .select({ id: s.articles.id })
      .from(s.articles)
      .where(and(eq(s.articles.type, "daily"), eq(s.articles.slug, slug)))
      .limit(1);
    const values = {
      id: uid("art"), type: "daily", slug,
      title: `今日复盘：${top?.name ?? "市场"}领涨`,
      summary: `AI 自动生成的当日市场复盘（${today}）。`,
      content, tags: JSON.stringify(["复盘", "A股"]), sourceModel: "auto",
      qualityScore: "80", status: "published", publishDate: today, updatedAt: now(),
    };
    if (existing.length) {
      await db.update(s.articles).set(values as any).where(eq(s.articles.id, existing[0].id));
    } else {
      await db.insert(s.articles).values({ ...values, createdAt: now() } as any);
    }
    return existing.length ? `已更新当日复盘` : `已生成当日复盘并发布`;
  };

  const temperatureReport = async () => {
    const detail = await computeMacroTemperature();
    const [temps, policies, feeling] = await Promise.all([
      getTemperatures(),
      getPolicies(),
      getFeelingAggregates(),
    ]);
    const latest = temps[temps.length - 1];
    if (!latest) return "无温度数据";
    const policyTitle = policies[0]?.title ?? "近期政策";
    const temp = detail.temperature;
    const factorLine = `PMI 原始 ${detail.raw.pmi ?? "—"}（得分 ${detail.scores.pmi}）· CPI 原始 ${detail.raw.cpi ?? "—"}%（得分 ${detail.scores.cpi}）· M2 原始 ${detail.raw.m2 ?? "—"}%（得分 ${detail.scores.m2}），权重 0.4/0.35/0.25`;

    // 体感必须来自真实问卷聚合；无问卷时温差不可计算，此时只出宏观温度部分，
    // 不再沿用硬编码的「体感 45°」（旧实现把 45 同时写进了 fallback 文案与 AI prompt）。
    if (feeling.overall == null || feeling.sampleCount === 0) {
      return "暂无体感问卷数据，温差报告需等体感均值产生后才能生成（不填充默认值）";
    }
    const feelingTemp = Math.round(feeling.overall);
    const diff = Math.round(temp - feelingTemp);

    const fb = `# 温差报告\n\n本月宏观温度 **${temp}°**，大众体感温度 **${feelingTemp}°**（${feeling.sampleCount} 份问卷均值），温差 **${diff > 0 ? "+" : ""}${diff} 度**。\n\n**温度拆解**：${factorLine}。\n\n**温差来源**：1）平均值掩盖结构差异；2）宏观增长未同步传导至居民收入；3）指标滞后于现实感受；4）地区与行业分化。\n\n**近期相关**：${policyTitle}。`;
    const prompt = `宏观温度=${temp}°（拆解：${factorLine}），大众体感=${feelingTemp}°（问卷样本 ${feeling.sampleCount} 份），温差=${diff}度。生成《温差报告》Markdown，300-500 字，解释温差成因（统计口径/收入传导/时间滞后/地区行业分化），引用近期政策「${policyTitle}」。不得编造未提供的数字。`;
    const content = await aiGenerateOrFallback(prompt, fb, { model: "strong", maxTokens: 1200 });
    const today = new Date().toISOString().slice(0, 10);
    // 同一天只保留一条温差报告（任务重跑时更新而不是追加）
    const existing = await db
      .select({ id: s.temperatureAnalyses.id })
      .from(s.temperatureAnalyses)
      .where(eq(s.temperatureAnalyses.date, today))
      .limit(1);
    if (existing.length) {
      await db
        .update(s.temperatureAnalyses)
        .set({ temperatureDiff: diff, content } as any)
        .where(eq(s.temperatureAnalyses.id, existing[0].id));
    } else {
      await db.insert(s.temperatureAnalyses).values({ id: uid("tan"), date: today, temperatureDiff: diff, content, createdAt: now() } as any);
    }
    return `已生成温差报告（${diff > 0 ? "+" : ""}${diff}°）`;
  };

  // 月度报告：幂等生成（当月已有则跳过，不重复烧 token）。
  // 之所以放在 task=all 里：daily cron（03:45）每天都会走到这里，
  // 即使月度专用 cron 漏跑，也能在每月 1 日自动补上当月报告；
  // ensureMonthlyReports 还会在每月 1–5 日补齐「上个月」的月报（上月末数据此时才齐）。
  // force=1 用于「数据源刚修好、需要把已有模板月报按真实序列重算一遍」的运维场景
  // （历史上出现过：月报先由种子数据生成，之后真实宏观同步跑通，但旧月报永远跳过更新）。
  const macroMonthly = async () => {
    const results = await ensureMonthlyReports({ force });
    return results.map((r) => r.message).join("；");
  };

  const policyAnalysis = async () => {
    const [policies, existing] = await Promise.all([
      getPolicies(),
      db.select().from(s.policyAnalyses),
    ]);
    const byUid: Map<string, any> = new Map(existing.map((x: any) => [x.uid, x]));
    const targets = policies
      .filter((p: any) => !byUid.has(p.id) || !byUid.get(p.id)?.detail)
      .slice(0, 5);
    let n = 0;
    for (const p of targets) {
      const fb = {
        popular: `# 普通人怎么看\n\n**一句话**：${p.title}。\n\n**影响**：对普通人的直接影响包括收入、就业、消费与投资（如楼市、股市、存款）等渠道，整体偏中性，长期利好经济修复。\n\n**建议**：关注政策落地细节与配套措施，理性看待短期波动，不轻信小道消息。\n\n*内容由 AI 自动生成，不构成投资建议。*`,
        professional: `# 专业解读\n\n**政策要点**：${p.summary}。\n\n**解读**：本次政策由${p.department || "相关部门"}发布，旨在稳定预期、畅通循环。从宏观视角看，政策取向延续了稳中求进的主基调，短期有助于提振信心，中长期效果取决于执行与配套。\n\n**关注点**：1）落地节奏与资金规模；2）对相关行业与产业链的传导路径；3）后续是否有配套细则。`,
        detail: `# 趋势与风险\n\n**趋势判断**：政策方向利好${p.category || "相关"}领域，相关产业链（新能源/半导体/AI/消费等视政策内容而定）存在结构性机会。\n\n**风险提示**：1）政策落地不及预期；2）市场已提前定价；3）外部环境变化。建议投资者结合自身风险承受能力理性决策。`,
        dataLinks: JSON.stringify(["GDP 同比增速", "CPI 同比", "制造业 PMI"]),
      };
      let popular = fb.popular, professional = fb.professional, detail = fb.detail, dataLinks = fb.dataLinks;
      if (hasAI()) {
        try {
          const out = await aiGenerate(
            `你是宏观政策分析师。请对以下政策生成三层解读，严格输出 JSON：{"popular":"普通人视角解读(Markdown,150-250字)","professional":"专业机构视角解读(Markdown,250-400字)","detail":"趋势判断与风险提示(Markdown,150-250字)","dataLinks":["关联指标名数组"]}。\n\n政策标题：${p.title}\n机构：${p.department || "—"}\n摘要：${p.summary}\n分类：${p.category || "—"}\n发布时间：${p.publishDate}`,
            { model: "strong", maxTokens: 1600, temperature: 0.4 },
          );
          const parsed = JSON.parse(out.replace(/```json|```/g, "").trim());
          if (parsed.popular) popular = parsed.popular;
          if (parsed.professional) professional = parsed.professional;
          if (parsed.detail) detail = parsed.detail;
          if (Array.isArray(parsed.dataLinks)) dataLinks = JSON.stringify(parsed.dataLinks);
        } catch {
          // 解析失败保留 fallback
        }
      }
      const prev = byUid.get(p.id);
      if (prev) {
        await db.update(s.policyAnalyses).set({ detail, updatedAt: now() }).where(eq(s.policyAnalyses.id, prev.id));
      } else {
        await db.insert(s.policyAnalyses).values({
          id: uid("pan"), uid: p.id, popular, professional, detail, dataLinks,
          source: "max-ai", sourceModel: hasAI() ? "deepseek-chat" : "template",
          createdAt: now(), updatedAt: now(),
        } as any);
      }
      n++;
    }
    return `已分析 ${n} 条政策（待分析 ${targets.length}）`;
  };

  /**
   * 行情面板预取（任务②的一部分）。
   *
   * 为什么需要：东财 push2 按并发连接数掐断连接（实测并发 8 全失败、串行全成功），
   * 页面渲染时同时打十几个接口会成批失败，用户看到的就是「资金流/异动/板块面板空白」。
   * 由 cron 在低峰期顺序预取并落库快照（market_snapshots），页面在上游失败时读快照，
   * 并显式标注「数据时间」，既不空面板也不把旧数据伪装成实时。
   *
   * 顺序执行（不 Promise.all）是刻意的：预取的目的就是避开并发掐断。
   */
  const marketPrefetch = async () => {
    const calls: Array<[string, () => Promise<Response>]> = [
      ["fund-rank", () => fundRankGET()],
      ["surge", () => surgeGET()],
      ["sector-board", () => sectorBoardGET(new Request("http://internal/api/sector/board?top=60"))],
    ];
    const out: string[] = [];
    for (const [name, fn] of calls) {
      try {
        const res = await fn();
        const body: any = await res.json().catch(() => null);
        if (!res.ok || body?.ok === false) out.push(`${name}=失败(${body?.error ?? res.status})`);
        else out.push(`${name}=${body?.stale ? "陈旧快照" : "已刷新"}`);
      } catch (e: any) {
        out.push(`${name}=失败(${e?.message ?? e})`);
      }
    }
    return out.join("，");
  };

  if (task === "all" || task === "daily") await run("daily-review", dailyReview);
  // 预取失败不影响其它任务（上游抽风时本任务会记 failed，次日/下一轮再补）。
  if (task === "all" || task === "daily" || task === "market-prefetch") await run("market-prefetch", marketPrefetch);
  if (task === "all" || task === "temperature") await run("temperature-report", temperatureReport);
  if (task === "all" || task === "monthly") await run("macro-monthly", macroMonthly);
  if (task === "all" || task === "policy" || task === "policy-sync") await run("policy-sync", async () => {
    const synced = await syncPoliciesReal();
    const insertSum = synced.reduce((a, x: any) => a + (x.inserted || 0), 0);
    const analysisMsg = insertSum > 0 ? await policyAnalysis() : "无新政策需分析";
    return `同步 ${synced.map((x: any) => `${x.org}=${x.inserted}${x.error ? `(${x.error})` : ""}`).join(", ")}；${analysisMsg}`;
  });
  if (task === "all" || task === "policy-analysis") await run("policy-analysis", policyAnalysis);
  if (task === "all" || task === "macro-sync") await run("macro-sync", async () => {
    const res = await syncMacroReal();
    // 真数据落库后立即用同一公式回填历史温度，
    // 否则旧库里的「五因子 58–62°」与新的「三因子 37°」会在同一个折线图上造成假断崖。
    const temps = await backfillMacroTemperatureHistory();
    const cur = temps[temps.length - 1];
    // 单个指标失败不再中断整轮同步，这里把失败项一起回显，便于运维判断
    // 是「全挂了」还是「只有某个上游接口抽风」。
    const detail = res.map((r) => (r.error ? `${r.type}=失败(${r.error})` : `${r.type}=${r.count}`)).join(", ");
    return `${detail}；温度历史回填 ${temps.length} 期${cur ? `（最新 ${cur.ym}=${cur.temperature}°）` : ""}`;
  });

  return NextResponse.json({ ok: true, results });
}