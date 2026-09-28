import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { parseYmd } from "@/lib/date";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const { id } = await params;
  const log = await db.timeLog.findFirst({ where: { id, userId: user.id } });
  if (!log)
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("请求格式错误");
  const { hours, note, taskId, date } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (hours !== undefined) {
    if (typeof hours !== "number" || hours <= 0 || hours > 24)
      return badRequest("工时需为 0~24 之间的数字");
    data.hours = Math.round(hours * 100) / 100;
  }
  if (note !== undefined) {
    data.note = typeof note === "string" && note ? note : null;
  }
  if (date !== undefined) {
    if (typeof date !== "string") return badRequest("日期格式错误");
    try {
      data.date = parseYmd(date);
    } catch {
      return badRequest("日期格式应为 yyyy-MM-dd");
    }
  }
  if (taskId !== undefined) {
    if (taskId === null || taskId === "") {
      data.taskId = null;
    } else if (typeof taskId === "string") {
      const task = await db.task.findFirst({
        where: { id: taskId, userId: user.id },
      });
      if (!task) return badRequest("关联任务不存在");
      data.taskId = taskId;
    }
  }

  const updated = await db.timeLog.update({
    where: { id },
    data,
    include: { task: { select: { id: true, title: true } } },
  });
  return NextResponse.json({ log: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const { id } = await params;
  const log = await db.timeLog.findFirst({ where: { id, userId: user.id } });
  if (!log)
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });

  await db.timeLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
