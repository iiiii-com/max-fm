"use client";

import EChart from "./EChart";
import type { EChartsOption } from "echarts";

export default function IndicatorLine({
  title, unit, data, color = "#2563eb",
}: { title: string; unit: string; data: Array<{ date: string; value: number }>; color?: string }) {
  const option: EChartsOption = {
    title: { text: title, left: 12, top: 6, textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => `${v} ${unit}`,
    },
    grid: { left: 48, right: 16, top: 48, bottom: 28 },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
    series: [{
      type: "line", data: data.map((d) => d.value), smooth: true, showSymbol: false,
      lineStyle: { color, width: 2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: "rgba(0,0,0,0)" }] } },
    }],
  };
  return <EChart option={option} height={280} />;
}

export function TrendCard({ title, value, unit, delta, data, color }: {
  title: string; value: number; unit: string; delta?: number; data: Array<{ date: string; value: number }>; color?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-sm text-muted">{title}</p>
        {delta !== undefined && <span className={`text-xs font-mono ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "+" : ""}{delta}</span>}
      </div>
      <p className="text-2xl font-bold font-mono mb-2">{value}<span className="text-sm font-normal text-muted ml-1">{unit}</span></p>
      <IndicatorLine title="" unit={unit} data={data.slice(-36)} color={color} />
    </div>
  );
}