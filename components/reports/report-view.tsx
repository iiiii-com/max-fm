"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDaysYmd, formatHours, todayYmd, weekStartYmd } from "@/lib/date";
import { TASK_STATUS_LABELS } from "@/lib/labels";
import { HeatmapCard } from "@/components/reports/heatmap-card";

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
      // 季度末若在未来，结束仍取今天
      return [qs, today];
    }
    default:
      return [today, today];
  }
}

// ---------- 颜色 ----------
const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
];
const STATUS_COLORS: Record<string, string> = {
  TODO: "#94a3b8",
  IN_PROGRESS: "#6366f1",
  DONE: "#10b981",
};
const ATTEND_COLORS: Record<string, string> = {
  NORMAL: "#10b981",
  LATE: "#f59e0b",
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--card-foreground)",
};

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

// ---------- 主组件 ----------
export function ReportView() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [from, to] = useMemo(
    () => (preset === "custom" && customFrom && customTo
      ? ([customFrom, customTo] as [string, string])
      : rangeFor(preset === "custom" ? "30d" : preset)),
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
      getJSON<{ data?: Kpi } & Kpi>(`/api/reports/kpi?${qs}`),
      getJSON<{ points: TrendPoint[] }>(`/api/reports/trend?${qs}`),
      getJSON<{ ranking: RankItem[] }>(`/api/reports/ranking?${qs}`),
      getJSON<{ items: DistItem[] }>(`/api/reports/distribution?dim=project&${qs}`),
    ]);
    const sd = await getJSON<{ items: DistItem[] }>(
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
    const d = await getJSON<{ logs: DayLog[] }>(
      `/api/timelogs?from=${date}&to=${date}`
    );
    setDayDetail({ date, logs: d?.logs ?? [] });
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      setPreset("custom");
    }
  }

  const kpiCards = [
    { icon: Clock3, label: "总工时（小时）", value: kpi ? formatHours(kpi.hoursTotal) : "…", cls: "" },
    { icon: CheckCircle2, label: "完成任务", value: kpi?.tasksCompleted ?? "…", cls: "text-success" },
    { icon: CircleDot, label: "进行中", value: kpi?.tasksActive ?? "…", cls: "text-primary" },
    { icon: AlertTriangle, label: "已逾期未完", value: kpi?.overdue ?? "…", cls: kpi?.overdue ? "text-destructive" : "" },
    { icon: CalendarCheck2, label: "出勤天数", value: kpi?.attendanceDays ?? "…", cls: "" },
    { icon: AlarmClock, label: "迟到次数", value: kpi?.lateCount ?? "…", cls: kpi?.lateCount ? "text-warning" : "" },
  ];

  const maxRank = ranking[0]?.totalHours ?? 1;

  return (
    <div className="space-y-5">
      {/* 时间筛选器 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs transition-colors sm:text-sm",
                preset === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-36 text-xs" />
          <span className="text-xs text-muted-foreground">至</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-36 text-xs" />
          <Button variant="outline" size="sm" onClick={applyCustom}>
            应用
          </Button>
          {preset === "custom" && (
            <span className="ml-1 text-xs text-muted-foreground">
              自定义区间生效中
            </span>
          )}
        </div>
        <span className="ml-auto hidden text-xs tabular-nums text-muted-foreground md:block">
          统计区间：{from} ~ {to}
        </span>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <c.icon className={cn("size-3.5", c.cls)} />
              {c.label}
            </div>
            <p className={cn("mt-1.5 text-2xl font-bold tabular-nums tracking-tight", c.cls)}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* 图表区 */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* 折线趋势 */}
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp className="size-4 text-primary" />
              每日趋势
            </h3>
            <div className="flex rounded-md border bg-secondary/50 p-0.5 text-xs">
              {(["hours", "tasksDone"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={cn(
                    "rounded px-2 py-1 transition-colors",
                    metric === m ? "bg-card shadow-sm font-medium" : "text-muted-foreground"
                  )}
                >
                  {m === "hours" ? "工时" : "完成任务"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                onClick={(s: unknown) => {
                  const label = (s as { activeLabel?: unknown })?.activeLabel;
                  if (typeof label === "string") openDayDetail(label);
                }}
                margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#88888822" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5).replace("-", "/")}
                  tick={{ fill: "#7c8595", fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis tick={{ fill: "#7c8595", fontSize: 10 }} allowDecimals={metric === "hours"} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(v) => String(v)}
                  formatter={(value) => [
                    metric === "hours" ? `${formatHours(Number(value))} 小时` : `${value} 个`,
                    metric === "hours" ? "工时" : "完成",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke={metric === "hours" ? "#6366f1" : "#10b981"}
                  strokeWidth={2}
                  dot={{ r: trend.length <= 31 ? 3 : 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">
            点击折线上的点可查看当日明细 ↓
          </p>
        </div>

        {/* 排行榜（可下钻） */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <BarChart3 className="size-4 text-warning" />
            任务耗时排行 Top10
          </h3>
          {ranking.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">区间内暂无工时数据</p>
          ) : (
            <ul className="space-y-2">
              {ranking.map((item, i) => (
                <li key={`${item.taskId ?? item.title}-${i}`}>
                  <button
                    onClick={() => setDrill(item)}
                    className="group w-full text-left"
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium group-hover:text-primary">
                        <span className="mr-1.5 inline-flex size-4 items-center justify-center rounded-full bg-secondary text-[10px] tabular-nums">
                          {i + 1}
                        </span>
                        {item.title}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatHours(item.totalHours)}h
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.totalHours / maxRank) * 100}%`,
                          backgroundColor: item.projectColor ?? PALETTE[i % PALETTE.length],
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 双环形图 */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <ChartPie className="size-4 text-success" />
            占比分析
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <MiniPie
              title="项目工时占比"
              data={projectDist.map((d) => ({ ...d }))}
              colorFn={(item, i) => item.color || PALETTE[i % PALETTE.length]}
              emptyText="暂无工时"
            />
            <MiniPie
              title="任务状态分布"
              data={statusDist.map((d) => ({
                ...d,
                name: TASK_STATUS_LABELS[d.name as keyof typeof TASK_STATUS_LABELS] ?? d.name,
              }))}
              colorFn={(item) =>
                STATUS_COLORS[
                  Object.keys(TASK_STATUS_LABELS).find(
                    (k) => TASK_STATUS_LABELS[k as keyof typeof TASK_STATUS_LABELS] === item.name
                  ) ?? ""
                ] ?? PALETTE[0]
              }
              emptyText="暂无任务"
            />
          </div>
        </div>

        {/* 热力图 */}
        <HeatmapCard />
      </div>

      {/* 下钻：排行明细 */}
      <Dialog open={!!drill} onClose={() => setDrill(null)} title={`「${drill?.title ?? ""}」的工时记录`} wide>
        {drill && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">日期</th>
                <th>备注</th>
                <th>来源</th>
                <th className="text-right">小时</th>
              </tr>
            </thead>
            <tbody>
              {drill.entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 tabular-nums">{e.date}</td>
                  <td className="max-w-40 truncate text-muted-foreground">{e.note ?? "-"}</td>
                  <td>
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px]", e.source === "TIMER" ? "bg-primary/10 text-primary" : "bg-muted")}>
                      {e.source === "TIMER" ? "番茄钟" : "手动"}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{formatHours(e.hours)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="pt-2" colSpan={3}>
                  合计
                </td>
                <td className="pt-2 text-right tabular-nums">{formatHours(drill.totalHours)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Dialog>

      {/* 下钻：单日明细 */}
      <Dialog open={!!dayDetail} onClose={() => setDayDetail(null)} title={`${dayDetail?.date ?? ""} 工时明细`} wide>
        {dayDetail &&
          (dayDetail.logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">当天没有工时记录</p>
          ) : (
            <ul className="space-y-2">
              {dayDetail.logs.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">{l.task?.title ?? l.note ?? "工作记录"}</span>
                  {l.note && l.task && (
                    <span className="truncate text-xs text-muted-foreground">{l.note}</span>
                  )}
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    {l.source === "TIMER" && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">番茄钟</span>
                    )}
                    <b className="tabular-nums text-foreground">{formatHours(l.hours)}h</b>
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
      <p className="mb-1 text-center text-xs font-medium text-muted-foreground">{title}</p>
      {shown.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-xs text-muted-foreground/60">
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
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={2}
                  stroke="none"
                >
                  {shown.map((item, i) => (
                    <Cell key={i} fill={colorFn(item, i)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [String(v), String(n)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 space-y-0.5">
            {shown.slice(0, 4).map((item, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorFn(item, i) }} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="tabular-nums text-muted-foreground">{formatHours(item.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
