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

    // 安全：**绝不把完整令牌打进日志**。日志会进 stdout / 日志平台 / start.log，
    // 能读日志的人本来不该有重置任意账号的能力（30 分钟窗口内一条 link 就够了）。
    // 这里只留 uid 与 token 前 6 位，供排障时对齐"是哪一次请求"，不足以还原令牌。
    const masked = `…${token.slice(0, 6)}`;
    if (process.env.AUTH_MAIL_FROM) {
      // 已配置邮件服务：此处是唯一的发信出口。
      // 注意：当前仍以日志形式提示运维代发（未接 SMTP SDK），所以更要把令牌脱敏。
      console.warn(`[auth] 密码重置请求：uid=${user.id}，请通过邮件服务向 ${email} 发送链接（令牌脱敏 ${masked}）`);
    } else {
      console.warn(`[auth] 未配置 AUTH_MAIL_FROM，重置链接无法送达（uid=${user.id}，令牌脱敏 ${masked}）。`);
      console.warn(`[auth] 若需本地自助重置，请用管理员口令或改密流程；不要在此打印明文令牌。`);
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