import { NextResponse } from "next/server";
import { z } from "zod";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { aiGenerate, hasAI } from "@/lib/ai";
import { getPolicyWithAnalysis } from "@/lib/data/queries";
import { VALID_INDICATOR_NAMES } from "@/lib/data/macro-indicators";

export const dynamic = "force-dynamic";

/**
 * 政策三层解读（按需生成 + 持久化）
 *
 * 修复的历史问题：
 * 1. 列表页宣称「三层 AI 解读」，但**全站没有任何生成该解读的接口**，
 *    详情页只有一句永不变化的「分析生成中」。本路由补上这条链路。
 * 2. 旧 cron 任务在无 AI Key 时写入**通用模板**兜底：无论什么政策都断言
 *    「旨在稳定预期、畅通循环」「长期利好经济修复」「存在结构性机会」，
 *    并把 GDP/CPI/PMI 硬编码成「关联指标」。
 *    这类与政策内容无关的结论会被读者当成真实解读，故本路由**不产出兜底结论**：
 *    没有 AI 就明确返回不可用，让前端显示「未生成」。
 * 3. dataLinks 只接受站内指标表中真实存在的指标名，AI 给出的名字必须对得上，
 *    对不上就丢弃，避免出现不存在的「关联指标」。
 */

const bodySchema = z.object({ id: z.string().min(1) }).optional();

/** 校验 AI 返回的关联指标名，只保留站内指标表里真实存在的那些 */
function validateDataLinks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(VALID_INDICATOR_NAMES);
  const out: string[] = [];
  for (const x of raw) {
    const name = String(x ?? "").trim();
    if (!name) continue;
    if (valid.has(name)) {
      out.push(name);
      continue;
    }
    // 允许 AI 给出「10年期国债收益率」这类带修饰的写法，尝试去掉前缀后匹配
    const stripped = name.replace(/^(最新|当期|中国|全国|本月)\s*/, "");
    if (valid.has(stripped)) out.push(stripped);
  }
  return [...new Set(out)].slice(0, 8);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let id = "";
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (parsed.success && parsed.data?.id) id = parsed.data.id;
  } catch {
    /* ignore */
  }
  if (!id) id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "缺少政策 id" }, { status: 400 });

  const row = await getPolicyWithAnalysis(id);
  if (!row?.policy) return NextResponse.json({ error: "政策不存在" }, { status: 404 });
  const p = row.policy as any;
  const existing = row.analysis as any;

  // 已生成过就直接返回，不重复消耗额度
  if (existing?.popular && existing?.professional) {
    return NextResponse.json({
      ok: true,
      cached: true,
      analysis: {
        popular: existing.popular,
        professional: existing.professional,
        detail: existing.detail ?? null,
        dataLinks: existing.dataLinks ?? null,
      },
    });
  }

  if (!hasAI()) {
    // 明确告知不可用，而不是用通用模板冒充解读
    return NextResponse.json(
      {
        ok: false,
        error: "AI 解读服务未配置（缺少 AI_API_KEY）",
        code: "AI_UNAVAILABLE",
        hint: "本站不提供模板兜底的「解读」——通用模板与政策内容无关，会造成误导。请配置 AI 服务后重试。",
      },
      { status: 503 }
    );
  }

  // 原文截断：避免超长 prompt；保留标题、机构、摘要、分类与原文前段
  const body = String(p.content ?? "").slice(0, 4000);

  const prompt = `你是宏观政策分析师。请针对下面这份**真实政策原文**生成三层解读，严格输出 JSON，不要输出任何额外文字：
{"popular":"普通人视角解读(Markdown,150-250字)","professional":"专业机构视角解读(Markdown,250-400字)","detail":"趋势判断与风险提示(Markdown,150-250字)","dataLinks":["关联指标名数组"]}

硬性要求：
1. 只能依据下面给出的政策标题、机构、摘要、分类与原文作答，**不得假设政策意图、不得编造未在原文出现的数字或结论**。
2. 若原文与投资影响关联很弱（如 pure 行政/人事/程序性文件），就如实说明「该文件以…为主，对市场影响有限」，不要强行拔高。
3. dataLinks 只能从下列指标名中选取确实相关的（可为空数组）：${VALID_INDICATOR_NAMES.slice(0, 60).join("、")}

政策标题：${p.title}
发布机构：${p.department || "—"}
分类：${p.category || "—"}
发布时间：${p.publishDate || "—"}
摘要：${p.summary || "—"}
原文（截断）：${body}`;

  let out: string;
  try {
    out = await aiGenerate(prompt, { model: "strong", maxTokens: 2000, temperature: 0.3 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `AI 生成失败：${e?.message ?? "未知错误"}`, code: "AI_FAILED" },
      { status: 502 }
    );
  }

  // 解析 AI 返回的 JSON（容忍 ```json 包裹与前后噪声）
  let parsed: any = null;
  try {
    const cleaned = out.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = start >= 0 && end > start ? JSON.parse(cleaned.slice(start, end + 1)) : null;
  } catch {
    parsed = null;
  }
  const popular = String(parsed?.popular ?? "").trim();
  const professional = String(parsed?.professional ?? "").trim();
  const detail = String(parsed?.detail ?? "").trim();
  if (!popular || !professional) {
    return NextResponse.json(
      { ok: false, error: "AI 返回内容无法解析为三层解读", code: "AI_PARSE_FAILED", raw: out.slice(0, 500) },
      { status: 502 }
    );
  }
  const dataLinks = JSON.stringify(validateDataLinks(parsed?.dataLinks));

  if (existing) {
    await db
      .update(s.policyAnalyses)
      .set({ popular, professional, detail, dataLinks, sourceModel: "ai", updatedAt: now() })
      .where(eq(s.policyAnalyses.id, existing.id));
  } else {
    await db.insert(s.policyAnalyses).values({
      id: uid("pana"),
      uid: id,
      popular,
      professional,
      detail,
      dataLinks,
      sourceModel: "ai",
      qualityScore: null,
      createdAt: now(),
      updatedAt: now(),
    } as any);
  }

  return NextResponse.json({ ok: true, cached: false, analysis: { popular, professional, detail, dataLinks } });
}

/** 查询某政策的解读状态（供前端轮询） */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const row = await getPolicyWithAnalysis(id);
  if (!row?.policy) return NextResponse.json({ error: "政策不存在" }, { status: 404 });
  const a = row.analysis as any;
  return NextResponse.json({
    ok: true,
    status: a?.popular && a?.professional ? "ready" : "missing",
    aiAvailable: hasAI(),
    analysis: a
      ? { popular: a.popular, professional: a.professional, detail: a.detail ?? null, dataLinks: a.dataLinks ?? null }
      : null,
  });
}
