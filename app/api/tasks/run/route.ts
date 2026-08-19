import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { aiGenerate, aiGenerateOrFallback, hasAI } from "@/lib/ai";
import { getIndicators, getPolicies, getTemperatures } from "@/lib/data/queries";
import { fetchQuotes, fetchSectors } from "@/lib/data/quotes";
import { syncMacroReal } from "@/lib/data/macro-sync";

export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const secretParam = searchParams.get("secret");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}` && secretParam !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const task = searchParams.get("task") || "all";
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
    }
  };

  const dailyReview = async () => {
    const [quotes, sectors] = await Promise.all([fetchQuotes(), fetchSectors()]);
    const top = [...sectors].sort((a: any, b: any) => b.changePct - a.changePct)[0];
    const fb = `# 今日复盘\n\n**指数表现**：${quotes.slice(0, 4).map((q: any) => `${q.name} ${q.price}（${q.changePct >= 0 ? "+" : ""}${q.changePct}%）`).join("，")}。\n\n**领涨板块**：${top?.name ?? "—"}（${top?.changePct ?? 0}%）。\n\n**数据来源**：东方财富公开行情接口。\n\n*内容由 AI 自动生成，不构成投资建议。*`;
    const prompt = `基于以下行情生成 A 股收盘复盘（300-500 字 Markdown）：指数=${quotes.slice(0, 4).map((q: any) => `${q.name} ${q.price} ${q.changePct}%`).join(";")}；板块=${sectors.slice(0, 6).map((x: any) => `${x.name} ${x.changePct}%`).join(";")}。包含：指数表现、板块热点、资金面、明日关注。`;
    const content = await aiGenerateOrFallback(prompt, fb, { model: "cheap", maxTokens: 1200 });
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(s.articles).values({
      id: uid("art"), type: "daily", slug: `daily-${today}`,
      title: `今日复盘：${top?.name ?? "市场"}领涨`,
      summary: `AI 自动生成的当日市场复盘（${today}）。`,
      content, tags: JSON.stringify(["复盘", "A股"]), sourceModel: "auto",
      qualityScore: "80", status: "published", publishDate: today, createdAt: now(), updatedAt: now(),
    } as any);
    return `已生成当日复盘并发布`;
  };

  const temperatureReport = async () => {
    const [temps, policies] = await Promise.all([getTemperatures(), getPolicies()]);
    const latest = temps[temps.length - 1];
    if (!latest) return "无温度数据";
    const temp = latest.temperature ?? 62;
    const diff = temp - 45;
    const policyTitle = policies[0]?.title ?? "近期政策";
    const fb = `# 温差报告\n\n本月宏观温度 **${temp}°**，大众体感温度 **45°**，温差 **${diff} 度**。\n\n**温差来源**：1）平均值掩盖结构差异；2）宏观增长未同步传导至居民收入；3）指标滞后于现实感受；4）地区与行业分化。\n\n**近期相关**：${policyTitle}。`;
    const prompt = `宏观温度=${temp}°，大众体感=45°，温差=${diff}度。生成《温差报告》Markdown，300-500 字，解释温差成因（统计口径/收入传导/时间滞后/地区行业分化），引用近期政策「${policyTitle}」。`;
    const content = await aiGenerateOrFallback(prompt, fb, { model: "strong", maxTokens: 1200 });
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(s.temperatureAnalyses).values({ id: uid("tan"), date: today, temperatureDiff: diff, content, createdAt: now() } as any);
    return `已生成温差报告（${diff}°）`;
  };

  const macroMonthly = async () => {
    const inds = await getIndicators();
    const cpi = inds.filter((x: any) => x.type === "cpi").slice(-1)[0];
    const pmi = inds.filter((x: any) => x.type === "pmi").slice(-1)[0];
    const gdp = inds.filter((x: any) => x.type === "gdp").slice(-1)[0];
    const fb = `# 宏观月报\n\n## 一句话总结\n\n经济延续温和复苏，内需修复与政策发力是主要支撑。\n\n## 核心数据\n\n| 指标 | 最新值 |\n|---|---|\n| GDP 同比 | ${gdp?.value ?? "—"}% |\n| CPI 同比 | ${cpi?.value ?? "—"}% |\n| PMI | ${pmi?.value ?? "—"} |\n\n## 展望\n\n物价低位运行，货币政策保持宽松取向，关注财政加码与地产企稳信号。\n\n*本报告由 Max AI 自动生成。*`;
    const prompt = `基于最新宏观数据生成《宏观月报》Markdown（500-800 字）：GDP=${gdp?.value}%，CPI=${cpi?.value}%，PMI=${pmi?.value}%。包含：一句话总结、核心数据表、三大看点、风险与展望。`;
    const content = await aiGenerateOrFallback(prompt, fb, { model: "strong", maxTokens: 2048 });
    const ym = new Date().toISOString().slice(0, 7);
    await db.insert(s.articles).values({
      id: uid("art"), type: "monthly", slug: `macro-${ym}`,
      title: `宏观月报：${ym} 经济数据全景解读`,
      summary: "AI 自动生成的月度宏观经济报告。",
      content, tags: JSON.stringify(["宏观", "月报"]), sourceModel: "auto",
      qualityScore: "85", status: "published", publishDate: new Date().toISOString().slice(0, 10), createdAt: now(), updatedAt: now(),
    } as any);
    return `已生成宏观月报`;
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

  if (task === "all" || task === "daily") await run("daily-review", dailyReview);
  if (task === "all" || task === "temperature") await run("temperature-report", temperatureReport);
  if (task === "all" || task === "monthly") await run("macro-monthly", macroMonthly);
  if (task === "all" || task === "policy") await run("policy-analysis", policyAnalysis);
  if (task === "all" || task === "macro-sync") await run("macro-sync", async () => {
    const res = await syncMacroReal();
    return res.map((r) => `${r.type}=${r.count}`).join(", ");
  });

  return NextResponse.json({ ok: true, results });
}