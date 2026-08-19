import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession, toSessionUser } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "参数错误" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const rows = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }
  await createSession(toSessionUser(user));
  return NextResponse.json({ ok: true, user: { name: user.name, email: user.email } });
}