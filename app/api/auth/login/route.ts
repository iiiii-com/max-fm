import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { createSession, toSessionUser } from "@/lib/auth";
import {
  clientIp,
  fakePasswordCompare,
  normalizeEmail,
  rateLimit,
} from "@/lib/auth-security";

const bodySchema = z.object({
  email: z.string().email("邮箱格式不正确").max(254, "邮箱过长"),
  password: z.string().min(1, "请输入密码").max(128),
  remember: z.boolean().optional(),
});

/** 同一 IP 或同一账号的失败尝试都要限 */
const LIMIT = 8;
const WINDOW = 10 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req);

  const byIp = rateLimit(`login:ip:${ip}`, LIMIT, WINDOW);
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

  // 规范化后再查，否则 A@x.com 与 a@x.com 会变成两个账号
  const email = normalizeEmail(parsed.data.email);
  const { password, remember } = parsed.data;

  const byAccount = rateLimit(`login:acct:${email}`, LIMIT, WINDOW);
  if (!byAccount.ok) {
    return NextResponse.json(
      { error: `尝试过于频繁，请 ${byAccount.retryAfter} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(byAccount.retryAfter) } }
    );
  }

  const rows = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  const user = rows[0];

  // 关键：用户不存在时也要跑一次哈希比对。
  // 此前这里直接 return 401，响应时间的差异可以被用来枚举已注册邮箱。
  if (!user || !user.passwordHash) {
    await fakePasswordCompare();
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  await createSession(toSessionUser(user), { remember: !!remember });
  return NextResponse.json({
    ok: true,
    user: { name: user.name, email: user.email },
  });
}