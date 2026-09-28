import { NextResponse } from "next/server";
import { z } from "zod";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { aiGenerateOrFallback } from "@/lib/ai";
import { getTemperatures, getRecentAggregated, getFeelingAggregates } from "@/lib/data/queries";

const bodySchema = z.object({
  income: z.number(), risk: z.number().min(1).max(5), horizon: z.number().min(1).max(3),
  goal: z.string().max(200).optional(), answers: z.record(z.string(), z.any()).optional(),
});

function riskLevel(risk: number): string {
  if (risk <= 2) return "保守型";
  if (risk === 3) return "稳健型";
  return "进取型";
}

function fallbackReport(input: z.infer<typeof bodySchema>, level: string, macro: { latestGdp: number; latestCpi: number; latestPmi: number; latestM2: number }, temp: number, feeling: { overall: number | null; sampleCount: number }) {
  const stockPct = level === "进取型" ? 60 : level === "稳健型" ? 40 : 20;
  const bondPct = level === "进取型" ? 25 : level === "稳健型" ? 40 : 55;
  return `# 个人资产配置建议报告\n\n## 风险等级：${level}\n\n根据你的问卷回答，当前风险承受能力为 **${level}**。\n\n## 当前宏观环境\n\n- GDP 同比 **${macro.latestGdp}%**，经济温和复苏\n- CPI 同比 **${macro.latestCpi}%**，物价低位运行\n- 制造业 PMI **${macro.latestPmi}**，景气度边际改善\n- M2 同比 **${macro.latestM2}%**，流动性保持宽松\n- 宏观温度计 **${temp}°**（${temp >= 55 ? "偏暖" : temp >= 45 ? "中性" : "偏冷"}）${feeling.overall != null && feeling.sampleCount > 0 ? ` · 大众体感 **${Math.round(feeling.overall)}°**（${feeling.sampleCount} 份问卷均值），温差 ${Math.round(temp - feeling.overall) > 0 ? "+" : ""}${Math.round(temp - feeling.overall)}°` : " · 大众体感：暂无问卷数据，温差暂不可计算"}\n\n## 建议配置\n\n| 资产类别 | 建议比例 | 说明 |\n|---|---|---|\n| 权益类（股票/偏股基金） | ${stockPct}% | 定投为主，关注高股息与政策受益方向 |\n| 固收类（债券/货币基金） | ${bondPct}% | 作为安全垫，锁定基础收益 |\n| 黄金等避险资产 | 10% | 对冲通胀与地缘风险 |\n| 现金/活期 | ${100 - stockPct - bondPct - 10}% | 保持流动性，应对不确定 |\n\n## 操作建议\n\n1. **定投优先**：无论风险等级，建议采用定投方式分批入场，平滑波动。\n2. **关注政策主线**：当前政策聚焦"两新"（设备更新+以旧换新）、AI 产业、新型城镇化，相关方向存在结构性机会。\n3. **控制杠杆**：${level === "进取型" ? "进取型可适度使用杠杆，但总杠杆不超过 1.2 倍，且必须留足保证金缓冲。" : "不建议使用杠杆，保持负债率在安全区间。"}\n4. **定期再平衡**：每季度检查一次配置比例，偏离目标 5 个百分点以上时再平衡。\n\n## 风险提示\n\n本报告由 AI 根据公开数据与问卷自动生成，仅供信息参考，不构成投资建议。市场有风险，投资需谨慎。\n\n*报告生成时间：${new Date().toLocaleDateString("zh-CN")}*`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const input = parsed.data;
  const level = riskLevel(input.risk);
  const [temps, macro, feeling] = await Promise.all([
    getTemperatures(),
    getRecentAggregated(),
    getFeelingAggregates(),
  ]);
  const rawTemp = temps[temps.length - 1]?.temperature;
  // 温度无数据时为 null，不再回退到硬编码 62
  const temp = Number.isFinite(Number(rawTemp)) ? Number(rawTemp) : 0;
  const tempKnown = Number.isFinite(Number(rawTemp));
  const feelingKnown = feeling.overall != null && feeling.sampleCount > 0;
  const diff = tempKnown && feelingKnown ? Math.round(temp - Number(feeling.overall)) : null;
  const fb = fallbackReport(input, level, macro, temp, feeling);

  const tempDesc = tempKnown ? `宏观温度 ${temp}°` : "宏观温度暂无数据";
  const feelDesc = feelingKnown
    ? `大众体感 ${Math.round(Number(feeling.overall))}°（${feeling.sampleCount} 份问卷），温差 ${diff! > 0 ? "+" : ""}${diff}°`
    : "大众体感暂无问卷数据，温差不可计算";
  const prompt = `你是资深理财顾问。用户问卷：收入水平（1-5 档）=${input.income}，风险偏好（1 保守~5 进取）=${input.risk}，投资期限（1 短~3 长）=${input.horizon}，目标=${input.goal || "财富稳健增值"}。当前宏观：GDP ${macro.latestGdp}%、CPI ${macro.latestCpi}%、PMI ${macro.latestPmi}、M2 ${macro.latestM2}%、${tempDesc}、${feelDesc}。请生成一份中文《个人资产配置建议报告》，包含：风险等级结论、宏观环境解读、资产配置比例表、具体操作建议、风险提示。使用 Markdown 格式，500-800 字。只能使用上面给出的数字，不得自行编造或沿用其它来源的数值。`;

  const report = await aiGenerateOrFallback(prompt, fb, { model: "strong", maxTokens: 2048 });

  await db.insert(s.userAdvice).values({
    id: uid("adv"), uid: session.id, answers: JSON.stringify(input),
    riskLevel: level, content: report,
    // 无体温感数据时存 null，而不是拿硬编码 45 去凑一个温差
    temperatureDiff: diff,
    createdAt: now(),
  } as any);

  await db.update(s.users).set({ riskLevel: level, updatedAt: now() }).where(s.users.id === session.id as any);

  return NextResponse.json({ ok: true, report, riskLevel: level });
}