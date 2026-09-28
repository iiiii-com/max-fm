import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** 页面组件用：未登录直接跳转登录页 */
export async function requireUser() {
  const session = await getSession();
  const user = session
    ? await db.user.findUnique({ where: { id: session.userId } })
    : null;
  if (!user) redirect("/login");
  return user;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({ where: { id: session.userId } });
}
