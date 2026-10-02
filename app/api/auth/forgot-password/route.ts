import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import {
  NEUTRAL_AUTH_MESSAGE,
  clientIp,
  fakePasswordCompare,
  normalizeEmail,
  rateLimit,
  sha256,
} from "@/lib/auth-security";

const bodySchema = z.object({
  email: z.string().email("邮箱格式不正确").max(254),
});

const LIMIT = 3;
const WINDOW = 60 * 60 * 1000;

/** 重置令牌有效期：30 分钟 */
const RESET_TTL = 30 * 60 * 1000;

/**
 * 忘记密码 —— 生成重置令牌。
 *
 * 两个刻意的设计：
 *
 * 1) 无论邮箱是否存在，返回完全相同的一句话。否则这个接口就成了
 *    「查某邮箱是否注册」的工具，可被用来批量枚举账号。
 *
 * 2) 库里存的是令牌的 SHA-256，不是令牌本身。数据库被读走也无法
 *    直接拿去重置别人的密码（明文令牌只在生成那一刻出现一次）。
 *
 * 发信尚未接入：未配置 AUTH_MAIL_FROM 时只把链接写到服务端日志，
 * 且**绝不返回给前端** —— 返回它等于让任何能提交邮箱的人重置该账号。
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const byIp = rateLimit(`forgot:ip:${ip}`, LIMIT, WINDOW);
  if (!byIp.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${byIp.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(byIp.retryAfter) } }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const rows = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  const user = rows[0];

  if (user) {
    const token = randomToken();
    const expiresAt = Date.now() + RESET_TTL;

    // 该用户此前的令牌全部作废，保证同一时间只有一个有效链接
    await db.delete(s.passwordResets).where(eq(s.passwordResets.uid, user.id));

    await db.insert(s.passwordResets).values({
      id: uid("pr"),
      uid: user.id,
      email,
      tokenHash: sha256(token),
      expiresAt,
      createdAt: now(),
    } as any);

    const link = new URL(`/reset-password?token=${token}`, req.url).toString();
    if (process.env.AUTH_MAIL_FROM) {
      // 已配置邮件服务：此处是唯一的发信出口
      console.warn(`[auth] 请向 ${email} 发送密码重置链接：${link}`);
    } else {
      console.warn(`[auth] 未配置 AUTH_MAIL_FROM，重置链接仅写入日志（${email}）：${link}`);
    }
  } else {
    // 邮箱不存在时也走一次哈希，让两条路径耗时接近
    await fakePasswordCompare();
  }

  return NextResponse.json({ ok: true, message: NEUTRAL_AUTH_MESSAGE });
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}