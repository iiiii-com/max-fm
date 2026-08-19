"use client";

import EChart from "./EChart";
import type { EChartsOption } from "echarts";

const r1 = (v: number) => Math.round(v * 100) / 100;

export default function IndicatorLine({
  title, unit, data, color = "#2563eb",
}: { title: string; unit: string; data: Array<{ date: string; value: number }>; color?: string }) {
  const vals = data.map((d) => d.value);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const lastIdx = vals.length - 1;
  const option: EChartsOption = {
    title: { text: title, left: 12, top: 6, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: {
      trigger: "axis",
      formatter: (ps: any) => {
        const p = Array.isArray(ps) ? ps[0] : ps;
        const idx = p.dataIndex;
        const cur = vals[idx];
        const prev = idx > 0 ? vals[idx - 1] : null;
        const dt = data[idx]?.date ?? "";
        const mom = prev != null ? r1(cur - prev) : null;
        return `<b>${dt}</b><br/>${cur} ${unit}${mom != null ? `<br/><span style="color:#999">环比 ${mom >= 0 ? "+" : ""}${mom} ${unit}</span>` : ""}`;
      },
    },
    grid: { left: 48, right: 16, top: 48, bottom: 28 },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
    series: [{
      type: "line", data: vals, smooth: true, showSymbol: false,
      lineStyle: { color, width: 2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: "rgba(0,0,0,0)" }] } },
      markLine: {
        symbol: "none", silent: true,
        lineStyle: { color: "#a3a3a3", type: "dashed", width: 1 },
        label: { formatter: `均值 ${r1(avg)}`, fontSize: 10, color: "#a3a3a3" },
        data: [{ yAxis: r1(avg) }],
      },
      markPoint: {
        symbol: "circle", symbolSize: 7, itemStyle: { color },
        label: { show: false },
        data: lastIdx >= 0 ? [{ name: "最新", coord: [data[lastIdx].date, vals[lastIdx]] }] : [],
      },
    }],
  };
  return <EChart option={option} height={280} />;
}

export function TrendCard({ title, value, unit, yoy, mom, data, color, note }: {
  title: string; value: number; unit: string; yoy?: number | null; mom?: number | null;
  data: Array<{ date: string; value: number }>; color?: string; note?: string;
}) {
  const win = data.slice(-36);
  const vals = win.map((d) => d.value);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  const minD = vals.length ? win[vals.indexOf(min)]?.date : "";
  const maxD = vals.length ? win[vals.indexOf(max)]?.date : "";
  const tag = (v?: number | null, suffix = "pct") =>
    v == null ? null : `${v >= 0 ? "+" : ""}${v}${suffix}`;
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-sm text-muted">{title}</p>
        <div className="flex items-center gap-2 shrink-0">
          {yoy != null && (
            <span title="同比变化（百分点）" className={`text-xs font-mono ${yoy >= 0 ? "up" : "down"}`}>同比 {tag(yoy)}</span>
          )}
          {mom != null && (
            <span title="环比变化（百分点）" className={`text-xs font-mono ${mom >= 0 ? "up" : "down"}`}>环比 {tag(mom)}</span>
          )}
        </div>
      </div>
      <p className="text-2xl font-bold font-mono mb-1">{value}<span className="text-sm font-normal text-muted ml-1">{unit}</span></p>
      <p className="text-[11px] text-muted mb-2 truncate">
        近 36 期区间 {min}（{minD}）— {max}（{maxD}）{note ? ` · ${note}` : ""}
      </p>
      <IndicatorLine title="" unit={unit} data={data.slice(-36)} color={color} />
    </div>
  );
}
