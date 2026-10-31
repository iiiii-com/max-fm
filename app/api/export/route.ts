import { NextResponse } from "next/server";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { proGate } from "@/lib/plan";
import { toCsv, contentDisposition } from "@/lib/data/csv";

export const dynamic = "force-dynamic";

/**
 * 通用数据导出（CSV）。
 *
 * 历史缺陷（已修）：
 *  1) 该接口原本完全无鉴权 —— 匿名 GET 就能把 8 张业务表整表拉走，其中
 *     `industry_chains` / `chain_nodes` 正是**专业版**「产业链指数/多链对比」的底层数据，
 *     等于把付费分层绕过了（同仓库 app/api/pro/export/route.ts 走的是 proGate("export")）。
 *     现在：必须登录；产业研究两张表额外要求专业版门禁。
 *  2) CSV 只用 JSON.stringify 拼字段，不转义、不挡公式注入。`feeling_aggregates.bucket`
 *     里就是用户匿名提交的原文，写个 `=1+1` 就能让下载文件在 Excel 里执行公式
 *     （同仓库 pro 导出用的 lib/data/csv.ts 已有防护，这里直接复用，不再各写一套）。
 *  3) POST 手动触发无鉴权，谁都能反复写 task_logs。现在与 /api/tasks/run 一致：
 *     只认 `Authorization: Bearer $CRON_SECRET`，未配置则 fail-closed。
 */

const ALLOWED = new Set([
  "economic_indicators", "province_stats", "policies", "articles",
  "industry_chains", "chain_nodes", "feeling_aggregates", "macro_temperature",
]);

/** 属于专业版能力（产业链指数/多链对比）的底层表，导出需要专业版 */
const PRO_TABLES = new Set(["industry_chains", "chain_nodes"]);

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "请先登录后再导出" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table") || "economic_indicators";
  if (!ALLOWED.has(table)) {
    return NextResponse.json({ ok: false, error: "invalid table" }, { status: 400 });
  }
  if (PRO_TABLES.has(table)) {
    const gate = proGate(session, "chain-index");
    if (gate) return NextResponse.json(gate.body, { status: gate.status });
  }

  const map: Record<string, any> = {
    economic_indicators: s.economicIndicators,
    province_stats: s.provinceStats,
    policies: s.policies,
    articles: s.articles,
    industry_chains: s.industryChains,
    chain_nodes: s.chainNodes,
    feeling_aggregates: s.feelingAggregates,
    macro_temperature: s.macroTemperatures,
  };
  const rows = (await db.select().from(map[table]).limit(5000)) as Array<Record<string, unknown>>;
  if (!rows.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 404 });

  // id/uid 属内部标识，不导出
  const headers = Object.keys(rows[0]).filter((k) => !["id", "uid"].includes(k));
  const csv = toCsv(
    [
      `表：${table}`,
      `导出时间：${new Date().toISOString()}`,
      `行数：${rows.length}`,
      `来源：${process.env.NEXT_PUBLIC_SITE_URL ?? "max-site"} /api/export`,
    ],
    headers,
    rows.map((r) => headers.map((h) => r[h]))
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(`${table}-${stamp}.csv`, `${table}-${stamp}.csv`),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET 未配置；为避免任务被任意触发，已拒绝无鉴权请求" },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const log = async (taskName: string, status: string, detail: string, tokens = 0) => {
    await db.insert(s.taskLogs).values({ id: uid("log"), taskName: taskName, status, detail, durationMs: Date.now() - t0, tokens, createdAt: now() } as any);
  };
  await log("manual-run", "success", "手动触发完成（数据管道占位：正式抓取任务见 Vercel Cron）");
  return NextResponse.json({ ok: true });
}