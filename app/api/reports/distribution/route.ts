import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { rangeGuard } from "@/lib/report-shared";

/**
 * GET /api/reports/distribution?dim=status|priority|project|attendance
 * 环形图数据源
 */
export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const dim = req.nextUrl.searchParams.get("dim");
  if (!dim || !["status", "priority", "project", "attendance"].includes(dim))
    return badRequest("dim 取值 status|priority|project|attendance");

  if (dim === "status" || dim === "priority") {
    const groups = await db.task.groupBy({
      by: [dim],
      where: { userId: user.id, repeatTemplateId: null },
      _count: { _all: true },
    });
    return NextResponse.json({
      items: groups.map((g) => ({
        name: String(g[dim]),
        value: g._count._all,
      })),
    });
  }

  const { range, error: rErr } = await rangeGuard(req);
  if (rErr) return rErr;
  const dateIn = { gte: range.from, lte: range.to };

  if (dim === "project") {
    const logs = await db.timeLog.findMany({
      where: { userId: user.id, date: dateIn },
      select: {
        hours: true,
        task: {
          select: { project: { select: { name: true, color: true } } },
        },
      },
    });
    const map = new Map<string, { value: number; color?: string }>();
    for (const l of logs) {
      const key = l.task?.project?.name ?? "无项目";
      const cur = map.get(key) ?? { value: 0, color: l.task?.project?.color };
      cur.value += l.hours;
      map.set(key, cur);
    }
    return NextResponse.json({
      items: [...map.entries()]
        .map(([name, v]) => ({
          name,
          value: Math.round(v.value * 100) / 100,
          color: v.color,
        }))
        .sort((a, b) => b.value - a.value),
    });
  }

  // attendance
  const records = await db.attendance.groupBy({
    by: ["status"],
    where: { userId: user.id, date: dateIn },
    _count: { _all: true },
  });
  return NextResponse.json({
    items: records.map((g) => ({ name: g.status, value: g._count._all })),
  });
}
