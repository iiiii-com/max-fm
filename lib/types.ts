import type {
  Priority,
  RepeatRule,
  TaskStatus,
  LeaveType,
  GoalPeriod,
  HabitSchedule,
} from "@prisma/client";

export interface ClientProject {
  id: string;
  name: string;
  color: string;
  archived: boolean;
}

export interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  focusDate: string | null;
  repeatRule: RepeatRule | null;
  repeatTemplateId: string | null;
  instanceDate: string | null;
  projectId: string | null;
  project: ClientProject | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ClientTimeLog {
  id: string;
  date: string; // yyyy-MM-dd
  hours: number;
  note: string | null;
  source: "MANUAL" | "TIMER";
  taskId: string | null;
  task: { id: string; title: string } | null;
  createdAt: string;
}

export interface ClientAttendance {
  id: string;
  date: string; // yyyy-MM-dd
  clockInAt: string | null;
  clockOutAt: string | null;
  status: "NORMAL" | "LATE";
}

export interface ClientLeaveRequest {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface ClientGoal {
  id: string;
  title: string;
  description: string | null;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  archived: boolean;
  tasks: { id: string; title: string; status: TaskStatus }[];
}

export interface ClientHabit {
  id: string;
  name: string;
  emoji: string;
  schedule: HabitSchedule;
  active: boolean;
}

export interface ClientHabitLog {
  habitId: string;
  date: string; // yyyy-MM-dd
  done: boolean;
}
