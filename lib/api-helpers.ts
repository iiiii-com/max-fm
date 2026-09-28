import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import type { User } from "@prisma/client";

/** API 路由守卫：返回 { user, error } 二选一 */
export async function apiAuth(): Promise<
  { user: User; error: null } | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  return { user, error: null };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
