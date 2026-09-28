import "server-only";
import { db } from "@/lib/db";
import { parseYmd, todayYmd, weekdayOf } from "@/lib/date";
import type { RepeatRule } from "@prisma/client";

/** 判断某周期规则在某天（周一=1…周日=7）是否应生成实例 */
export function ruleMatchesDay(rule: RepeatRule, weekday: number): boolean {
  switch (rule) {
    case "DAILY":
      return true;
    case "WEEKDAYS":
      return weekday <= 5;
    case "WEEKLY_MON":
      return weekday === 1;
    case "WEEKLY_TUE":
      return weekday === 2;
    case "WEEKLY_WED":
      return weekday === 3;
    case "WEEKLY_THU":
      return weekday === 4;
    case "WEEKLY_FRI":
      return weekday === 5;
    case "WEEKLY_SAT":
      return weekday === 6;
    case "WEEKLY_SUN":
      return weekday === 7;
    default:
      return false;
  }
}

/**
 * 确保今天的周期任务实例已生成（幂等）。
 * 在仪表盘加载与任务列表查询前调用。
 */
export async function ensureRepeatInstances(userId: string): Promise<void> {
  const t = todayYmd();
  const today = parseYmd(t);
  const wd = weekdayOf(t);

  const templates = await db.task.findMany({
    where: { userId, repeatRule: { not: null }, repeatTemplateId: null },
  });

  const due = templates.filter((tpl) => ruleMatchesDay(tpl.repeatRule!, wd));
  if (due.length === 0) return;

  const existing = await db.task.findMany({
    where: { userId, repeatTemplateId: { in: due.map((d) => d.id) }, instanceDate: today },
    select: { repeatTemplateId: true },
  });
  const existingSet = new Set(existing.map((e) => e.repeatTemplateId));

  const toCreate = due.filter((d) => !existingSet.has(d.id));
  if (toCreate.length === 0) return;

  await db.task.createMany({
    data: toCreate.map((tpl) => ({
      title: tpl.title,
      description: tpl.description,
      priority: tpl.priority,
      userId,
      projectId: tpl.projectId,
      dueDate: today,
      status: "TODO" as const,
      repeatTemplateId: tpl.id,
      instanceDate: today,
    })),
  });
}
