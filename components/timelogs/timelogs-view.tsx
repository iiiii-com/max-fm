"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDaysYmd, todayYmd, weekStartYmd, formatHours } from "@/lib/date";
import type { ClientTimeLog } from "@/lib/types";

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

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
    const [lRes, tRes] = await Promise.all([
      fetch(`/api/timelogs?from=${weekStart}&to=${weekEnd}`),
      fetch("/api/tasks"),
    ]);
    if (lRes.ok) {
      const data = await lRes.json();
      setLogs(data.logs);
    }
    if (tRes.ok) {
      const data = await tRes.json();
      // 未完成任务排在前面
      setTasks(
        data.tasks.sort((a: { status: string }, b: { status: string }) =>
          a.status === "DONE" ? 1 : b.status === "DONE" ? -1 : 0
        )
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

  function shiftWeek(delta: number) {
    setWeekStart(addDaysYmd(weekStart, delta * 7));
  }

  return (
    <div className="space-y-4">
      {/* 快速填报 */}
      <div className="rounded-xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[auto_auto_1fr_1fr_auto]">
          <Field label="日期">
            <Input
              type="date"
              value={form.date}
              max={today}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full md:w-36"
            />
          </Field>
          <Field label="工时（小时）">
            <Input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              placeholder="8"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              className="w-full md:w-24"
            />
          </Field>
          <Field label="关联任务（可选）">
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
          <Field label="备注（可选）">
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="做了什么？"
              onKeyDown={(e) => e.key === "Enter" && addLog()}
            />
          </Field>
          <div className="flex items-end">
            <Button onClick={addLog} disabled={busy} className="w-full md:w-auto">
              <Plus className="size-4" />
              填报
            </Button>
          </div>
        </div>
      </div>

      {/* 周导航与汇总 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="上一周">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(weekStartYmd())}>
            本周
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="下一周">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-sm font-medium tabular-nums">
          {weekStart.slice(5).replace("-", "/")} ~ {weekEnd.slice(5).replace("-", "/")}
        </span>
        <div className="ml-auto flex gap-2 text-sm text-muted-foreground">
          <span>
            本周合计{" "}
            <b className="text-foreground tabular-nums">{formatHours(weekTotal)}</b> 小时
          </span>
          {workedDays > 0 && (
            <span>
              · 工作日日均{" "}
              <b className="text-foreground tabular-nums">
                {formatHours(weekTotal / workedDays)}
              </b>{" "}
              小时
            </span>
          )}
        </div>
      </div>

      {/* 周网格 */}
      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d) => (
            <div
              key={d.ymd}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-2.5",
                d.ymd === today && "ring-2 ring-primary"
              )}
            >
              <div className="mb-2 flex items-baseline justify-between px-0.5">
                <span
                  className={cn(
                    "text-xs font-medium",
                    d.ymd === today ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {d.name}
                </span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    d.total > 0 ? "font-semibold text-foreground" : "text-muted-foreground/50"
                  )}
                >
                  {formatHours(d.total)}h
                </span>
              </div>

              <div className="min-h-16 space-y-1">
                {d.items.length === 0 ? (
                  <p className="py-3 text-center text-[11px] text-muted-foreground/60">—</p>
                ) : (
                  d.items.map((l) => (
                    <div
                      key={l.id}
                      className="group relative rounded-md bg-secondary/70 px-2 py-1.5"
                      title={l.note ?? l.task?.title ?? ""}
                    >
                      <p className="truncate pr-4 text-[11px] font-medium leading-tight">
                        {l.task?.title ?? l.note ?? "工作记录"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        {l.source === "TIMER" && (
                          <Timer className="size-2.5 text-primary" aria-label="番茄钟" />
                        )}
                        {formatHours(l.hours)}h
                        {l.task && l.note ? ` · ${l.note}` : ""}
                      </p>
                      <button
                        onClick={() => removeLog(l.id)}
                        aria-label="删除"
                        className="absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
