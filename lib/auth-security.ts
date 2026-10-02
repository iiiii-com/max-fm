/**
 * 认证相关的安全工具：限频、输入规范化、密码强度、恒定时间比对。
 *
 * 单独成文件是因为这些规则需要在登录、注册、找回密码、改密码四条路径上
 * 保持一致 —— 分散写在各 route 里迟早会漏掉某一条。
 */
import { createHash, timingSafeEqual } from "node:crypto";

/* ── 限频 ──────────────────────────────────────────────────────────
 * 为什么先做进程内 Map 而不落库：这个服务是单实例部署，
 * 进程内计数已经能挡住爆破和脚本批量注册。
 * 若将来多实例部署，把下面的 store 换成 Redis 即可，接口不变。
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** 定期清掉过期桶，避免长时间运行后 Map 无限增长 */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export interface RateResult {
  ok: boolean;
  retryAfter: number;
}

/**
 * 固定窗口计数。
 * @param key   通常是 `动作:标识`，例如 "login:1.2.3.4"
 * @param limit 窗口内允许次数
 * @param windowMs 窗口长度
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/* ── 邮箱规范化 ────────────────────────────────────────────────────
 * 注册时不做规范化，就会出现 A@x.com 与 a@x.com 两个账号、
 * 外加首尾空格导致登录失败这类难查的问题。存和查都用同一个规范形。
 */

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/* ── 密码强度 ─────────────────────────────────────────────────────── */

const WEAK_PASSWORDS = new Set([
  "123456", "password", "123456789", "12345678", "abc123", "111111",
  "1234567", "123123", "qwerty", "000000", "a123456", "88888888",
  "iloveyou", "admin123", "1234", "1q2w3e4r", "123321", "qwerty123",
]);

export interface PasswordCheck {
  ok: boolean;
  error?: string;
}

/**
 * 只要求长度与常见模式，不做过度复杂的强制规则 ——
 * 复杂度要求越高，用户越倾向写 "Password1!" 这类可预测的密码。
 */
export function checkPassword(pw: string): PasswordCheck {
  if (typeof pw !== "string" || pw.length < 8) return { ok: false, error: "密码至少 8 位" };
  if (pw.length > 128) return { ok: false, error: "密码过长" };
  if (WEAK_PASSWORDS.has(pw.toLowerCase())) return { ok: false, error: "这个密码过于常见，请换一个" };
  if (/^(.)\1+$/.test(pw)) return { ok: false, error: "密码不能是同一个字符重复" };
  if (/^012345|123456|abcdef|qwerty/i.test(pw)) return { ok: false, error: "密码过于简单，请换一个" };
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, error: "密码需同时包含字母和数字" };
  }
  return { ok: true };
}

/** 给前端做实时强度提示用的档位 */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
  if (WEAK_PASSWORDS.has(pw.toLowerCase())) return 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

/* ── 恒定时间比对 ───────────────────────────────────────────────────
 * 登录接口此前在"用户不存在"时直接返回、不执行 bcrypt.compare，
 * 于是响应时间可以区分邮箱是否已注册（用于批量枚举账号）。
 * 无论用户是否存在都跑一次哈希比对，耗时才对得上。
 */

/**
 * 用户不存在时拿它比对，让两条路径耗时接近。
 *
 * 成本因子必须与注册时的 BCRYPT_ROUNDS（12）一致。
 * 这里曾用一段 rounds=10 的现成哈希，结果"邮箱存在"比"邮箱不存在"
 * 多花约 160ms —— 恰好把想隐藏的信息又漏了出去。
 */
const DUMMY_HASH = "$2b$12$yVVAn2edcC2cv9MoMvjYaOzdkYiIODhetPW5q3112bUQAt81DSgw2";

export async function fakePasswordCompare(): Promise<void> {
  const { default: bcrypt } = await import("bcryptjs");
  await bcrypt.compare("timing-equalizer", DUMMY_HASH);
}

/* ── 通用错误文案 ───────────────────────────────────────────────────
 * 找回密码接口无论邮箱是否存在都返回同一句话，
 * 否则就变成了"查邮箱是否注册过"的接口。
 */

export const NEUTRAL_AUTH_MESSAGE = "如果该邮箱已注册，重置链接已生成";

/* ── 令牌哈希 ───────────────────────────────────────────────────────
 * 重置令牌只存哈希：数据库被读走也无法直接拿去重置他人密码。
 */

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** 定长比较，避免令牌校验被时序侧信道区分 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}