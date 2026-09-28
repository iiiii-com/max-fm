import type {
  Priority,
  RepeatRule,
  TaskStatus,
  LeaveType,
  LeaveStatus,
  GoalPeriod,
} from "@prisma/client";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "待办",
  IN_PROGRESS: "进行中",
  DONE: "已完成",
};

export const TASK_STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

/** 点击状态徽章时的流转顺序 */
export function nextTaskStatus(s: TaskStatus): TaskStatus {
  if (s === "TODO") return "IN_PROGRESS";
  if (s === "IN_PROGRESS") return "DONE";
  return "TODO";
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "低",
  MID: "中",
  HIGH: "高",
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MID: "bg-warning/15 text-warning",
  HIGH: "bg-destructive/10 text-destructive",
};

export const REPEAT_LABELS: Record<RepeatRule, string> = {
  DAILY: "每天",
  WEEKDAYS: "工作日",
  WEEKLY_MON: "每周一",
  WEEKLY_TUE: "每周二",
  WEEKLY_WED: "每周三",
  WEEKLY_THU: "每周四",
  WEEKLY_FRI: "每周五",
  WEEKLY_SAT: "每周六",
  WEEKLY_SUN: "每周日",
};

export const REPEAT_RULES = Object.keys(REPEAT_LABELS) as RepeatRule[];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: "年假",
  SICK: "病假",
  PERSONAL: "事假",
  OTHER: "其他",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: "已登记",
  APPROVED: "已批准",
  REJECTED: "已驳回",
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  QUARTER: "季度目标",
  MONTH: "月度目标",
};
