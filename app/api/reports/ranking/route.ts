import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth } from "@/lib/api-helpers";
import { rangeGuard } from "@/lib/report-shared";

/** GET /api/reports/ranking?from&to —— 任务耗时排行 Top10（含下钻明细） */
export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;
  const { range, error: rErr } = await rangeGuard(req);
  if (rErr) return rErr;

  const logs = await db.timeLog.findMany({
    where: {
      userId: user.id,
      date: { gte: range.from, lte: range.to },
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { name: true, color: true } },
        },
      },
    },
  });

  type Acc = {
    taskId: string | null;
    title: string;
    projectName: string | null;
    projectColor: string | null;
    totalHours: number;
    entries: { id: string; date: string; hours: number; note: string | null; source: string }[];
  };

  const map = new Map<string, Acc>();
  for (const l of logs) {
    const key = l.taskId ?? `__note__${l.note ?? "未命名"}`;
    const acc =
      map.get(key) ??
      ({
        taskId: l.taskId,
        title: l.task?.title ?? l.note ?? "未关联任务",
        projectName: l.task?.project?.name ?? null,
        projectColor: l.task?.project?.color ?? null,
        totalHours: 0,
        entries: [],
      } satisfies Acc);
    acc.totalHours += l.hours;
    acc.entries.push({
      id: l.id,
      date: l.date.toISOString().slice(0, 10),
      hours: l.hours,
      note: l.note,
      source: l.source,
    });
    map.set(key, acc);
  }

  const ranking = [...map.values()]
    .map((a) => ({ ...a, totalHours: Math.round(a.totalHours * 100) / 100 }))
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 10);

  return NextResponse.json({ ranking });
}
