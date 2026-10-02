"use client";

/**
 * 统一的认证请求处理。
 *
 * 做这件事的原因：站内多处直接 `fetch("/api/xxx")`，登录过期时
 * 各自处理 401 的方式不一样 —— 有的弹一句"请先登录"，有的什么都不做，
 * 用户看到的就是按钮点了没反应。这里统一成：401 记下来路并跳登录，
 * 登录成功后再回跳到原来想去的页面。
 */

import { useRouter } from "next/navigation";

export function loginUrlFor(nextPath?: string): string {
  const next =
    nextPath ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * 组件外使用（事件回调、工具函数）：直接改 location。
 * 不用 router 是因为非组件环境拿不到 router 实例。
 */
export function redirectToLogin(nextPath?: string): void {
  if (typeof window !== "undefined") window.location.href = loginUrlFor(nextPath);
}

/** 供 Hook 版本复用：读 JSON、失败抛 AuthError */
export async function readJson<T = any>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}) as any);
  if (!res.ok) {
    const err = new Error(json?.error || `请求失败（${res.status}）`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}

/**
 * 组件内使用：
 *   const api = useAuthFetch();
 *   const data = await api("/api/watchlist", "/watchlist");
 */
export function useAuthFetch() {
  const router = useRouter();

  return async function authFetch(
    input: string,
    nextPath?: string,
    init?: RequestInit
  ): Promise<Response> {
    const res = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (res.status === 401) {
      router.push(loginUrlFor(nextPath));
    }
    return res;
  };
}