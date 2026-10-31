import { NextResponse } from "next/server";
import { hasAI } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/auth-security";
import {
  currentYm,
  monthLabel,
  getMonthlyArticle,
  getMonthlyArticles,
  generateMonthlyReport,
} from "@/lib/data/monthly-report";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * AI 月报状态 / 生成接口。
 *
 * GET  → 当月是否已有月报 + 历史月报列表（页面首次渲染用它决定展示什么）
 * POST → 幂等生成当月月报：已存在则原样返回（不调 AI、不烧 token）；
 *        缺失才真正生成。这样「每月 1 日自动更新」有两条保障：
 *        定时任务（daily task=all 内含 monthly） + 用户访问时的兜底生成。
 */
export async function GET() {
  await bootstrap();
  const ym = currentYm();
  const [article, history] = await Promise.all([getMonthlyArticle(ym), getMonthlyArticles(12)]);
  return NextResponse.json({
    ok: true,
    ym,
    monthLabel: monthLabel(ym),
    hasAI: hasAI(),
    article: article
      ? {
          slug: article.slug,
          title: article.title,
          summary: article.summary ?? null,
          publishDate: article.publishDate ?? null,
          updatedAt: article.updatedAt ?? null,
          sourceModel: article.sourceModel ?? null,
        }
      : null,
    history: history.map((h) => ({
      slug: h.slug,
      ym: h.ym,
      title: h.title,
      summary: h.summary,
      publishDate: h.publishDate,
      sourceModel: h.sourceModel,
    })),
  });
}

export async function POST(req: Request) {
  await bootstrap();
  // 安全（A8）：POST 在缺失当月月报时会触发 AI 生成（消耗 token），原先是匿名无限调用。
  // 这里做轻量限频：单 IP 每小时 3 次 —— 正常页面兜底生成只会在月初发生 1 次。
  const ip = clientIp(req);
  const rl = rateLimit(`macro-monthly:${ip}`, 3, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "生成请求过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  try {
    const result = await generateMonthlyReport({ force: false });
    return NextResponse.json({
      ok: true,
      ym: result.ym,
      monthLabel: monthLabel(result.ym),
      created: result.created,
      updated: result.updated,
      usedAI: result.usedAI,
      message: result.message,
      article: result.article,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `月报生成失败：${e?.message ?? "未知错误"}` },
      { status: 500 },
    );
  }
}
