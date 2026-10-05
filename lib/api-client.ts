/**
 * 客户端取数：会话失效时中间件会把 /api/* 重定向到 /login（返回 HTML），
 * 这里统一识别这种情况并跳回登录页，避免页面悄悄显示空数据。
 */
export async function apiGet<T>(url: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (typeof window !== "undefined") {
      const from = window.location.pathname;
      window.location.replace(
        `/login?from=${encodeURIComponent(from)}`
      );
    }
    return null;
  }

  return res.json().catch(() => null);
}
