"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/date";
import { apiGet } from "@/lib/api-client";

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

const LEVELS = [
  "bg-cyan-bright/10",
  "bg-cyan-bright/30",
  "bg-cyan-bright/52",
  "bg-cyan-bright/76",
  "bg-cyan-bright",
];

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function levelOf(hours: number, max: number): number {
  if (hours <= 0) return 0;
  const r = hours / Math.max(max, 1);
  if (r > 0.75) return 4;
  if (r > 0.5) return 3;
  if (r > 0.25) return 2;
  return 1;
}

export function HeatmapCard({ weeks = 14 }: { weeks?: number }) {
  const [data, setData] = useState<HeatData | null>(null);

  useEffect(() => {
    apiGet<HeatData>(`/api/reports/heatmap?weeks=${weeks}`).then(setData);
  }, [weeks]);

  const monthLabels = useMemo(() => {
    if (!data) return [];
    const labels: { col: number; text: string }[] = [];
    let lastMonth = -1;
    let lastCol = -99;
    data.columns.forEach((col, i) => {
      const first = col.find((c) => c.hours >= 0) ?? col[0];
      if (!first) return;
      const m = Number(first.date.slice(5, 7)) - 1;
      // 换月且与上一个标签至少间隔 3 列，避免文字挤在一起
      if (m !== lastMonth && i - lastCol >= 3) {
        labels.push({ col: i, text: MONTHS[m] });
        lastMonth = m;
        lastCol = i;
      }
    });
    return labels;
  }, [data]);

  if (!data) {
    return (
      <Card>
        <div className="px-4 py-5 text-[13px] text-muted-foreground">热力图加载中…</div>
      </Card>
    );
  }

  const cells = data.columns.flat();
  const activeDays = cells.filter((c) => c.hours > 0).length;
  const totalHours = cells.reduce((s, c) => s + Math.max(c.hours, 0), 0);
  const best = cells.reduce<HeatCell | null>(
    (a, b) => (!a || b.hours > a.hours ? b : a),
    null
  );

  return (
    <Card>
      <CardHeader
        title="工作节奏热力图"
        icon={<Flame />}
        description={`近 ${weeks} 周 · 活跃 ${activeDays} 天`}
        action={
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">累计投入</p>
            <p className="tabular text-[15px] font-semibold">
              {formatHours(totalHours)}
              <span className="ml-0.5 text-[11px] font-normal text-subtle-foreground">h</span>
            </p>
          </div>
        }
      />
      <CardBody className="pt-0">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-fit">
            <div className="mb-1 flex gap-[3px] pl-5">
              {data.columns.map((_, ci) => {
                const label = monthLabels.find((l) => l.col === ci);
                return (
                  <span
                    key={ci}
                    className="block w-3 shrink-0 whitespace-nowrap text-[9px] leading-none text-subtle-foreground"
                  >
                    {label ? label.text : ""}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-[3px]">
              <div className="mr-1.5 flex w-3 flex-col gap-[3px] text-[9px] leading-none text-subtle-foreground">
                {["一", "", "三", "", "五", "", "日"].map((w, i) => (
                  <span key={i} className="flex h-3 items-center">
                    {w}
                  </span>
                ))}
              </div>

              {data.columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((cell) => (
                    <div
                      key={cell.date}
                      title={`${cell.date} · ${
                        cell.hours < 0 ? "未开始" : `${formatHours(cell.hours)} 小时`
                      }`}
                      className={cn(
                        "size-3 rounded-[3px] ring-inset transition-all duration-150",
                        cell.hours < 0
                          ? "bg-muted/45"
                          : LEVELS[levelOf(cell.hours, data.maxHours)],
                        "hover:ring-1 hover:ring-primary"
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-subtle-foreground">
          <p>
            {best && best.hours > 0
              ? `单日最高 ${formatHours(best.hours)} 小时（${best.date}）`
              : "还没有工时记录"}
          </p>
          <div className="flex items-center gap-1">
            少
            {LEVELS.map((c, i) => (
              <span key={i} className={cn("size-3 rounded-[3px]", c)} />
            ))}
            多
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
