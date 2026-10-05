"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "@/lib/labels";
import type { ClientAttendance, ClientLeaveRequest } from "@/lib/types";
import type { LeaveType } from "@prisma/client";

interface MonthData {
  today: ClientAttendance | null;
  records: ClientAttendance[];
  leaves: ClientLeaveRequest[];
}

function fmtTime(iso: string | null | undefined): string {
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
    const d = await apiGet<MonthData>(`/api/attendance?month=${month}`);
    if (d) setData(d);
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

  const monthStats = useMemo(() => {
    const normal = data.records.filter((r) => r.status === "NORMAL").length;
    const late = data.records.filter((r) => r.status === "LATE").length;
    const leaveCount = leaveDays.size;
    return { normal, late, leaveCount };
  }, [data.records, leaveDays]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* 今日打卡 + 请假 */}
      <div className="space-y-4">
        <Card>
          <CardBody className="p-5">
            <p className="text-[13px] text-muted-foreground">
              {now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日 · 星期
              {WEEKDAYS[(now.getDay() + 6) % 7]}
            </p>
            <p className="tabular mt-2 text-[40px] font-semibold leading-none tracking-tight">
              {String(now.getHours()).padStart(2, "0")}:
              {String(now.getMinutes()).padStart(2, "0")}
              <span className="text-[20px] font-normal text-subtle-foreground">
                :{String(now.getSeconds()).padStart(2, "0")}
              </span>
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-subtle px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <LogIn className="size-3" /> 上班
                </p>
                <p
                  className={cn(
                    "tabular mt-0.5 text-[17px] font-semibold leading-tight",
                    t?.status === "LATE" && "text-warning"
                  )}
                >
                  {fmtTime(t?.clockInAt)}
                </p>
                {t?.status === "LATE" && (
                  <Badge tone="warning" className="mt-1">
                    迟到
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border bg-subtle px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <LogOut className="size-3" /> 下班
                </p>
                <p className="tabular mt-0.5 text-[17px] font-semibold leading-tight">
                  {fmtTime(t?.clockOutAt)}
                </p>
                <p className="mt-1 text-[11px] text-subtle-foreground">
                  {clockedIn && !clockedOut ? "进行中" : "—"}
                </p>
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            {clockedOut ? (
              <div className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/8 text-[13px] font-medium text-success">
                <CheckCircle2 className="size-4" />
                今日打卡已完成
              </div>
            ) : (
              <Button
                variant={clockedIn ? "outline" : "primary"}
                size="lg"
                onClick={clock}
                disabled={busy}
                className="mt-4 w-full"
              >
                {clockedIn ? (
                  <>
                    <LogOut /> 下班打卡
                  </>
                ) : (
                  <>
                    <LogIn /> 上班打卡
                  </>
                )}
              </Button>
            )}

            <p className="mt-3 text-center text-[11px] text-subtle-foreground">
              09:30 后上班自动记为迟到
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="请假记录"
            icon={<CalendarDays />}
            action={
              <Button variant="outline" size="xs" onClick={() => setLeaveOpen(true)}>
                <Plus />
                登记
              </Button>
            }
          />
          <CardBody className="space-y-1.5 pt-0">
            {data.leaves.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
                本月暂无请假记录
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.leaves.map((l) => (
                  <li
                    key={l.id}
                    className="group flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-xs transition-colors hover:border-border-strong"
                  >
                    <Plane className="size-3 shrink-0 text-subtle-foreground" />
                    <span className="font-medium">{LEAVE_TYPE_LABELS[l.type]}</span>
                    <span className="tabular text-subtle-foreground">
                      {l.startDate.slice(5, 10).replace("-", "/")} ~{" "}
                      {l.endDate.slice(5, 10).replace("-", "/")}
                    </span>
                    <Badge tone={l.status === "APPROVED" ? "success" : "warning"}>
                      {LEAVE_STATUS_LABELS[l.status]}
                    </Badge>
                    <button
                      onClick={() => removeLeave(l.id)}
                      aria-label="删除请假记录"
                      className="ml-auto rounded p-1 text-subtle-foreground opacity-0 transition-all hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 月历 */}
      <Card>
        <CardHeader
          title={`${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月 出勤日历`}
          icon={<CalendarDays />}
          action={
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="上个月">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="下个月">
                <ChevronRight />
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-3 gap-2 border-y bg-subtle px-4 py-2.5">
          {[
            { label: "正常出勤", value: monthStats.normal, cls: "text-success" },
            { label: "迟到", value: monthStats.late, cls: "text-warning" },
            { label: "请假", value: monthStats.leaveCount, cls: "text-primary" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className={cn("tabular text-[15px] font-semibold", s.cls)}>
                {s.value}
                <span className="ml-0.5 text-[11px] font-normal text-subtle-foreground">天</span>
              </p>
            </div>
          ))}
        </div>

        <CardBody className="pt-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-subtle-foreground">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={cn("pb-1", i >= 5 && "opacity-50")}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                    "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[13px] transition-all duration-150",
                    "border-transparent bg-subtle",
                    weekend && "opacity-60",
                    rec?.status === "NORMAL" && "border-success/35 bg-success/8",
                    rec?.status === "LATE" && "border-warning/40 bg-warning/10",
                    onLeave && "border-primary/35 bg-primary/8",
                    isFuture && "opacity-40",
                    isToday && "ring-2 ring-primary ring-offset-1 ring-offset-card"
                  )}
                >
                  <span
                    className={cn(
                      "tabular leading-none",
                      isToday && "font-bold text-primary"
                    )}
                  >
                    {Number(ymd.slice(8))}
                  </span>
                  {rec && (
                    <span
                      className={cn(
                        "absolute bottom-1.5 size-1 rounded-full",
                        rec.status === "LATE" ? "bg-warning" : "bg-success"
                      )}
                      title={`${rec.status === "LATE" ? "迟到" : "正常"} ${fmtTime(
                        rec.clockInAt
                      )}-${fmtTime(rec.clockOutAt)}`}
                    />
                  )}
                  {onLeave && !rec && (
                    <span
                      className="absolute bottom-1.5 size-1 rounded-full bg-primary"
                      title="请假"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
            {[
              { c: "bg-success", t: "正常出勤" },
              { c: "bg-warning", t: "迟到" },
              { c: "bg-primary", t: "请假" },
              { c: "bg-subtle ring-1 ring-border ring-inset", t: "无记录" },
            ].map((l) => (
              <span key={l.t} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", l.c)} />
                {l.t}
              </span>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* 请假对话框 */}
      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="登记请假"
        description="请假期间将不出现在打卡统计中"
      >
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
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
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
