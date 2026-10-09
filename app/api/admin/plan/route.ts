import { NextResponse } from "next/server";
import { z } from "zod";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { adminGate, PLAN_LABEL } from "@/lib/plan";

export const dynamic = "force-dynamic";

/**
 * 管理员开通/取消专业版。
 *
 * 三条设计：
 *  1) **授权靠白名单而不是角色字段** —— 库里的 plan 只描述"这个用户是不是专业版"，
 *     不能同时用来表达"他是不是管理员"，否则一旦能改自己的 plan 就能顺手提权。
 *     管理员身份只来自环境变量 ADMIN_EMAILS（未配置 = 无人是管理员）。
 *  2) **不碰 sessionVersion** —— plan 每次请求从库里读（见 lib/auth.ts 的说明），
 *     所以改完立即生效，不需要让用户重新登录；反过来，如果这里 bump 了版本，
 *     用户会被莫名踢下线。
 *  3) **留痕** —— 写 task_logs。谁在什么时候把谁开成了专业版，是能对账的事实。
 */
const bodySchema = z.object({
  email: z.string().email().max(254),
  plan: z.enum(["free", "pro"]),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  const gate = adminGate(session);
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "参数错误：需要 email 与 plan（free/pro）" },
      { status: 400 }
    );
  }
  const { email, plan, note } = parsed.data;
  const target = email.trim().toLowerCase();

  const existing = (await db.select().from(s.users).where(eq(s.users.email, target)).limit(1)) as any[];
  if (!existing[0]) {
    return NextResponse.json({ ok: false, error: `用户不存在：${target}` }, { status: 404 });
  }

  const before = existing[0].plan ?? "free";
  if (before === plan) {
    return NextResponse.json({
      ok: true,
      unchanged: true,
      email: target,
      plan,
      message: `该用户已是${PLAN_LABEL[plan]}，无需变更`,
    });
  }

  await db
    .update(s.users)
    .set({ plan, updatedAt: now() })
    .where(eq(s.users.id, existing[0].id));

  // 留痕：与站内其它写操作保持同一张表，便于统一审计
  await db.insert(s.taskLogs).values({
    id: uid("log"),
    taskName: "admin:plan",
    status: "success",
    detail: JSON.stringify({ by: session!.email, target, from: before, to: plan, note: note ?? null }),
    durationMs: 0,
    tokens: 0,
    createdAt: now(),
  } as any);

  return NextResponse.json({
    ok: true,
    email: target,
    from: before,
    to: plan,
    message: `${target}：${PLAN_LABEL[before as "free" | "pro"]} → ${PLAN_LABEL[plan]}`,
    effective: "权限每次请求从库读取，已立即生效，无需用户重新登录",
  });
}

/** 查询当前管理员身份与候选用户（供 /account 面板使用） */
export async function GET() {
  const session = await getSession();
  const gate = adminGate(session);
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const rows = (await db
    .select({ email: s.users.email, name: s.users.name, plan: s.users.plan, createdAt: s.users.createdAt })
    .from(s.users)
    .limit(200)) as Array<{ email: string | null; name: string | null; plan: string | null; createdAt: number | null }>;

  const users = rows
    .filter((r) => r.email)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .map((r) => ({ email: r.email, name: r.name, plan: r.plan ?? "free", createdAt: r.createdAt }));

  return NextResponse.json({
    ok: true,
    admin: session!.email,
    counts: { total: users.length, pro: users.filter((u) => u.plan === "pro").length },
    users,
  });
}