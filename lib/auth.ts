import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

/**
 * 会话与身份。
 *
 * 这个文件此前有三个会真正出事的问题，改动都围绕它们：
 *
 * 1) SECRET 有硬编码兜底 "max-dev-secret-change-me-in-production"。
 *    任何忘记配环境变量的部署，密钥都是公开已知的常量 ——
 *    攻击者可以自己签一个 {id: "任意用户id", plan: "pro"} 的 JWT，
 *    直接冒充任意账号（含付费状态）。现在生产环境缺配置就启动失败。
 *
 * 2) plan / riskLevel 被写进 JWT 并保留 30 天。
 *    用户升级了套餐、或风控等级变了，他浏览器里的令牌仍是旧值，
 *    授权判断会读到过期的权限。现在令牌里只有身份，权限每次从库里读。
 *
 * 3) 没有"改密码后让旧令牌失效"的能力。sessionVersion 补上这个缺口。
 */

const IS_PROD = process.env.NODE_ENV === "production";

function resolveSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (raw && raw.trim().length >= 32) return new TextEncoder().encode(raw.trim());
  if (IS_PROD) {
    // 不再退回开发默认值：宁可拒绝启动，也不要用公开常量签发令牌。
    throw new Error(
      "AUTH_SECRET 未配置或短于 32 字符。生产环境必须设置随机密钥，例如：openssl rand -base64 48"
    );
  }
  // 开发态允许复用固定值，便于本地免配置启动
  return new TextEncoder().encode("max-dev-only-secret-not-for-production-use");
}

let cachedSecret: Uint8Array | null = null;
function secret(): Uint8Array {
  if (!cachedSecret) cachedSecret = resolveSecret();
  return cachedSecret;
}

export const SESSION_COOKIE = "max_session";

/** 记住登录：30 天；不记住：仅本次浏览会话（关浏览器即失效） */
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE = 60 * 60 * 12;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  provider: string;
  riskLevel: string | null;
  plan: string;
}

/** 令牌里只放身份，不放会变的权限字段 */
interface TokenPayload extends JWTPayload {
  id: string;
  email: string;
  name: string;
  provider: string;
  sv: string; // session version
}

export async function createSession(user: SessionUser, opts?: { remember?: boolean }) {
  const maxAge = opts?.remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  const sv = await currentSessionVersion(user.id);
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    sv,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * 取当前用户。
 *
 * 先验签名，再比对库里的 sessionVersion：
 * 令牌本身没过期但用户已改过密码时，版本对不上，按未登录处理。
 * 权限字段（plan / riskLevel）一律取库里的最新值。
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload: TokenPayload;
  try {
    const verified = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    payload = verified.payload as TokenPayload;
    if (!payload.id) return null;
  } catch {
    return null;
  }

  const row = await getUserFromDb(payload.id);
  if (!row) return null;
  if ((row.sessionVersion ?? "0") !== (payload.sv ?? "0")) return null;

  return toSessionUser(row);
}

async function currentSessionVersion(userId: string): Promise<string> {
  const row = await getUserFromDb(userId);
  return row?.sessionVersion ?? "0";
}

export async function getUserFromDb(id: string) {
  const rows = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  return rows[0] ?? null;
}

/** 改密码或主动登出全部设备时调用，令所有已签发令牌失效 */
export async function bumpSessionVersion(userId: string): Promise<void> {
  const row = await getUserFromDb(userId);
  if (!row) return;
  const next = String(Number(row.sessionVersion ?? "0") + 1);
  await db
    .update(s.users)
    .set({ sessionVersion: next, updatedAt: Date.now() })
    .where(eq(s.users.id, userId));
}

export function toSessionUser(u: typeof s.users.$inferSelect): SessionUser {
  const email = u.email ?? "";
  return {
    id: u.id,
    email,
    name: u.name || email.split("@")[0] || "用户",
    provider: u.provider ?? "",
    riskLevel: u.riskLevel,
    plan: u.plan || "free",
  };
}

/** 供 Server Component 判断：未登录时把用户送回登录页并记住来路 */
export function loginRedirect(nextPath: string): never {
  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}