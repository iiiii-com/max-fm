import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { bumpSessionVersion, createSession, getSession } from "@/lib/auth";
import { checkPassword, clientIp, fakePasswordCompare, rateLimit } from "@/lib/auth-security";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码").max(128),
  newPassword: z.string().min(1, "请输入新密码").max(128),
});

const BCRYPT_ROUNDS = 12;
const LIMIT = 6;
const WINDOW = 15 * 60 * 1000;

/**
 * 修改密码（需登录）。
 *
 * 必须校验当前密码 —— 只凭会话令牌就允许改密码，等于把"拿到 cookie"
 * 变成"永久接管账号"，XSS 的后果会被放大到不可撤销。
 *
 * 成功后 sessionVersion +1，所有其他设备的会话失效，
 * 但当前设备重新签发新会话，用户不会被自己踢下线。
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const ip = clientIp(req);
  const byIp = rateLimit(`chpwd:ip:${ip}`, LIMIT, WINDOW);
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

  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 });
  }

  const pw = checkPassword(newPassword);
  if (!pw.ok) {
    return NextResponse.json({ error: pw.error }, { status: 400 });
  }

  const rows = await db.select().from(s.users).where(eq(s.users.id, session.id)).limit(1);
  const user = rows[0];
  if (!user || !user.passwordHash) {
    await fakePasswordCompare();
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db
    .update(s.users)
    .set({ passwordHash: hash, updatedAt: now() })
    .where(eq(s.users.id, user.id));

  // 其他设备全部下线；当前设备随后重新签发
  await bumpSessionVersion(user.id);
  await createSession(
    {
      id: user.id,
      email: user.email ?? "",
      name: user.name ?? "",
      provider: user.provider ?? "",
      riskLevel: user.riskLevel,
      plan: user.plan ?? "free",
    },
    { remember: true }
  );

  return NextResponse.json({ ok: true, message: "密码已更新，其他设备的登录状态已失效" });
}