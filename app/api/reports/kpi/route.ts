import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth } from "@/lib/api-helpers";
import { rangeGuard } from "@/lib/report-shared";

/** GET /api/reports/kpi?from&to —— 指标卡数据 */
export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;
  const { range, error: rErr } = await rangeGuard(req);
  if (rErr) return rErr;

  const dateIn = { gte: range.from, lte: range.to };

  const [hoursAgg, tasksCompleted, tasksActive, overdue, attendance] =
    await Promise.all([
      db.timeLog.aggregate({
        where: { userId: user.id, date: dateIn },
        _sum: { hours: true },
      }),
      db.task.count({
        where: {
          userId: user.id,
          status: "DONE",
          completedAt: dateIn,
          repeatTemplateId: null,
        },
      }),
      db.task.count({ where: { userId: user.id, status: "IN_PROGRESS" } }),
      db.task.count({
        where: {
          userId: user.id,
          status: { not: "DONE" },
          dueDate: { lt: range.from },
          repeatTemplateId: null,
        },
      }),
      db.attendance.findMany({
        where: { userId: user.id, date: dateIn },
        select: { status: true },
      }),
    ]);

  return NextResponse.json({
    hoursTotal: hoursAgg._sum.hours ?? 0,
    tasksCompleted,
    tasksActive,
    overdue,
    attendanceDays: attendance.length,
    lateCount: attendance.filter((a) => a.status === "LATE").length,
  });
}
