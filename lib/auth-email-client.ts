/** 邮箱规范化的浏览器侧副本（与服务端 lib/auth-security.ts 保持一致） */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}