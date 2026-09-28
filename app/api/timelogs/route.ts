import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { parseYmd } from "@/lib/date";

/** GET /api/timelogs?from=yyyy-MM-dd&to=yyyy-MM-dd 默认本月 */
export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  let fromStr = sp.get("from");
  let toStr = sp.get("to");

  if (!fromStr || !toStr) {
    const now = new Date();
    fromStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    toStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(
      last.getDate()
    ).padStart(2, "0")}`;
  }

  let from: Date;
  let to: Date;
  try {
    from = parseYmd(fromStr);
    to = parseYmd(toStr);
  } catch {
    return badRequest("日期格式应为 yyyy-MM-dd");
  }

  const logs = await db.timeLog.findMany({
    where: { userId: user.id, date: { gte: from, lte: to } },
    include: { task: { select: { id: true, title: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ logs });
}

/** POST /api/timelogs */
export async function POST(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("请求格式错误");
  const { date, hours, note, taskId } = body as Record<string, unknown>;

  if (typeof date !== "string") return badRequest("缺少日期");
  let d: Date;
  try {
    d = parseYmd(date);
  } catch {
    return badRequest("日期格式应为 yyyy-MM-dd");
  }
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0 || hours > 24)
    return badRequest("工时需为 0~24 之间的数字");

  if (taskId != null && typeof taskId === "string") {
    const task = await db.task.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return badRequest("关联任务不存在");
  }

  // 同日同任务同备注的重复填报提示由前端处理，这里允许并存（如上午/下午分开记）
  const log = await db.timeLog.create({
    data: {
      userId: user.id,
      date: d,
      hours: Math.round(hours * 100) / 100,
      note: typeof note === "string" && note ? note : null,
      taskId: typeof taskId === "string" && taskId ? taskId : null,
    },
    include: { task: { select: { id: true, title: true } } },
  });

  return NextResponse.json({ log }, { status: 201 });
}
