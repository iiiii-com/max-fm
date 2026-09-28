import { NextRequest, NextResponse } from "next/server";
import { TaskStatus, Priority, RepeatRule } from "@prisma/client";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { parseYmd } from "@/lib/date";

const STATUS_VALUES = Object.values(TaskStatus) as string[];
const PRIORITY_VALUES = Object.values(Priority) as string[];
const REPEAT_VALUES = Object.values(RepeatRule) as string[];

export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const projectId = sp.get("projectId");
  const q = sp.get("q")?.trim();

  const tasks = await db.task.findMany({
    where: {
      userId: user.id,
      repeatTemplateId: null, // 模板不出现在列表
      ...(status && STATUS_VALUES.includes(status)
        ? { status: status as TaskStatus }
        : {}),
      ...(projectId ? { projectId } : {}),
      ...(q ? { title: { contains: q } } : {}),
    },
    include: { project: true },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("请求格式错误");
  const {
    title,
    description,
    projectId,
    priority,
    dueDate,
    repeatRule,
  } = body as Record<string, unknown>;

  if (typeof title !== "string" || !title.trim()) return badRequest("标题不能为空");

  let due: Date | undefined;
  if (typeof dueDate === "string" && dueDate) {
    try {
      due = parseYmd(dueDate);
    } catch {
      return badRequest("截止日期格式应为 yyyy-MM-dd");
    }
  }
  if (!projectId && typeof projectId === "string")
    return badRequest("项目参数错误");

  const task = await db.task.create({
    data: {
      title: title.trim(),
      description: typeof description === "string" && description ? description : null,
      userId: user.id,
      projectId: typeof projectId === "string" && projectId ? projectId : null,
      priority:
        typeof priority === "string" && PRIORITY_VALUES.includes(priority)
          ? (priority as Priority)
          : Priority.MID,
      dueDate: due ?? null,
      repeatRule:
        typeof repeatRule === "string" && REPEAT_VALUES.includes(repeatRule)
          ? (repeatRule as RepeatRule)
          : null,
    },
    include: { project: true },
  });

  return NextResponse.json({ task }, { status: 201 });
}
