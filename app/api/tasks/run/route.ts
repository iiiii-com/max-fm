import { NextResponse } from "next/server";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { aiGenerateOrFallback } from "@/lib/ai";
import { getIndicators, getPolicies, getTemperatures } from "@/lib/data/queries";
import { fetchQuotes, fetchSectors } from "@/lib/data/quotes";

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
      qualityScore: "85", status: "published", publishDate: new Date().toISOString().slice(0, 10), createdAt: now(), updated_at: now(),
    } as any);
    return `已生成宏观月报`;
  };

  if (task === "all" || task === "daily") await run("daily-review", dailyReview);
  if (task === "all" || task === "temperature") await run("temperature-report", temperatureReport);
  if (task === "all" || task === "monthly") await run("macro-monthly", macroMonthly);

  return NextResponse.json({ ok: true, results });
}