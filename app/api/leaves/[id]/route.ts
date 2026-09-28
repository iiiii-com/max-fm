import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth } from "@/lib/api-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const { id } = await params;
  const leave = await db.leaveRequest.findFirst({
    where: { id, userId: user.id },
  });
  if (!leave)
    return NextResponse.json({ error: "请假记录不存在" }, { status: 404 });

  await db.leaveRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
