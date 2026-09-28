import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth } from "@/lib/api-helpers";
import { rangeGuard } from "@/lib/report-shared";
import { eachYmd } from "@/lib/date";

/**
 * GET /api/reports/trend?from&to
 * 返回区间内每日：工时小时数、完成任务数（两条曲线一次取全）
 */
export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;
  const { range, error: rErr } = await rangeGuard(req);
  if (rErr) return rErr;

  const days = eachYmd(range.fromStr, range.toStr);
  if (days.length > 366)
    return NextResponse.json({ error: "区间最长一年" }, { status: 400 });

  const [logs, doneTasks] = await Promise.all([
    db.timeLog.findMany({
      where: {
        userId: user.id,
        date: { gte: range.from, lte: range.to },
      },
      select: { date: true, hours: true },
    }),
    db.task.findMany({
      where: {
        userId: user.id,
        status: "DONE",
        completedAt: { gte: range.from, lt: range.to },
        repeatTemplateId: null,
      },
      select: { completedAt: true },
    }),
  ]);

  const hoursMap = new Map<string, number>();
  for (const l of logs) {
    const k = l.date.toISOString().slice(0, 10);
    hoursMap.set(k, (hoursMap.get(k) ?? 0) + l.hours);
  }
  const doneMap = new Map<string, number>();
  for (const t of doneTasks) {
    if (!t.completedAt) continue;
    // 完成时间按服务器本地时区归日
    const d = t.completedAt;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    if (days.includes(k)) doneMap.set(k, (doneMap.get(k) ?? 0) + 1);
  }

  return NextResponse.json({
    points: days.map((d) => ({
      date: d,
      hours: Math.round((hoursMap.get(d) ?? 0) * 100) / 100,
      tasksDone: doneMap.get(d) ?? 0,
    })),
  });
}
