import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession, toSessionUser } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
  name: z.string().min(1, "请输入昵称").max(20, "昵称最长 20 字").optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "参数错误" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const existing = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: uid("u"), email, passwordHash: hash,
    name: name || email.split("@")[0], provider: "credentials",
    riskLevel: null, interests: null, plan: "free",
    createdAt: now(), updatedAt: now(),
  };
  await db.insert(s.users).values(user as any);
  await createSession(toSessionUser(user as any));
  return NextResponse.json({ ok: true, user: { name: user.name, email } });
}