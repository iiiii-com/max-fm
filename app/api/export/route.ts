import { NextResponse } from "next/server";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const table = searchParams.get("table") || "economic_indicators";
  const allowed = new Set([
    "economic_indicators", "province_stats", "policies", "articles",
    "industry_chains", "chain_nodes", "feeling_aggregates", "macro_temperature",
  ]);
  if (!allowed.has(table)) {
    return NextResponse.json({ error: "invalid table" }, { status: 400 });
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
  const rows = await db.select().from(map[table]).limit(5000);
  if (!rows.length) return NextResponse.json({ error: "empty" }, { status: 404 });

  const headers = Object.keys(rows[0]).filter((k: any) => !["id", "uid"].includes(k));
  const csv = [
    headers.join(","),
    ...rows.map((r: any) => headers.map((h: any) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");

  const filename = `${table}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST() {
  const t0 = Date.now();
  const log = async (taskName: string, status: string, detail: string, tokens = 0) => {
    await db.insert(s.taskLogs).values({ id: uid("log"), taskName: taskName, status, detail, durationMs: Date.now() - t0, tokens, createdAt: now() } as any);
  };
  await log("manual-run", "success", "手动触发完成（数据管道占位：正式抓取任务见 Vercel Cron）");
  return NextResponse.json({ ok: true });
}