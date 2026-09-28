import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { parseYmd, todayYmd } from "@/lib/date";

/** 迟到判定线：本地时间 09:30 */
const LATE_LIMIT_MINUTES = 9 * 60 + 30;

/** GET /api/attendance?month=yyyy-MM —— 当月考勤+请假数据 */
export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const monthParam = req.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(monthParam)) return badRequest("month 格式应为 yyyy-MM");
  const [y, m] = monthParam.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));

  const [records, leaves] = await Promise.all([
    db.attendance.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    }),
    db.leaveRequest.findMany({
      where: {
        userId: user.id,
        startDate: { lt: end },
        endDate: { gte: start },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const today = await db.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: parseYmd(todayYmd()) } },
  });

  return NextResponse.json({
    today,
    records,
    leaves,
  });
}

/** POST /api/attendance —— 打卡：无记录=>上班，有记录无下班=>下班 */
export async function POST() {
  const { user, error } = await apiAuth();
  if (error) return error;

  const now = new Date();
  const dateKey = parseYmd(todayYmd());

  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: dateKey } },
  });

  if (!existing) {
    const minutes = now.getHours() * 60 + now.getMinutes();
    const record = await db.attendance.create({
      data: {
        userId: user.id,
        date: dateKey,
        clockInAt: now,
        status: minutes > LATE_LIMIT_MINUTES ? "LATE" : "NORMAL",
      },
    });
    return NextResponse.json({ action: "clock_in", record });
  }

  if (!existing.clockOutAt) {
    const clockInAt = existing.clockInAt ?? existing.date;
    // 下班打卡至少与上班间隔 1 分钟，防误触
    if (now.getTime() - clockInAt.getTime() < 60_000)
      return badRequest("距离上班打卡不足 1 分钟");
    const record = await db.attendance.update({
      where: { id: existing.id },
      data: { clockOutAt: now },
    });
    return NextResponse.json({ action: "clock_out", record });
  }

  return badRequest("今天已完成上下班打卡");
}
