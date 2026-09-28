import { NextRequest, NextResponse } from "next/server";
import { TaskStatus, Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { parseYmd, todayYmd } from "@/lib/date";

const STATUS_VALUES = Object.values(TaskStatus) as string[];
const PRIORITY_VALUES = Object.values(Priority) as string[];

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!task)
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("请求格式错误");
  const {
    title,
    description,
    status,
    priority,
    dueDate,
    projectId,
    focusDate,
    clearDueDate,
  } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) return badRequest("标题不能为空");
    data.title = title.trim();
  }
  if (description !== undefined) {
    data.description =
      typeof description === "string" && description ? description : null;
  }

  if (status !== undefined) {
    if (typeof status !== "string" || !STATUS_VALUES.includes(status))
      return badRequest("状态参数错误");
    data.status = status;
    data.completedAt = status === TaskStatus.DONE ? new Date() : null;
    // 完成时自动清掉今日焦点
    if (
      status === TaskStatus.DONE &&
      task.focusDate &&
      todayYmd() === task.focusDate.toISOString().slice(0, 10)
    ) {
      data.focusDate = null;
    }
  }

  if (priority !== undefined) {
    if (typeof priority !== "string" || !PRIORITY_VALUES.includes(priority))
      return badRequest("优先级参数错误");
    data.priority = priority;
  }

  if (clearDueDate === true) {
    data.dueDate = null;
  } else if (dueDate !== undefined && dueDate !== null) {
    if (typeof dueDate !== "string") return badRequest("截止日期格式错误");
    try {
      data.dueDate = dueDate ? parseYmd(dueDate) : null;
    } catch {
      return badRequest("截止日期格式应为 yyyy-MM-dd");
    }
  }

  if (projectId !== undefined) {
    if (projectId === null || projectId === "") {
      data.projectId = null;
    } else if (typeof projectId === "string") {
      const p = await db.project.findFirst({
        where: { id: projectId, userId: user.id },
      });
      if (!p) return badRequest("项目不存在");
      data.projectId = projectId;
    }
  }

  // 今日焦点：传 "toggle" 切换，或具体日期
  if (focusDate !== undefined) {
    if (focusDate === "toggle") {
      const isFocusToday =
        task.focusDate &&
        todayYmd() === task.focusDate.toISOString().slice(0, 10);
      data.focusDate = isFocusToday ? null : parseYmd(todayYmd());
    } else if (focusDate === null) {
      data.focusDate = null;
    } else if (typeof focusDate === "string") {
      try {
        data.focusDate = parseYmd(focusDate);
      } catch {
        return badRequest("焦点日期格式错误");
      }
    }
  }

  const updated = await db.task.update({
    where: { id },
    data,
    include: { project: true },
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!task)
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
