"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

export interface PctPoint {
  year: string;
  pct: number;
}

/**
 * 近 5 年全球市场对比 · 年度涨跌柱状图（真实数据）
 * 上证综指（红）vs 标普500（蓝），涨红跌绿遵循国内惯例。
 */
export default function MarketCompareChart({ cn, us, title = "近 5 年年度涨跌对比" }: { cn: PctPoint[]; us: PctPoint[]; title?: string }) {
  const option = useMemo<EChartsOption>(() => {
    const years = cn.map((d) => d.year);
    return {
      animation: false,
      grid: { left: 44, right: 16, top: 44, bottom: 28 },
      legend: {
        top: 6,
        right: 8,
        textStyle: { fontSize: 11 },
        data: ["上证综指", "标普500"],
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#cbd5e1",
        textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const y = arr[0]?.axisValue ?? "";
          const rows = arr
            .map((p: any) => `${p.marker}${p.seriesName}：<b>${p.value != null ? p.value.toFixed(1) + "%" : "—"}</b>`)
            .join("<br/>");
          return `<b>${y} 年</b><br/>${rows}`;
        },
      },
      xAxis: {
        type: "category",
        data: years,
        axisLabel: { fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#292929", type: "dashed" } },
      },
      series: [
        {
          name: "上证综指",
          type: "bar",
          data: cn.map((d) => d.pct),
          barWidth: "32%",
          itemStyle: {
            color: (p: any) => (p.value >= 0 ? "#dc2626" : "#16a34a"),
            borderRadius: [3, 3, 0, 0],
          },
          label: { show: true, position: "top", fontSize: 10, color: "#334155", formatter: (p: any) => `${p.value.toFixed(1)}%` },
        },
        {
          name: "标普500",
          type: "bar",
          data: us.map((d) => d.pct),
          barWidth: "32%",
          itemStyle: {
            color: (p: any) => (p.value >= 0 ? "#3b82f6" : "#64748b"),
            borderRadius: [3, 3, 0, 0],
          },
          label: { show: true, position: "bottom", fontSize: 10, color: "#64748b", formatter: (p: any) => `${p.value.toFixed(1)}%` },
        },
      ],
    };
  }, [cn, us]);

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold mb-1">{title}</p>
      <EChart option={option} height={300} />
      <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">
        <b className="text-foreground">图注：</b>年度收盘口径涨跌幅（上证取腾讯日线年末值；标普500 取 us-market 年度收盘）。
        2022 年全球同步回撤（宏观紧缩 + 流动性收紧共振），2024-25 年 A 股政策反转与美股分化上行——宏观与流动性方向（环节 1/2）先行决定资产偏好。
      </figcaption>
    </figure>
  );
}
