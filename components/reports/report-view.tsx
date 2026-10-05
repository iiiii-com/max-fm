"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Clock3,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  CalendarCheck2,
  AlarmClock,
  TrendingUp,
  ChartPie,
  BarChart3,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, StatTile } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { addDaysYmd, formatHours, todayYmd, weekStartYmd } from "@/lib/date";
import { TASK_STATUS_LABELS } from "@/lib/labels";
import { HeatmapCard } from "@/components/reports/heatmap-card";
import { apiGet } from "@/lib/api-client";
import {
  AXIS_TICK,
  CHART,
  CHART_SERIES,
  GRID_PROPS,
  STATUS_COLORS,
  tooltipStyle,
} from "@/lib/chart";

// ---------- 类型 ----------
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
interface RankItem {
  taskId: string | null;
  title: string;
  projectName: string | null;
  projectColor: string | null;
  totalHours: number;
  entries: {
    id: string;
    date: string;
    hours: number;
    note: string | null;
    source: string;
  }[];
}
interface DistItem {
  name: string;
  value: number;
  color?: string | null;
}
interface DayLog {
  id: string;
  date: string;
  hours: number;
  note: string | null;
  source: "MANUAL" | "TIMER";
  task: { id: string; title: string } | null;
}

// ---------- 范围 ----------
type PresetKey = "today" | "week" | "month" | "30d" | "quarter" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "今天" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "30d", label: "近30天" },
  { key: "quarter", label: "本季度" },
];

function rangeFor(key: PresetKey): [string, string] {
  const today = todayYmd();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (key) {
    case "today":
      return [today, today];
    case "week":
      return [weekStartYmd(), today];
    case "month":
      return [`${y}-${String(m).padStart(2, "0")}-01`, today];
    case "30d":
      return [addDaysYmd(today, -29), today];
    case "quarter": {
      const qStartM = Math.floor((m - 1) / 3) * 3 + 1;
      const qs = `${y}-${String(qStartM).padStart(2, "0")}-01`;
      return [qs, today];
    }
    default:
      return [today, today];
  }
}

// ---------- 主组件 ----------
export function ReportView() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [from, to] = useMemo(
    () =>
      preset === "custom" && customFrom && customTo
        ? ([customFrom, customTo] as [string, string])
        : rangeFor(preset === "custom" ? "30d" : preset),
    [preset, customFrom, customTo]
  );

  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [projectDist, setProjectDist] = useState<DistItem[]>([]);
  const [statusDist, setStatusDist] = useState<DistItem[]>([]);

  const [metric, setMetric] = useState<"hours" | "tasksDone">("hours");
  const [drill, setDrill] = useState<RankItem | null>(null);
  const [dayDetail, setDayDetail] = useState<{ date: string; logs: DayLog[] } | null>(null);

  const load = useCallback(async () => {
    if (from > to) return;
    const qs = `from=${from}&to=${to}`;
    const [k, t, r, pd] = await Promise.all([
      apiGet<Kpi>(`/api/reports/kpi?${qs}`),
      apiGet<{ points: TrendPoint[] }>(`/api/reports/trend?${qs}`),
      apiGet<{ ranking: RankItem[] }>(`/api/reports/ranking?${qs}`),
      apiGet<{ items: DistItem[] }>(`/api/reports/distribution?dim=project&${qs}`),
    ]);
    const sd = await apiGet<{ items: DistItem[] }>(
      `/api/reports/distribution?dim=status`
    );
    if (k) setKpi(k);
    if (t) setTrend(t.points);
    if (r) setRanking(r.ranking);
    if (pd) setProjectDist(pd.items);
    if (sd) setStatusDist(sd.items);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDayDetail(date: string) {
    const d = await apiGet<{ logs: DayLog[] }>(
      `/api/timelogs?from=${date}&to=${date}`
    );
    setDayDetail({ date, logs: d?.logs ?? [] });
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      setPreset("custom");
    }
  }

  const maxRank = ranking[0]?.totalHours ?? 1;
  const seriesColor = metric === "hours" ? CHART.c1 : CHART.c4;
  const statusColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(TASK_STATUS_LABELS)) m[v] = k;
    return m;
  }, []);

  return (
    <div className="space-y-4">
      {/* 时间筛选器 */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          items={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          value={preset}
          onChange={setPreset}
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            aria-label="开始日期"
            className="h-7 w-33 text-xs"
          />
          <span className="text-xs text-subtle-foreground">至</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            aria-label="结束日期"
            className="h-7 w-33 text-xs"
          />
          <Button variant="outline" size="sm" onClick={applyCustom}>
            应用
          </Button>
        </div>
        <p className="tabular ml-auto text-[11px] text-subtle-foreground">
          统计区间 {from} ~ {to}
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="总工时"
          unit="h"
          value={kpi ? formatHours(kpi.hoursTotal) : "…"}
          icon={Clock3}
        />
        <StatTile
          label="完成任务"
          value={kpi?.tasksCompleted ?? "…"}
          icon={CheckCircle2}
          tone="success"
        />
        <StatTile
          label="进行中"
          value={kpi?.tasksActive ?? "…"}
          icon={CircleDot}
          tone="primary"
        />
        <StatTile
          label="逾期未完"
          value={kpi?.overdue ?? "…"}
          icon={AlertTriangle}
          tone={kpi?.overdue ? "destructive" : "neutral"}
        />
        <StatTile
          label="出勤天数"
          value={kpi?.attendanceDays ?? "…"}
          unit="天"
          icon={CalendarCheck2}
        />
        <StatTile
          label="迟到次数"
          value={kpi?.lateCount ?? "…"}
          unit="次"
          icon={AlarmClock}
          tone={kpi?.lateCount ? "warning" : "neutral"}
        />
      </div>

      {/* 图表区 */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* 折线趋势 */}
        <Card className="flex flex-col">
          <CardHeader
            title="每日趋势"
            icon={<TrendingUp />}
            action={
              <Segmented
                size="sm"
                items={[
                  { value: "hours" as const, label: "工时" },
                  { value: "tasksDone" as const, label: "完成任务" },
                ]}
                value={metric}
                onChange={setMetric}
              />
            }
          />
          <CardBody className="flex flex-1 flex-col pt-0">
            <div className="min-h-[260px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  onClick={(s: unknown) => {
                    const label = (s as { activeLabel?: unknown })?.activeLabel;
                    if (typeof label === "string") openDayDetail(label);
                  }}
                  margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
                >
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={seriesColor} stopOpacity={0.26} />
                      <stop offset="100%" stopColor={seriesColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5).replace("-", "/")}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    allowDecimals={metric === "hours"}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: "var(--border-strong)" }}
                    labelFormatter={(v) => String(v)}
                    formatter={(value) => [
                      metric === "hours"
                        ? `${formatHours(Number(value))} 小时`
                        : `${value} 个`,
                      metric === "hours" ? "工时" : "完成",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke={seriesColor}
                    strokeWidth={2}
                    fill="url(#trendFill)"
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      strokeWidth: 2,
                      stroke: "var(--card)",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-center text-[11px] text-subtle-foreground">
              点击折线可查看当日明细
            </p>
          </CardBody>
        </Card>

        {/* 排行榜 */}
        <Card className="flex flex-col">
          <CardHeader
            title="任务耗时排行 Top 10"
            description="点击任意条目下钻查看明细"
            icon={<BarChart3 />}
          />
          <CardBody className="flex flex-1 flex-col pt-0">
            {ranking.length === 0 ? (
              <EmptyState
                icon={<BarChart3 />}
                title="区间内暂无工时数据"
                description="在「工时」模块填报记录后，这里会显示任务耗时排名。"
                className="border-0 py-10"
              />
            ) : (
              <ul className="space-y-2.5">
                {ranking.map((item, i) => (
                  <li key={`${item.taskId ?? item.title}-${i}`}>
                    <button
                      onClick={() => setDrill(item)}
                      className="group block w-full text-left"
                    >
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "tabular inline-flex size-4.5 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-semibold",
                              i === 0
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="truncate font-medium transition-colors group-hover:text-primary">
                            {item.title}
                          </span>
                          {item.projectName && (
                            <span className="hidden shrink-0 text-[10.5px] text-subtle-foreground sm:inline">
                              {item.projectName}
                            </span>
                          )}
                        </span>
                        <span className="tabular shrink-0 font-semibold">
                          {formatHours(item.totalHours)}h
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${(item.totalHours / maxRank) * 100}%`,
                            backgroundColor:
                              item.projectColor ?? CHART_SERIES[i % CHART_SERIES.length],
                          }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* 双环形图 */}
        <Card>
          <CardHeader title="占比分析" icon={<ChartPie />} />
          <CardBody className="pt-0">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MiniPie
                title="项目工时占比"
                data={projectDist.map((d) => ({ ...d }))}
                colorFn={(item, i) => item.color || CHART_SERIES[i % CHART_SERIES.length]}
                emptyText="暂无工时"
              />
              <MiniPie
                title="任务状态分布"
                data={statusDist.map((d) => ({
                  ...d,
                  name:
                    TASK_STATUS_LABELS[d.name as keyof typeof TASK_STATUS_LABELS] ?? d.name,
                }))}
                colorFn={(item) =>
                  STATUS_COLORS[statusColorMap[item.name] ?? ""] ?? CHART_SERIES[0]
                }
                emptyText="暂无任务"
              />
            </div>
          </CardBody>
        </Card>

        <HeatmapCard />
      </div>

      {/* 下钻：排行明细 */}
      <Dialog
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill ? `「${drill.title}」的工时记录` : ""}
        size="lg"
      >
        {drill && (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="pb-2 font-medium">日期</th>
                <th className="font-medium">备注</th>
                <th className="font-medium">来源</th>
                <th className="text-right font-medium">小时</th>
              </tr>
            </thead>
            <tbody>
              {drill.entries.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="tabular py-2.5">{e.date}</td>
                  <td className="max-w-48 truncate text-muted-foreground">{e.note ?? "—"}</td>
                  <td>
                    <Badge tone={e.source === "TIMER" ? "primary" : "neutral"}>
                      {e.source === "TIMER" ? "番茄钟" : "手动"}
                    </Badge>
                  </td>
                  <td className="tabular text-right">{formatHours(e.hours)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2.5" colSpan={3}>
                  合计
                </td>
                <td className="tabular pt-2.5 text-right">{formatHours(drill.totalHours)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Dialog>

      {/* 下钻：单日明细 */}
      <Dialog
        open={!!dayDetail}
        onClose={() => setDayDetail(null)}
        title={dayDetail ? `${dayDetail.date} 工时明细` : ""}
        size="lg"
      >
        {dayDetail &&
          (dayDetail.logs.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              当天没有工时记录
            </p>
          ) : (
            <ul className="space-y-1.5">
              {dayDetail.logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px]"
                >
                  <span className="min-w-0 truncate font-medium">
                    {l.task?.title ?? l.note ?? "工作记录"}
                  </span>
                  {l.note && l.task && (
                    <span className="truncate text-[11px] text-subtle-foreground">
                      {l.note}
                    </span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    {l.source === "TIMER" && (
                      <Badge tone="primary">
                        <Flame className="size-2.5" />
                        番茄钟
                      </Badge>
                    )}
                    <b className="tabular">{formatHours(l.hours)}h</b>
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </Dialog>
    </div>
  );
}

// ---------- 迷你环形图 ----------
function MiniPie({
  title,
  data,
  colorFn,
  emptyText,
}: {
  title: string;
  data: DistItem[];
  colorFn: (item: DistItem, i: number) => string;
  emptyText: string;
}) {
  const shown = data.filter((d) => d.value > 0);
  return (
    <div>
      <p className="mb-1 text-center text-[12px] font-medium">{title}</p>
      {shown.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-[11px] text-subtle-foreground">
          {emptyText}
        </p>
      ) : (
        <>
          <div style={{ height: 132 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                >
                  {shown.map((item, i) => (
                    <Cell key={i} fill={colorFn(item, i)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, n) => [`${formatHours(Number(v))} h`, String(n)]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 space-y-1">
            {shown.slice(0, 4).map((item, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorFn(item, i) }}
                />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="tabular text-subtle-foreground">
                  {formatHours(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
