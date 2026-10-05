"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Clock3,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  LogIn,
  LogOut,
  Star,
  ArrowUpRight,
  Circle,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Loading, StatTile } from "@/components/ui/feedback";
import { HeatmapCard } from "@/components/reports/heatmap-card";
import { DayTrace } from "@/components/dashboard/day-trace";
import { cn } from "@/lib/utils";
import { addDaysYmd, formatHours, todayYmd, weekStartYmd } from "@/lib/date";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";
import { AXIS_TICK, CHART, GRID_PROPS, tooltipStyle } from "@/lib/chart";
import { apiGet } from "@/lib/api-client";
import type { ClientAttendance, ClientTask } from "@/lib/types";
import type { Priority, TaskStatus } from "@prisma/client";

interface Kpi {
  hoursTotal: number;
  tasksCompleted: number;
  tasksActive: number;
  overdue: number;
  attendanceDays: number;
  lateCount: number;
}
interface TrendPoint {
  date: string;
  hours: number;
  tasksDone: number;
}
interface AttendanceMonth {
  today: ClientAttendance | null;
  records: ClientAttendance[];
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const PRIORITY_TONE: Record<Priority, "destructive" | "warning" | "neutral"> = {
  HIGH: "destructive",
  MID: "warning",
  LOW: "neutral",
};

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  TODO: Circle,
  IN_PROGRESS: CircleDot,
  DONE: CheckCircle2,
};

function TaskRow({ t, showStatus }: { t: ClientTask; showStatus?: boolean }) {
  const Icon = STATUS_ICON[t.status];
  return (
    <li className="group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-subtle">
      <Icon
        className={cn(
          "size-4 shrink-0",
          t.status === "DONE" ? "text-success" : t.status === "IN_PROGRESS" ? "text-primary" : "text-subtle-foreground"
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          t.status === "DONE" && "text-muted-foreground line-through decoration-muted-foreground/40"
        )}
      >
        {t.title}
      </span>
      {showStatus && (
        <Badge tone="neutral" className="hidden sm:inline-flex">
          {TASK_STATUS_LABELS[t.status]}
        </Badge>
      )}
      <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge>
      {t.dueDate && (
        <span className="tabular hidden text-[11px] text-subtle-foreground sm:inline">
          {t.dueDate.slice(5, 10).replace("-", "/")}
        </span>
      )}
    </li>
  );
}

export function DashboardView({ userName }: { userName: string }) {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [today, setToday] = useState<ClientAttendance | null>(null);
  const [records, setRecords] = useState<ClientAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const todayKey = todayYmd();
  const weekStart = weekStartYmd();

  const load = useCallback(async () => {
    const month = todayKey.slice(0, 7);
    const trendFrom = addDaysYmd(todayKey, -13);
    const [k, t, taskRes, att] = await Promise.all([
      apiGet<Kpi>(`/api/reports/kpi?from=${weekStart}&to=${todayKey}`),
      apiGet<{ points: TrendPoint[] }>(`/api/reports/trend?from=${trendFrom}&to=${todayKey}`),
      apiGet<{ tasks: ClientTask[] }>("/api/tasks"),
      apiGet<AttendanceMonth>(`/api/attendance?month=${month}`),
    ]);
    if (k) setKpi(k);
    if (t) setTrend(t.points);
    if (taskRes) setTasks(taskRes.tasks);
    setToday(att?.today ?? null);
    setRecords(att?.records ?? []);
    setLoading(false);
  }, [weekStart, todayKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function clock() {
    setBusy(true);
    try {
      await fetch("/api/attendance", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const focus = useMemo(
    () => tasks.filter((t) => t.focusDate?.slice(0, 10) === todayKey && t.status !== "DONE"),
    [tasks, todayKey]
  );

  const active = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO")
        .sort((a, b) => {
          const w: Record<Priority, number> = { HIGH: 0, MID: 1, LOW: 2 };
          return (
            w[a.priority] - w[b.priority] ||
            (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
          );
        })
        .slice(0, 7),
    [tasks]
  );

  const clockedIn = !!today?.clockInAt;
  const clockedOut = !!today?.clockOutAt;
  const weekHours = kpi?.hoursTotal ?? 0;
  const weekTarget = 40;
  const pct = Math.min(100, Math.round((weekHours / weekTarget) * 100));

  if (loading) {
    return <Loading label="正在汇总你的数据" />;
  }

  return (
    <div className="space-y-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-subtle-foreground">
            {now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日 · 星期
            {WEEKDAYS[now.getDay()]}
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight">
            {greeting(now)}，{userName}
          </h1>
        </div>
        <Button
          variant={clockedIn && !clockedOut ? "outline" : "primary"}
          onClick={clock}
          disabled={busy || clockedOut}
        >
          {clockedIn && !clockedOut ? (
            <>
              <LogOut /> 下班打卡
            </>
          ) : (
            <>
              <LogIn /> 上班打卡
            </>
          )}
        </Button>
      </div>

      {/* 一天的连续轨迹 —— 首屏主角 */}
      <DayTrace
        clockInAt={today?.clockInAt ?? null}
        clockOutAt={today?.clockOutAt ?? null}
        loggedHours={trend.find((p) => p.date === todayKey)?.hours ?? 0}
        history={records}
        now={now}
      />

      {/* 指标 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="本周工时"
          unit="h"
          value={formatHours(weekHours)}
          icon={Clock3}
          hint={`${pct}% / ${weekTarget}h · 日均 ${formatHours(weekHours / Math.max(1, kpi?.attendanceDays ?? 1))}h`}
        />
        <StatTile
          label="本周完成"
          value={kpi?.tasksCompleted ?? 0}
          unit="项"
          icon={CheckCircle2}
          tone="success"
        />
        <StatTile
          label="进行中"
          value={kpi?.tasksActive ?? 0}
          unit="项"
          icon={CircleDot}
          tone="primary"
        />
        <StatTile
          label="逾期未完"
          value={kpi?.overdue ?? 0}
          unit="项"
          icon={AlertTriangle}
          tone={kpi?.overdue ? "destructive" : "neutral"}
          hint={kpi?.lateCount ? `本月迟到 ${kpi.lateCount} 次` : undefined}
        />
      </div>

      {/* 主体两栏 */}
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="今日焦点"
              icon={<Star />}
              action={
                <Link
                  href="/tasks"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  全部任务
                  <ArrowUpRight className="size-3" />
                </Link>
              }
            />
            <CardBody className="pt-0">
              {focus.length === 0 ? (
                <EmptyState
                  icon={<Star />}
                  title="今天还没有焦点任务"
                  description="在任务页点星标图标，把最重要的三件事设为今日焦点。"
                  className="border-0 py-10"
                />
              ) : (
                <ul className="-mx-1 space-y-0.5">
                  {focus.map((t) => (
                    <TaskRow key={t.id} t={t} showStatus />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="待办队列"
              description="按优先级与截止日期排序的前 7 项"
              icon={<ListTodo />}
            />
            <CardBody className="pt-0">
              {active.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 />}
                  title="全部清空"
                  description="没有待处理的任务，享受这份清爽。"
                  className="border-0 py-10"
                />
              ) : (
                <ul className="-mx-1 space-y-0.5">
                  {active.map((t) => (
                    <TaskRow key={t.id} t={t} showStatus />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="近 14 天工时"
            description="每日投入趋势"
            icon={<Clock3 />}
          />
          <CardBody className="pt-1">
            <div style={{ height: 232 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.c1} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART.c1} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5).replace("-", "/")}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={22}
                  />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: "var(--border-strong)" }}
                    labelFormatter={(v) => String(v)}
                    formatter={(value) => [`${formatHours(Number(value))} 小时`, "工时"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke={CHART.c1}
                    strokeWidth={2}
                    fill="url(#dashArea)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <HeatmapCard weeks={26} />
    </div>
  );
}
