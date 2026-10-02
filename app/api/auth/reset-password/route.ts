import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { bumpSessionVersion, createSession, destroySession } from "@/lib/auth";
import {
  checkPassword,
  clientIp,
  fakePasswordCompare,
  rateLimit,
  safeEqual,
  sha256,
} from "@/lib/auth-security";

const bodySchema = z.object({
  token: z.string().min(32, "重置链接无效").max(128),
  password: z.string().min(1, "请输入新密码").max(128),
});

const BCRYPT_ROUNDS = 12;
const LIMIT = 10;
const WINDOW = 15 * 60 * 1000;

/**
 * 用重置令牌设置新密码。
 *
 * 校验链：令牌存在 → 未过期 → 哈希匹配 → 用户仍在。
 * 任一环节失败都返回同一句话，不告诉调用方是哪一步出的问题。
 *
 * 成功后做三件事：令牌作废、sessionVersion +1（让所有旧令牌失效）、
 * 重新签发新会话（用户不用再手动登录一次）。
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const byIp = rateLimit(`reset:ip:${ip}`, LIMIT, WINDOW);
  if (!byIp.ok) {
    return NextResponse.json(
      { error: `尝试过于频繁，请 ${byIp.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(byIp.retryAfter) } }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "参数错误" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  const pw = checkPassword(password);
  if (!pw.ok) {
    return NextResponse.json({ error: pw.error }, { status: 400 });
  }

  const tokenHash = sha256(token);
  const rows = await db
    .select()
    .from(s.passwordResets)
    .where(
      and(eq(s.passwordResets.tokenHash, tokenHash), gt(s.passwordResets.expiresAt, Date.now()))
    )
    .limit(1);
  const record = rows[0];

  const INVALID = "重置链接无效或已过期，请重新申请";

  if (!record || !safeEqual(record.tokenHash ?? "", tokenHash)) {
    await fakePasswordCompare();
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  const users = await db.select().from(s.users).where(eq(s.users.id, record.uid!)).limit(1);
  const user = users[0];
  if (!user) {
    await db.delete(s.passwordResets).where(eq(s.passwordResets.id, record.id));
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await db
    .update(s.users)
    .set({ passwordHash: hash, updatedAt: now() })
    .where(eq(s.users.id, user.id));

  // 令牌一次性：无论后续哪一步出错都不该留可用令牌
  await db.delete(s.passwordResets).where(eq(s.passwordResets.id, record.id));

  // 让此前所有设备上的会话立即失效
  await bumpSessionVersion(user.id);

  await createSession(
    { id: user.id, email: user.email ?? "", name: user.name ?? "", provider: user.provider ?? "", riskLevel: user.riskLevel, plan: user.plan ?? "free" },
    { remember: true }
  );

  return NextResponse.json({ ok: true });
}

/** 放弃重置时清掉当前令牌（用户点"我不需要了"） */
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}