"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Timer,
  CalendarRange,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Loading } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import { addDaysYmd, todayYmd, weekStartYmd, formatHours } from "@/lib/date";
import type { ClientTimeLog } from "@/lib/types";

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const FULL_DAY_TARGET = 8;

export function TimelogsView() {
  const [weekStart, setWeekStart] = useState(() => weekStartYmd());
  const [logs, setLogs] = useState<ClientTimeLog[]>([]);
  const [tasks, setTasks] = useState<{ id: string; title: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const today = todayYmd();
  const [form, setForm] = useState({
    date: today,
    hours: "",
    taskId: "",
    note: "",
  });
  const [busy, setBusy] = useState(false);

  const weekEnd = useMemo(() => addDaysYmd(weekStart, 6), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, t] = await Promise.all([
      apiGet<{ logs: ClientTimeLog[] }>(
        `/api/timelogs?from=${weekStart}&to=${weekEnd}`
      ),
      apiGet<{ tasks: { id: string; title: string; status: string }[] }>(
        "/api/tasks"
      ),
    ]);
    if (l) setLogs(l.logs);
    if (t) {
      // 未完成任务排在前面
      setTasks(
        t.tasks.sort((a, b) => (a.status === "DONE" ? 1 : b.status === "DONE" ? -1 : 0))
      );
    }
    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    load();
  }, [load]);

  async function addLog() {
    const h = parseFloat(form.hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      alert("请输入 0~24 之间的工时数字");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/timelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          hours: h,
          taskId: form.taskId || null,
          note: form.note || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body.error ?? "填报失败");
        return;
      }
      setForm((f) => ({ ...f, hours: "", note: "" }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeLog(id: string) {
    const res = await fetch(`/api/timelogs/${id}`, { method: "DELETE" });
    if (res.ok) setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i)).map(
        (ymdStr) => ({
          ymd: ymdStr,
          name: DAY_NAMES[(new Date(`${ymdStr}T12:00:00`).getDay() + 6) % 7],
          items: logs.filter((l) => l.date.slice(0, 10) === ymdStr),
          total: logs
            .filter((l) => l.date.slice(0, 10) === ymdStr)
            .reduce((s, l) => s + l.hours, 0),
        })
      ),
    [weekStart, logs]
  );

  const weekTotal = days.reduce((s, d) => s + d.total, 0);
  const workedDays = days.filter((d) => d.total > 0).length;
  const maxDay = Math.max(...days.map((d) => d.total), FULL_DAY_TARGET);
  const isCurrentWeek = weekStart === weekStartYmd();

  function shiftWeek(delta: number) {
    setWeekStart(addDaysYmd(weekStart, delta * 7));
  }

  return (
    <div className="space-y-4">
      {/* 快速填报 */}
      <Card>
        <CardHeader
          title="快速填报"
          description="按日登记工时，可关联任务；番茄钟专注结束后会自动记录"
          icon={<Timer />}
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[9rem_7rem_1fr_1fr_auto] md:items-end">
            <Field label="日期">
              <Input
                type="date"
                value={form.date}
                max={today}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="工时" hint="小时">
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                placeholder="8"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addLog()}
                className="tabular"
              />
            </Field>
            <Field label="关联任务" className="col-span-2 md:col-span-1">
              <Select
                value={form.taskId}
                onChange={(e) => setForm({ ...form, taskId: e.target.value })}
              >
                <option value="">不关联</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                    {t.status === "DONE" ? " ✓" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="备注" className="col-span-2 md:col-span-1">
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="做了什么？"
                onKeyDown={(e) => e.key === "Enter" && addLog()}
              />
            </Field>
            <div className="col-span-2 md:col-span-1">
              <Button
                variant="primary"
                onClick={addLog}
                disabled={busy}
                className="w-full md:w-auto"
              >
                <Plus />
                填报
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 周汇总 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => shiftWeek(-1)}
            aria-label="上一周"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(weekStartYmd())}
            disabled={isCurrentWeek}
          >
            本周
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => shiftWeek(1)}
            aria-label="下一周"
          >
            <ChevronRight />
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-[13px] font-medium">
          <CalendarRange className="size-3.5 text-subtle-foreground" />
          <span className="tabular">
            {weekStart.slice(5).replace("-", "/")} ~ {weekEnd.slice(5).replace("-", "/")}
          </span>
        </p>

        <div className="ml-auto flex items-center gap-4 text-[11.5px] text-muted-foreground">
          <p>
            本周合计{" "}
            <b className="tabular text-[13px] text-foreground">{formatHours(weekTotal)}</b> h
          </p>
          {workedDays > 0 && (
            <p>
              <TrendingUp className="mr-0.5 inline size-3" />
              日均{" "}
              <b className="tabular text-[13px] text-foreground">
                {formatHours(weekTotal / workedDays)}
              </b>{" "}
              h
            </p>
          )}
        </div>
      </div>

      {/* 周网格 */}
      {loading ? (
        <Loading label="正在加载工时" />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d) => {
            const isToday = d.ymd === today;
            const isFuture = d.ymd > today;
            return (
              <div
                key={d.ymd}
                className={cn(
                  "surface-lit flex flex-col rounded-xl border bg-card p-2.5 transition-[border-color,box-shadow] duration-150",
                  isToday
                    ? "border-primary/45 shadow-float"
                    : "hover:border-border-strong"
                )}
              >
                <div className="mb-2 flex items-baseline justify-between gap-1 px-0.5">
                  <span
                    className={cn(
                      "text-[12px] font-medium",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {d.name}
                    <span className="tabular ml-1 text-[10.5px] font-normal text-subtle-foreground">
                      {Number(d.ymd.slice(8))}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tabular text-[12px] font-semibold",
                      d.total > 0 ? "text-foreground" : "text-subtle-foreground/60"
                    )}
                  >
                    {formatHours(d.total)}
                    <span className="text-[10px] font-normal">h</span>
                  </span>
                </div>

                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      d.total >= FULL_DAY_TARGET ? "bg-success" : "bg-primary"
                    )}
                    style={{ width: `${(d.total / maxDay) * 100}%` }}
                  />
                </div>

                <div className="mt-2 min-h-20 flex-1 space-y-1">
                  {d.items.length === 0 ? (
                    <p className="py-5 text-center text-[11px] text-subtle-foreground/60">
                      {isFuture ? "—" : "未填报"}
                    </p>
                  ) : (
                    d.items.map((l) => (
                      <div
                        key={l.id}
                        className="group relative rounded-md border border-border/70 bg-subtle px-2 py-1.5 transition-colors hover:border-border-strong"
                        title={l.note ?? l.task?.title ?? ""}
                      >
                        <p className="truncate pr-4 text-[11px] font-medium leading-tight">
                          {l.task?.title ?? l.note ?? "工作记录"}
                        </p>
                        <p className="tabular mt-0.5 flex items-center gap-1 text-[10px] text-subtle-foreground">
                          {l.source === "TIMER" && (
                            <Timer className="size-2.5 text-primary" aria-label="番茄钟" />
                          )}
                          {formatHours(l.hours)}h
                        </p>
                        <button
                          onClick={() => removeLog(l.id)}
                          aria-label="删除工时记录"
                          className="absolute right-1 top-1 rounded p-0.5 text-subtle-foreground opacity-0 transition-all hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
