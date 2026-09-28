import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { addDaysYmd, parseYmd, todayYmd } from "@/lib/date";

/** GET /api/reports/heatmap?weeks=12 —— 日历热力图（GitHub 风格，周一开头） */
export async function GET(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const weeksParam = Number(req.nextUrl.searchParams.get("weeks") ?? 12);
  if (!Number.isFinite(weeksParam) || weeksParam < 4 || weeksParam > 26)
    return badRequest("weeks 取值 4~26");

  const today = todayYmd();
  // 对齐到本周周一，再往前推 (weeks-1) 周
  const thisMonday = (() => {
    const d = new Date(`${today}T12:00:00`);
    const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
    const m = new Date(d.setDate(diff));
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(
      m.getDate()
    ).padStart(2, "0")}`;
  })();
  const start = addDaysYmd(thisMonday, -(weeksParam - 1) * 7);

  const logs = await db.timeLog.findMany({
    where: {
      userId: user.id,
      date: { gte: parseYmd(start), lte: parseYmd(today) },
    },
    select: { date: true, hours: true },
  });

  const map = new Map<string, number>();
  for (const l of logs) {
    const k = l.date.toISOString().slice(0, 10);
    map.set(k, (map.get(k) ?? 0) + l.hours);
  }

  // 以周为列、周一~周日为行的矩阵
  const columns: { date: string; hours: number }[][] = [];
  let cur = start;
  for (let w = 0; w < weeksParam; w++) {
    const col: { date: string; hours: number }[] = [];
    for (let i = 0; i < 7; i++) {
      col.push({ date: cur, hours: Math.round((map.get(cur) ?? 0) * 100) / 100 });
      cur = addDaysYmd(cur, 1);
    }
    columns.push(col);
  }
  // 未来日期置为 -1 标记空格子
  for (const col of columns)
    for (const cell of col)
      if (cell.date > today) cell.hours = -1;

  return NextResponse.json({
    start,
    end: addDaysYmd(cur, -1),
    columns,
    maxHours: Math.max(1, ...logs.map((l) => l.hours)),
  });
}
