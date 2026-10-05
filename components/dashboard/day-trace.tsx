"use client";

import { useMemo } from "react";
import { computeDayTrace } from "@/lib/day-trace";
import { formatHours, todayYmd } from "@/lib/date";
import { cn } from "@/lib/utils";

interface AttendanceRow {
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
}

function clock(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dutyHours(r: AttendanceRow): number | null {
  if (!r.clockInAt || !r.clockOutAt) return null;
  const h = (Date.parse(r.clockOutAt) - Date.parse(r.clockInAt)) / 3_600_000;
  return Number.isFinite(h) && h > 0 ? Math.min(24, h) : null;
}

/**
 * 一天的连续轨迹 —— 这个产品唯一允许抢视线的模块。
 *
 * 它不画「每段工时在一天中的位置」——数据库没有那个信息，画了就是假的。
 * 它画的是在岗区间本身，以及这个区间里有多少被记录。缺口是主角。
 */
export function DayTrace({
  clockInAt,
  clockOutAt,
  loggedHours,
  history,
  now,
  className,
}: {
  clockInAt: string | null;
  clockOutAt: string | null;
  loggedHours: number;
  /** 含今日在内的本月 + 上月考勤，用于算基线 */
  history: AttendanceRow[];
  now: Date;
  className?: string;
}) {
  const trace = useMemo(() => {
    const baseline = history
      .filter((r) => r.date !== todayYmd())
      .map(dutyHours)
      .filter((h): h is number => h !== null)
      .slice(-7);
    return computeDayTrace({ clockInAt, clockOutAt, loggedHours, baseline, now });
  }, [clockInAt, clockOutAt, loggedHours, history, now]);

  const idle = trace.state === "idle";
  const filled = trace.coverage * 100;

  return (
    <section
      className={cn(
        "surface-lit rounded-xl border border-border-strong bg-card",
        className
      )}
    >
      {/* 仪表读数 */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-baseline gap-x-3 gap-y-1 px-4 pt-3.5">
        <Readout label="在岗" value={formatHours(trace.onDutyH)} unit="h" />
        <span className="text-subtle-foreground/40">/</span>
        <Readout label="已记录" value={formatHours(trace.loggedH)} unit="h" tone="primary" />
        <span className="text-subtle-foreground/40">/</span>
        <Readout
          label={idle ? "缺口" : "未记录"}
          value={formatHours(trace.gapH)}
          unit="h"
          tone={trace.gapH >= 1.5 ? "warning" : "neutral"}
        />
      </div>

      {/* 轨迹条：实心 = 已记录，斜纹 = 在岗但没记 */}
      <div className="mt-3 px-4">
        <div className="relative h-2.5 overflow-hidden rounded-sm bg-subtle">
          {idle ? (
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--foreground)_7%,transparent)_5px_6px)]" />
          ) : (
            <>
              <div
                className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500"
                style={{ width: `${filled}%` }}
              />
              {trace.gapH > 0.05 && (
                <div
                  className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--warning)_38%,transparent)_5px_6px)]"
                  style={{ left: `${filled}%`, right: 0 }}
                />
              )}
            </>
          )}
        </div>
        <div className="tabular mt-1 flex justify-between text-[10.5px] text-subtle-foreground">
          <span>打卡 {clock(clockInAt)}</span>
          {trace.state === "closed" ? (
            <span>下班 {clock(clockOutAt)}</span>
          ) : (
            <span>{idle ? "未开始" : `此刻 ${clock(now.toISOString())}`}</span>
          )}
        </div>
      </div>

      {/* 判断句：数据不回答「所以呢」，这里回答 */}
      <p className="mt-3 border-t px-4 py-2.5 text-[12.5px] leading-relaxed">
        <span
          className={cn(
            "mr-1.5 inline-block size-1.5 translate-y-px rounded-full",
            idle
              ? "bg-subtle-foreground/50"
              : trace.gapH >= 1.5
                ? "bg-warning"
                : "bg-success"
          )}
        />
        <span className="text-foreground">{trace.verdict}</span>
      </p>
    </section>
  );
}

function Readout({
  label,
  value,
  unit,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "neutral" | "primary" | "warning";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-subtle-foreground">
        {label}
      </span>
      <span className={cn("text-[22px] font-semibold leading-none tabular", toneCls)}>
        {value}
      </span>
      <span className="text-[11px] text-subtle-foreground">{unit}</span>
    </span>
  );
}
