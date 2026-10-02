/**
 * 密码规则的**浏览器侧副本**。
 *
 * 为什么与服务端 lib/auth-security.ts 分开写：
 * 服务端那一份 import 了 node:crypto，直接给客户端组件用会把
 * node 内置模块打进浏览器包。这里只保留两条纯字符串规则，
 * 作用是"提前提示"，服务端仍然是唯一权威 —— 注册接口会再校验一次。
 *
 * 两边的规则必须保持一致，改动时两边都要改。
 */

const WEAK_PASSWORDS = new Set([
  "123456", "password", "123456789", "12345678", "abc123", "111111",
  "1234567", "123123", "qwerty", "000000", "a123456", "88888888",
  "iloveyou", "admin123", "1234", "1q2w3e4r", "123321", "qwerty123",
]);

export interface PasswordCheck {
  ok: boolean;
  error?: string;
}

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

/** 强度档位 0-4，用于注册页的四格进度条 */
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