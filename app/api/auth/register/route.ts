import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, isDbDegraded, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { createSession, toSessionUser } from "@/lib/auth";
import {
  checkPassword,
  clientIp,
  fakePasswordCompare,
  normalizeEmail,
  rateLimit,
} from "@/lib/auth-security";
import { apiError, guardAuthFailure } from "@/lib/api-json";

const bodySchema = z.object({
  email: z.string().email("邮箱格式不正确").max(254, "邮箱过长"),
  password: z.string().min(1, "请输入密码").max(128),
  name: z.string().trim().min(1, "请输入昵称").max(20, "昵称最长 20 字").optional(),
  remember: z.boolean().optional(),
});

// bcrypt 成本：10 是默认值。这里用 12 —— 用户登录是低频高价值操作，
// 计算成本提高换的是抗离线爆破能力，代价只是登录慢几十毫秒。
const BCRYPT_ROUNDS = 12;

// 注册限频比登录更紧：批量注册是脚本刷号的主要入口。
const LIMIT = 5;
const WINDOW = 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const byIp = rateLimit(`register:ip:${ip}`, LIMIT, WINDOW);
    if (!byIp.ok) {
      return NextResponse.json(
        { error: `注册过于频繁，请 ${byIp.retryAfter} 秒后再试` },
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

    const email = normalizeEmail(parsed.data.email);
    const { password, name, remember } = parsed.data;

    const pw = checkPassword(password);
    if (!pw.ok) {
      return NextResponse.json({ error: pw.error }, { status: 400 });
    }

    const existing = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
    if (!existing[0] && isDbDegraded()) {
      // 同为降级场景：此时读结果不可信，不能把「查不到」当成「可以注册」，
      // 更不能算完 bcrypt 再让 insert 抛错给用户看 500。
      return apiError(
        503,
        "账号服务暂时不可用（数据库连接或配额异常），暂时无法注册，请稍后重试。"
      );
    }
    if (existing[0]) {
      // 这条文案本身会泄露"该邮箱已注册"，但注册场景下这是必要的用户体验
      // （否则用户会反复尝试）。真正的防线是登录接口的恒定时间比对。
      return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = {
      id: uid("u"),
      email,
      passwordHash: hash,
      name: name || email.split("@")[0],
      provider: "credentials",
      riskLevel: null,
      interests: null,
      plan: "free",
      sessionVersion: "0",
      createdAt: now(),
      updatedAt: now(),
    };
    await db.insert(s.users).values(user as any);

    // 占位保持耗时一致，避免"注册成功"比"邮箱已存在"快得多
    void fakePasswordCompare().catch(() => {});

    await createSession(toSessionUser(user as any), { remember: !!remember });
    return NextResponse.json({ ok: true, user: { name: user.name, email } });
  } catch (err) {
    // 唯一索引兜底：两个请求同时通过上面的 SELECT 检查时，插入会撞唯一约束。
    // 这不是服务故障，应当告诉用户"该邮箱已注册"，而不是 500。
    const msg = String((err as any)?.message ?? err);
    if (/duplicate key|UNIQUE constraint failed|users_email/i.test(msg)) {
      return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
    }
    // 其余异常（数据库配额超限/连接失败等）统一转成带 JSON body 的 503/500，
    // 否则 Next 在生产环境返回空响应体，前端 res.json() 会抛
    // "Unexpected end of JSON input"（线上实际发生过的报错）。
    return guardAuthFailure("auth/register", err);
  }
}
