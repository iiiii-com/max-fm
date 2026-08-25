"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

export interface RadarDim {
  name: string;
  max: number;
}
export interface RadarSeries {
  name: string;
  values: number[];
  color: string;
}

/**
 * 多维评估雷达图（企业前景 / 财务质量 / 市场风险等通用）
 * 用于可视化对比：如「优质公司 vs 造假公司」财务质量、行业多维评分等。
 */
export default function RadarChart({
  dims,
  series,
  title,
  caption,
}: {
  dims: RadarDim[];
  series: RadarSeries[];
  title?: string;
  caption?: string;
}) {
  const option = useMemo<EChartsOption>(() => {
    return {
      animation: false,
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#cbd5e1",
        textStyle: { color: "#1e293b", fontSize: 12 },
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11 },
        data: series.map((s) => s.name),
      },
      radar: {
        indicator: dims,
        radius: "64%",
        center: ["50%", "46%"],
        axisName: { fontSize: 11, color: "#475569" },
        splitArea: { areaStyle: { color: ["rgba(100,116,139,0.03)", "rgba(100,116,139,0.06)"] } },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series: [
        {
          type: "radar",
          data: series.map((s) => ({
            name: s.name,
            value: s.values,
            lineStyle: { color: s.color, width: 2 },
            itemStyle: { color: s.color },
            areaStyle: { color: s.color, opacity: 0.12 },
            symbolSize: 3,
          })),
        },
      ],
    };
  }, [dims, series]);

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      {title && <p className="text-sm font-bold mb-1">{title}</p>}
      <EChart option={option} height={300} />
      {caption && <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">{caption}</figcaption>}
    </figure>
  );
}
