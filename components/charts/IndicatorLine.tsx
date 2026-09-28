"use client";

import { useMemo, useState } from "react";
import EChart from "./EChart";
import ChartToolbar, { downloadCSV, type ChartType, type ChartRange } from "./ChartToolbar";
import { useChartPrefs } from "./chart-prefs";
import { ANIM_DURATION } from "@/lib/charts/theme";
import type { EChartsOption } from "echarts";

const r1 = (v: number) => Math.round(v * 100) / 100;

export default function IndicatorLine({
  title, unit, data, color = "#1d4ed8", hideToolbar,
}: {
  title: string; unit: string; data: Array<{ date: string; value: number }>;
  color?: string;
  /** 由外层提供全局控制条时隐藏本地图形工具条（避免一页出现几十个重复控件） */
  hideToolbar?: boolean;
}) {
  const shared = useChartPrefs();
  const [localType, setLocalType] = useState<ChartType>("line");
  const [localRange, setLocalRange] = useState<ChartRange>(36);
  const [localLog, setLocalLog] = useState(false);

  // 有全局控制条时订阅共享偏好，否则退回本卡状态（单图页面行为不变）
  const type = shared ? shared.prefs.type : localType;
  const range = shared ? shared.prefs.range : localRange;
  const log = shared ? shared.prefs.log : localLog;
  const setLocal = (p: { type?: ChartType; range?: ChartRange; log?: boolean }) => {
    if (p.type != null) setLocalType(p.type);
    if (p.range != null) setLocalRange(p.range);
    if (p.log != null) setLocalLog(p.log);
  };
  const onToolbar = (p: { type: ChartType; range: ChartRange; log: boolean }) => {
    if (shared) shared.set(p);
    else setLocal(p);
  };

  const sliced = useMemo(() => (range === 0 ? data : data.slice(-range)), [data, range]);
  const vals = sliced.map((d) => d.value);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const lastIdx = vals.length - 1;
  const canLog = vals.length > 0 && vals.every((v) => v > 0);

  const option: EChartsOption = useMemo(() => {
    const seriesType = type === "bar" ? "bar" : "line";
    const base: EChartsOption = {
      title: { text: title, left: 12, top: 6, textStyle: { fontSize: 14, fontWeight: 600 } },
      tooltip: {
        trigger: "axis",
        formatter: (ps: any) => {
          const p = Array.isArray(ps) ? ps[0] : ps;
          const idx = p.dataIndex;
          const cur = vals[idx];
          const prev = idx > 0 ? vals[idx - 1] : null;
          const dt = sliced[idx]?.date ?? "";
          const mom = prev != null ? r1(cur - prev) : null;
          return `<b>${dt}</b><br/>${cur} ${unit}${mom != null ? `<br/><span style="color:#6b6862">环比 ${mom >= 0 ? "+" : ""}${mom} ${unit}</span>` : ""}`;
        },
      },
      grid: { left: 48, right: 16, top: 48, bottom: 28 },
      xAxis: { type: "category", data: sliced.map((d) => d.date), axisLabel: { fontSize: 10 } },
      yAxis: {
        type: log && canLog ? "log" : "value", scale: true,
        splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } },
      },
      series: [{
        name: title || "指标", type: seriesType, data: vals, smooth: true, showSymbol: false,
        barMaxWidth: 14,
        lineStyle: { color, width: 2 },
        itemStyle: { color, borderRadius: type === "bar" ? [3, 3, 0, 0] : 0 },
        /* 仅「面积」模式带渐变填充；纯折线不加面积（修复折线误带面积的问题）。
           渐变尾部用主色 8 位 hex 透明（原 rgba(0,0,0,0) 黑色渐隐在深色下发黑） */
        areaStyle: type === "area"
          ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: `${color}00` }] } }
          : undefined,
        markLine: type === "bar" ? undefined : {
          symbol: "none", silent: true,
          lineStyle: { color: "#6e6e6e", type: "dashed", width: 1 },
          label: { formatter: `均值 ${r1(avg)}`, fontSize: 10, color: "#6e6e6e" },
          data: [{ yAxis: r1(avg) }],
        },
        markPoint: lastIdx >= 0 ? {
          symbol: "circle", symbolSize: 7, itemStyle: { color, borderColor: "#ffffff", borderWidth: 1.5 },
          label: {
            show: true,
            position: "top",
            distance: 6,
            fontSize: 11,
            fontWeight: 600,
            color,
            formatter: `${r1(vals[lastIdx])}`,
          },
          data: [{ name: "最新", coord: [sliced[lastIdx].date, vals[lastIdx]] }],
        } : undefined,
      }],
    };
    return base;
  }, [title, unit, sliced, vals, avg, lastIdx, type, log, canLog, color]);

  return (
    <div>
      {!hideToolbar && (
        <div className="flex justify-end mb-1">
          <ChartToolbar
            type={type} setType={(t) => onToolbar({ type: t, range, log })}
            range={range} setRange={(r) => onToolbar({ type, range: r, log })}
            log={log} setLog={(l) => onToolbar({ type, range, log: l })} canLog={canLog}
            onExport={() => downloadCSV(`${title || "indicator"}.csv`, ["date", "value"], sliced.map((d) => [d.date, d.value]))}
          />
        </div>
      )}
      <EChart option={option} height={280} />
    </div>
  );
}

export function TrendCard({ title, value, unit, yoy, mom, changeUnit, hideToolbar, data, color, note, source }: {
  title: string; value: number; unit: string; yoy?: number | null; mom?: number | null;
  /** 同比/环比变动的单位（"个百分点" / "%" / "点"），由调用方按指标性质声明 */
  changeUnit?: string;
  /** 隐藏本卡工具条（外层已提供全局控制条时用） */
  hideToolbar?: boolean;
  data: Array<{ date: string; value: number }>; color?: string; note?: string; source?: string;
}) {
  const shared = useChartPrefs();
  // 区间摘要必须跟随全局周期，否则「统一看 60 期」时卡片上仍写「近 36 期」
  const range = shared ? shared.prefs.range : 36;
  const win = range === 0 ? data : data.slice(-range);
  const spanLabel = range === 0 ? `全部 ${data.length} 期` : `近 ${range} 期`;
  const vals = win.map((d) => d.value).filter((v) => Number.isFinite(v));
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  const minD = vals.length ? (win.find((d) => d.value === min)?.date ?? "") : "";
  const maxD = vals.length ? (win.find((d) => d.value === max)?.date ?? "") : "";
  // 数值统一保留 2 位：上游 GDP 季度值形如 4.6666666666666665，直接渲染会把浮点噪声暴露给用户
  const n2 = (v: number) => Number(v.toFixed(2));
  const cu = changeUnit ?? "个百分点";
  const tag = (v?: number | null) =>
    v == null ? null : `${v >= 0 ? "+" : ""}${n2(v)}${cu === "%" ? "%" : " " + cu}`;
  // 季度类指标的 date 文本形如 "2023-Q3"；若上游混入小数（如 2023-Q3.6666…）只保留季度标记
  const cleanDate = (s: string) => (/^[\d]{4}(-\d{2}(-\d{2})?|Q[1-4])$/.test(s) ? s : s.split(/[.,]/)[0]);
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-sm text-muted">{title}</p>
        <div className="flex items-center gap-2 shrink-0">
          {yoy != null && (
            <span title={`同比变化（${cu}）`} className={`text-xs font-mono ${yoy >= 0 ? "up" : "down"}`}>同比 {tag(yoy)}</span>
          )}
          {mom != null && (
            <span title={`环比变化（${cu}）`} className={`text-xs font-mono ${mom >= 0 ? "up" : "down"}`}>环比 {tag(mom)}</span>
          )}
        </div>
      </div>
      <p className="text-2xl font-bold font-mono mb-1">{value}<span className="text-sm font-normal text-muted ml-1">{unit}</span></p>
      <p className="text-[11px] text-muted mb-2 truncate">
        {spanLabel}区间 {n2(min)}（{cleanDate(minD)}）— {n2(max)}（{cleanDate(maxD)}）{note ? ` · ${note}` : ""}{source ? ` · ${source}` : ""}
      </p>
      <IndicatorLine title="" unit={unit} data={data} color={color} hideToolbar={hideToolbar || !!shared} />
    </div>
  );
}