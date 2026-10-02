import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/** 当前登录状态。供客户端避免"已登录还显示登录按钮"。 */
export async function GET() {
  const u = await getSession();
  if (!u) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    user: { id: u.id, name: u.name, email: u.email, plan: u.plan },
  });
}