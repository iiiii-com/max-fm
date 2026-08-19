import { NextResponse } from "next/server";
import { z } from "zod";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { getFeelingAggregates } from "@/lib/data/queries";

const bodySchema = z.object({
  income: z.number().min(-2).max(2),
  job: z.number().min(-2).max(2),
  price: z.number().min(-2).max(2),
  housing: z.number().min(-2).max(2),
  consume: z.number().min(-2).max(2),
  ageGroup: z.string(),
  occupation: z.string(),
  region: z.string(),
});

function scoreOf(a: z.infer<typeof bodySchema>) {
  const raw = 50 + (a.income + a.job + a.price + a.housing + a.consume) * 8;
  return Math.max(10, Math.min(90, Math.round(raw)));
}

export async function POST(req: Request) {
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

  const agg = await getFeelingAggregates();
  return NextResponse.json({ ok: true, myScore: score, overall: agg.overall, sampleCount: agg.sampleCount });
}