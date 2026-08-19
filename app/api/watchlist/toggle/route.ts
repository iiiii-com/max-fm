import { NextResponse } from "next/server";
import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  action: z.enum(["add", "remove"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const { code, name, action } = parsed.data;

  if (action === "add") {
    const exists = await db.select().from(s.watchlists).where(and(eq(s.watchlists.uid, session.id), eq(s.watchlists.code, code))).limit(1);
    if (!exists[0]) {
      await db.insert(s.watchlists).values({ id: uid("wl"), uid: session.id, code, name, createdAt: now() } as any);
    }
  } else {
    await db.delete(s.watchlists).where(and(eq(s.watchlists.uid, session.id), eq(s.watchlists.code, code)) as any);
  }
  return NextResponse.json({ ok: true });
}