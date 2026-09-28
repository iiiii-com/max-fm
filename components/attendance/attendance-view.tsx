"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  Clock3,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "@/lib/labels";
import type { ClientAttendance, ClientLeaveRequest } from "@/lib/types";
import type { LeaveType } from "@prisma/client";

interface MonthData {
  today: ClientAttendance | null;
  records: ClientAttendance[];
  leaves: ClientLeaveRequest[];
}

function fmtTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function AttendanceView() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState<MonthData>({ today: null, records: [], leaves: [] });
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<{
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
  }>({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/attendance?month=${month}`);
    if (res.ok) setData(await res.json());
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function clock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/attendance", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "打卡失败");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addLeave() {
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...leaveForm,
        reason: leaveForm.reason || null,
        startDate: leaveForm.startDate || leaveForm.endDate,
        endDate: leaveForm.endDate || leaveForm.startDate,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body.error ?? "登记失败");
      return;
    }
    setLeaveOpen(false);
    await load();
  }

  async function removeLeave(id: string) {
    if (!confirm("删除这条请假记录？")) return;
    const res = await fetch(`/api/leaves/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  // ---- 日历矩阵 ----
  const calendar = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // 周一=0
    const cells: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells as (string | null)[];
  }, [month]);

  const recordMap = useMemo(
    () => new Map(data.records.map((r) => [r.date.slice(0, 10), r])),
    [data.records]
  );
  const leaveDays = useMemo(() => {
    const set = new Set<string>();
    for (const l of data.leaves) {
      let cur = l.startDate.slice(0, 10);
      const end = l.endDate.slice(0, 10);
      while (cur <= end) {
        set.add(cur);
        const d = new Date(`${cur}T12:00:00`);
        d.setDate(d.getDate() + 1);
        cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
      }
    }
    return set;
  }, [data.leaves]);

  const todayKey = (() => {
    const d = now;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  })();

  const t = data.today;
  const clockedIn = !!t?.clockInAt;
  const clockedOut = !!t?.clockOutAt;

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* 今日打卡卡片 */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            {now.getFullYear()}年{now.getMonth() + 1}月{now.getDate()}日 · 周
            {WEEKDAYS[(now.getDay() + 6) % 7]}
          </p>
          <p className="my-2 text-4xl font-bold tabular-nums tracking-tight">
            {fmtTime(now.toISOString())}
            <span className="ml-1 text-lg font-normal text-muted-foreground">
              :{String(now.getSeconds()).padStart(2, "0")}
            </span>
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-secondary/60 px-3 py-2.5">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <LogIn className="size-3" /> 上班
              </p>
              <p className={cn("text-lg font-semibold tabular-nums", t?.status === "LATE" && "text-warning")}>
                {fmtTime(t?.clockInAt ?? null)}
                {t?.status === "LATE" && (
                  <span className="ml-1 align-middle text-xs font-medium">迟到</span>
                )}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-3 py-2.5">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <LogOut className="size-3" /> 下班
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {fmtTime(t?.clockOutAt ?? null)}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              {error}
            </p>
          )}

          {!clockedIn ? (
            <Button onClick={clock} disabled={busy} size="lg" className="mt-4 w-full">
              <LogIn className="size-4" />
              上班打卡
            </Button>
          ) : !clockedOut ? (
            <Button onClick={clock} disabled={busy} variant="secondary" size="lg" className="mt-4 w-full">
              <LogOut className="size-4" />
              下班打卡
            </Button>
          ) : (
            <div className="mt-4 flex h-10 items-center justify-center gap-2 rounded-md bg-success/10 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" />
              今日打卡已完成
            </div>
          )}
        </div>

        {/* 请假列表 */}
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="size-4" />
              请假记录
            </h3>
            <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
              <Plus className="size-3.5" />
              登记
            </Button>
          </div>
          {data.leaves.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              暂无请假记录
            </p>
          ) : (
            <ul className="space-y-2">
              {data.leaves.map((l) => (
                <li
                  key={l.id}
                  className="group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <span className="font-medium">{LEAVE_TYPE_LABELS[l.type]}</span>
                  <span className="text-muted-foreground">
                    {l.startDate.slice(5, 10).replace("-", "/")} ~{" "}
                    {l.endDate.slice(5, 10).replace("-", "/")}
                  </span>
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[11px]">
                    {LEAVE_STATUS_LABELS[l.status]}
                  </span>
                  <button
                    onClick={() => removeLeave(l.id)}
                    aria-label="删除"
                    className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 月历 */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock3 className="size-4" />
            {month.slice(0, 4)}年{Number(month.slice(5))}月 出勤日历
          </h3>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
              ←
            </Button>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
              →
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn("py-1", i >= 5 && "text-muted-foreground/60")}>
              周{w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendar.map((ymd, i) => {
            if (!ymd) return <div key={`e${i}`} />;
            const rec = recordMap.get(ymd);
            const onLeave = leaveDays.has(ymd);
            const isToday = ymd === todayKey;
            const isFuture = ymd > todayKey;
            const weekend = i % 7 >= 5;
            return (
              <div
                key={ymd}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-md border text-sm transition-colors",
                  weekend && "bg-secondary/40",
                  rec?.status === "NORMAL" && "border-success/50 bg-success/5",
                  rec?.status === "LATE" && "border-warning/60 bg-warning/10",
                  onLeave && "border-primary/40 bg-primary/5",
                  isFuture && "opacity-45"
                )}
              >
                <span className={cn("tabular-nums", isToday && "font-bold text-primary")}>
                  {Number(ymd.slice(8))}
                </span>
                {rec && (
                  <span
                    className={cn(
                      "absolute bottom-1 size-1.5 rounded-full",
                      rec.status === "LATE" ? "bg-warning" : "bg-success"
                    )}
                    title={`${rec.status === "LATE" ? "迟到" : "正常"} ${fmtTime(rec.clockInAt)}-${fmtTime(rec.clockOutAt)}`}
                  />
                )}
                {onLeave && !rec && (
                  <span className="absolute bottom-1 size-1.5 rounded-full bg-primary" title="请假" />
                )}
                {isToday && (
                  <span className="absolute inset-0 rounded-md ring-2 ring-primary pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> 正常出勤</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-warning" /> 迟到</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> 请假</span>
        </div>
      </div>

      {/* 请假对话框 */}
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} title="登记请假">
        <div className="space-y-4">
          <Field label="类型">
            <Select
              value={leaveForm.type}
              onChange={(e) =>
                setLeaveForm({ ...leaveForm, type: e.target.value as LeaveType })
              }
            >
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((k) => (
                <option key={k} value={k}>
                  {LEAVE_TYPE_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="开始日期">
              <Input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, startDate: e.target.value })
                }
              />
            </Field>
            <Field label="结束日期">
              <Input
                type="date"
                value={leaveForm.endDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, endDate: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="事由（可选）">
            <Textarea
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="备注说明…"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              取消
            </Button>
            <Button
              onClick={addLeave}
              disabled={!leaveForm.startDate && !leaveForm.endDate}
            >
              保存
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
