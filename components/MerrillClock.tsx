"use client";

import { useMemo } from "react";
import EChart from "./charts/EChart";
import type { EChartsOption } from "echarts";

export default function MerrillClock({ growth, inflation }: { growth: number; inflation: number }) {
  const option = useMemo<EChartsOption>(() => {
    const quadrants = [
      { label: "复苏期", x: 6.5, y: 1, x0: 2, y0: -3, assets: "股票优先 · 债券次之", color: "#16a34a" },
      { label: "过热期", x: 6.5, y: 5, x0: 2, y0: 2, assets: "大宗商品 · 股票", color: "#dc2626" },
      { label: "滞胀期", x: 1.5, y: 5, x0: -1.5, y0: 2, assets: "现金 · 黄金", color: "#d97706" },
      { label: "衰退期", x: 1.5, y: 1, x0: -1.5, y0: -3, assets: "债券 · 现金", color: "#2563eb" },
    ];
    const markLine = [
      { xAxis: 3.5, label: { formatter: "增长 3.5%", position: "insideEndTop" as const }, lineStyle: { color: "#999", type: "dashed" as const } },
      { yAxis: 2, label: { formatter: "通胀 2%", position: "insideEndTop" as const }, lineStyle: { color: "#999", type: "dashed" as const } },
    ];
    return {
      tooltip: { trigger: "item", formatter: (p: any) => (p.data?.assets ? `<b>${p.data.name}</b><br/>${p.data.assets}` : `<b>当前位置</b><br/>增长 ${p.data.value[0]}% · 通胀 ${p.data.value[1]}%`) },
      grid: { left: 42, right: 20, top: 28, bottom: 34 },
      xAxis: { type: "value", name: "GDP 增长 (%)", min: -4, max: 12, axisLabel: { fontSize: 10 } },
      yAxis: { type: "value", name: "CPI 通胀 (%)", min: -4, max: 10, axisLabel: { fontSize: 10 } },
      series: [
        {
          type: "scatter",
          symbolSize: 40,
          label: { show: true, formatter: (p: any) => p.data?.name, position: "inside", fontSize: 13, fontWeight: 700, color: "#fff" },
          data: quadrants.map((q) => ({ name: q.label, value: [q.x, q.y], assets: q.assets, itemStyle: { color: q.color, opacity: 0.85, borderRadius: 8 } })),
          markLine: { symbol: "none", silent: true, data: markLine, label: { fontSize: 10, color: "#888" } },
        },
        {
          type: "scatter",
          symbolSize: 16,
          label: { show: true, formatter: "当前位置", position: "top", fontSize: 11, fontWeight: 600 },
          itemStyle: { color: "#111", borderColor: "#fff", borderWidth: 2 },
          data: [{ name: "当前", value: [Math.round(growth * 10) / 10, Math.round(inflation * 10) / 10] }],
        },
      ],
    };
  }, [growth, inflation]);

  return (
    <div className="space-y-2">
      <EChart option={option} height={440} />
      <p className="text-xs text-muted">
        美林投资时钟：以 GDP 增长（横轴）与 CPI 通胀（纵轴）划分四阶段，黑色点为当前宏观位置（最新真实数据）。
        顺时针依次经历复苏 → 过热 → 滞胀 → 衰退；象限标签为历史统计上的相对占优资产。
      </p>
    </div>
  );
}