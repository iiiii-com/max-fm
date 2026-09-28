import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

/**
 * 自选列表回填。
 *
 * 背景：useWatchlist 把自选存在 **localStorage**，而账号页「我的自选」读的是
 * **DB watchlists 表**，两者从不互通 —— 结果是：在任意行情页加了自选，
 * 登录后到 /account 却永远显示 0 个。
 *
 * /api/watchlist/toggle 早已存在（写入 DB），但 hook 同样没调用它。
 * 本路由提供读侧，配合 toggle 构成完整链路。
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const rows = await db
    .select({ code: s.watchlists.code, name: s.watchlists.name })
    .from(s.watchlists)
    .where(eq(s.watchlists.uid, session.id));
  return NextResponse.json({ ok: true, items: rows });
}
