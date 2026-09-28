"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

export interface DrawdownPoint {
  date: string;
  dd: number; // 回撤百分比（负值）
}

/**
 * 回撤曲线与风险统计（环节 9 风险评估实操）
 * 用真实行情自算：年化收益 / 年化波动 / 夏普 / 最大回撤 / 回撤持续。
 */
export default function DrawdownChart({
  ddSeries,
  stats,
  title,
  caption,
}: {
  ddSeries: DrawdownPoint[];
  stats: { label: string; value: string; tone?: "up" | "down" | "plain" }[];
  title?: string;
  caption?: string;
}) {
  const option = useMemo<EChartsOption>(() => {
    return {
      animation: false,
      grid: { left: 46, right: 16, top: 16, bottom: 26 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#e2e0dc",
        textStyle: { color: "#e2e0dc", fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const p = ddSeries[i];
          if (!p) return "";
          return `<b>${p.date}</b><br/>回撤 <b style="color:#c0392b">${p.dd.toFixed(2)}%</b>`;
        },
      },
      xAxis: {
        type: "category",
        data: ddSeries.map((d) => d.date),
        axisLabel: { fontSize: 10, interval: Math.floor(ddSeries.length / 6) },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#f4f3f0" } },
        max: 2,
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 14, bottom: 2, start: 0, end: 100 },
      ],
      series: [
        {
          name: "回撤",
          type: "line",
          data: ddSeries.map((d) => d.dd),
          showSymbol: false,
          lineStyle: { color: "#c0392b", width: 1.2 },
          areaStyle: { color: "rgba(215,0,11,0.12)" },
        },
      ],
    };
  }, [ddSeries]);

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      {title && <p className="text-sm font-bold mb-2">{title}</p>}
      <div className="flex flex-wrap gap-2 mb-3">
        {stats.map((s) => (
          <span key={s.label} className="inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background/60 text-xs">
            <span className="text-muted">{s.label}</span>
            <b style={{ color: s.tone === "up" ? "#c0392b" : s.tone === "down" ? "#1e8449" : "var(--foreground)" }}>{s.value}</b>
          </span>
        ))}
      </div>
      <EChart option={option} height={240} />
      {caption && <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">{caption}</figcaption>}
    </figure>
  );
}
