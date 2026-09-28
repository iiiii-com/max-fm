import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth } from "@/lib/api-helpers";
import { parseYmd, todayYmd } from "@/lib/date";

/**
 * GET /api/reminders —— 提醒中心数据
 * overdue: 已逾期未完成任务；dueToday: 今日到期；
 * noTimeLogToday / notClockedIn 用于引导补录提示
 */
export async function GET() {
  const { user, error } = await apiAuth();
  if (error) return error;

  const t = todayYmd();
  const todayStart = parseYmd(t);
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  const [overdue, dueToday, todayLogs, todayAtt] = await Promise.all([
    db.task.findMany({
      where: {
        userId: user.id,
        status: { not: "DONE" },
        dueDate: { lt: todayStart },
        repeatTemplateId: null,
      },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    db.task.findMany({
      where: {
        userId: user.id,
        status: { not: "DONE" },
        dueDate: todayStart,
      },
      select: { id: true, title: true, priority: true },
      take: 20,
    }),
    db.timeLog.aggregate({
      where: { userId: user.id, date: todayStart },
      _sum: { hours: true },
    }),
    db.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: todayStart } },
      select: { clockInAt: true },
    }),
  ]);

  return NextResponse.json({
    overdue,
    dueToday,
    noTimeLogToday:
      minutesNow >= 18 * 60 && (todayLogs._sum.hours ?? 0) <= 0,
    notClockedIn: minutesNow >= 9 * 60 && !todayAtt?.clockInAt,
  });
}
