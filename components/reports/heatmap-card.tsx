"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/date";

interface HeatCell {
  date: string;
  hours: number; // -1 = 未来日期
}
interface HeatData {
  start: string;
  end: string;
  columns: HeatCell[][];
  maxHours: number;
}

const LEVEL_CLASS = [
  "bg-secondary", // 0h
  "bg-success/25",
  "bg-success/45",
  "bg-success/70",
  "bg-success", // 满
];

function levelOf(hours: number, max: number): number {
  if (hours <= 0) return 0;
  const r = hours / Math.max(max, 1);
  if (r > 0.75) return 4;
  if (r > 0.5) return 3;
  if (r > 0.25) return 2;
  return 1;
}

export function HeatmapCard() {
  const [data, setData] = useState<HeatData | null>(null);

  useEffect(() => {
    fetch("/api/reports/heatmap?weeks=14")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => null);
  }, []);

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">热力图加载中…</p>
      </div>
    );
  }

  const activeDays = data.columns
    .flat()
    .filter((c) => c.hours > 0).length;
  const totalHours = data.columns
    .flat()
    .reduce((s, c) => s + Math.max(c.hours, 0), 0);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Flame className="size-4 text-warning" />
          工作节奏热力图
        </h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          近 14 周 · 活跃 {activeDays} 天 · 共{" "}
          <b className="text-foreground">{formatHours(totalHours)}</b> 小时
        </p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {/* 星期标签列 */}
          <div className="mr-1 flex flex-col gap-[3px] pt-0 text-[9px] leading-none text-muted-foreground">
            {["一", "", "三", "", "五", "", "日"].map((w, i) => (
              <span key={i} className="flex h-3 w-3 items-center">
                {w}
              </span>
            ))}
          </div>

          {data.columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date} · ${cell.hours < 0 ? "未开始" : `${formatHours(cell.hours)} 小时`}`}
                  className={cn(
                    "size-3 rounded-[3px] transition-colors hover:ring-1 hover:ring-primary/60",
                    cell.hours < 0 ? "bg-transparent" : LEVEL_CLASS[levelOf(cell.hours, data.maxHours)]
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        少
        <span className={cn("size-3 rounded-[3px]", LEVEL_CLASS[0])} />
        <span className={cn("size-3 rounded-[3px]", LEVEL_CLASS[1])} />
        <span className={cn("size-3 rounded-[3px]", LEVEL_CLASS[2])} />
        <span className={cn("size-3 rounded-[3px]", LEVEL_CLASS[3])} />
        <span className={cn("size-3 rounded-[3px]", LEVEL_CLASS[4])} />
        多
      </div>
    </div>
  );
}
