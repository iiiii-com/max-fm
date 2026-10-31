import { NextResponse } from "next/server";
import { db, isPg, raw, bootstrap } from "@/lib/db";

/**
 * 生产环境诊断端点（临时）。
 *
 * 背景：线上大量「bootstrap 页面」渲染时报 React #441（服务端组件抛错），
 * 但本地 SQLite 全绿。生产用 Neon Postgres，怀疑是数据库连接/初始化失败，
 * 而 Vercel 函数日志在当前环境不可读，故加这个只读探针把「哪一步失败、报什么错」
 * 带回来。为降低泄露面：
 *   1) 需要 ?k=<token>，否则一律 404；
 *   2) 错误信息只保留首行并做脱敏（去掉 URL 里的凭据、主机名、IP、长串哈希）；
 *   3) 只读查询，不写库。
 * 诊断完成后应删除本文件。
 */
const DIAG_TOKEN = "k7p2x9qz-d41d8cd9";

function sanitize(input: unknown): string {
  let s = typeof input === "string" ? input : String(input ?? "");
  s = s.split("\n")[0];
  s = s.replace(/\/\/[^@\s]*@/g, "//***@");
  s = s.replace(/\b[a-z0-9.-]+\.(neon\.tech|vercel\.app|amazonaws\.com|supabase\.co|render\.com)\b/gi, "<host>");
  s = s.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>");
  s = s.replace(/\b[A-Za-z0-9_-]{28,}\b/g, "<token>");
  return s.slice(0, 300);
}

async function queryOne(sql: string): Promise<Record<string, any> | null> {
  if (isPg) {
    const { rows } = await (raw as any).query(sql);
    return rows?.[0] ?? null;
  }
  // SQLite（better-sqlite3）没有 .query()，走 prepare().get()
  return (raw as any).prepare(sql).get() ?? null;
}

async function step<T>(fn: () => Promise<T>): Promise<{ ok: boolean; value?: T; error?: { name: string; message: string } }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e: any) {
    return { ok: false, error: { name: sanitize(e?.name ?? "Error"), message: sanitize(e?.message ?? e) } };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("k") !== DIAG_TOKEN) {
    return new NextResponse("not found", { status: 404 });
  }

  const out: Record<string, unknown> = {
    runtime: {
      isPg,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      dbUrlScheme: process.env.DATABASE_URL ? process.env.DATABASE_URL.split(":")[0] : null,
      nodeEnv: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION ?? null,
      vercel: !!process.env.VERCEL,
    },
  };

  out.bootstrap = await step(async () => {
    await bootstrap();
    return "ok";
  });

  out.select1 = await step(async () => {
    const row = await queryOne("select 1 as one");
    return row?.one ?? null;
  });

  const counts: Record<string, unknown> = {};
  for (const table of ["economic_indicators", "policies", "articles", "industry_chains", "chain_nodes", "market_snapshots", "users"]) {
    counts[table] = await step(async () => {
      const row = await queryOne(`select count(*) as c from ${table}`);
      return row?.c != null ? Number(row.c) : null;
    });
  }
  out.counts = counts;

  out.loaders = {
    getPolicies: await step(async () => {
      const { getPolicies } = await import("@/lib/data/queries");
      return (await getPolicies()).length;
    }),
    getIndicators: await step(async () => {
      const { getIndicators } = await import("@/lib/data/queries");
      return (await getIndicators()).length;
    }),
    dbSelectPolicies: await step(async () => {
      const { policies } = await import("@/lib/db/schema");
      const rows = await (db as any).select({ id: policies.id }).from(policies).limit(1);
      return rows.length;
    }),
  };

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
