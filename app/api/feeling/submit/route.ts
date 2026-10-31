import { NextResponse } from "next/server";
import { z } from "zod";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { recomputeFeelingAggregates } from "@/lib/data/feeling";
import { invalidateDataCache } from "@/lib/data/cache";
import { rateLimit, clientIp } from "@/lib/auth-security";

/* 字段长度必须设上限：这些值会原样写进 feeling_aggregates.bucket 并被导出成 CSV、
   也会进 AI 报告 prompt —— 匿名请求不该能决定长度（原来是无 max 的 z.string()）。 */
const bodySchema = z.object({
  income: z.number().min(-2).max(2),
  job: z.number().min(-2).max(2),
  price: z.number().min(-2).max(2),
  housing: z.number().min(-2).max(2),
  consume: z.number().min(-2).max(2),
  ageGroup: z.string().max(32),
  occupation: z.string().max(32),
  region: z.string().max(32),
});

function scoreOf(a: z.infer<typeof bodySchema>) {
  const raw = 50 + (a.income + a.job + a.price + a.housing + a.consume) * 8;
  return Math.max(10, Math.min(90, Math.round(raw)));
}

export async function POST(req: Request) {
  // 匿名可提交 + 每次提交都会触发一次全表聚合 → 必须有频次上限，
  // 否则批量灌票既能拖慢实例、又会操纵「大众体感」（该值直接进 AI 报告）。
  const ip = clientIp(req);
  const limited = rateLimit(`feeling:${ip}`, 6, 10 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "提交过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const session = await getSession();
  const score = scoreOf(parsed.data);
  await db.insert(s.feelingSurveys).values({
    id: uid("fs"), uid: session?.id ?? null,
    answers: JSON.stringify(parsed.data),
    score,
    ageGroup: parsed.data.ageGroup, occupation: parsed.data.occupation, region: parsed.data.region,
    createdAt: now(),
  } as any);

  // 聚合是派生数据：每来一份新问卷就重算一次整体/分桶均值，
  // 否则页面上的「大众体感」会永远停在 seed 的静态数字上。
  const agg = await recomputeFeelingAggregates();
  // 聚合结果刚落库，清掉读缓存让首页/宏观页立即看到新的体感温度
  invalidateDataCache("feeling:");
  return NextResponse.json({
    ok: true,
    myScore: score,
    overall: agg.avg,
    sampleCount: agg.count,
  });
}