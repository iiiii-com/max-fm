"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

export interface PctPoint {
  year: string;
  pct: number;
}

/**
 * 年度涨跌对比柱状图（真实数据，按年份对齐）。
 *
 * 之前的坑：x 轴直接取 cn.map(year)、us 序列按数组位置塞数据。
 * 两条序列年份对不齐时（一端缺 2021、另一端从 2021 开始）不但标普 2021 显示 0%，
 * 后面每一年都会整体错位——图上看起来就是「标普 500 的柱子串到了上证的年份上」。
 * 所以这里必须按年份 join：并集做 x 轴，缺的年份给 null（显示「—」），绝不按位置对齐。
 */
export default function MarketCompareChart({
  cn,
  us,
  title = "近 5 年年度涨跌对比",
  note,
}: {
  cn: PctPoint[];
  us: PctPoint[];
  title?: string;
  note?: string;
}) {
  const solved = useMemo(() => {
    const years = Array.from(new Set([...cn.map((d) => d.year), ...us.map((d) => d.year)])).sort();
    const cnMap = new Map(cn.map((d) => [d.year, d.pct]));
    const usMap = new Map(us.map((d) => [d.year, d.pct]));
    return {
      years,
      cn: years.map((y) => (cnMap.has(y) ? Number(cnMap.get(y)!.toFixed(2)) : null)),
      us: years.map((y) => (usMap.has(y) ? Number(usMap.get(y)!.toFixed(2)) : null)),
    };
  }, [cn, us]);

  const option = useMemo<EChartsOption>(() => {
    const pctLabel = (p: any) => (p.value == null ? "—" : `${Number(p.value).toFixed(1)}%`);
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
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const y = arr[0]?.axisValue ?? "";
          const rows = arr
            .map((p: any) => `${p.marker}${p.seriesName}：<b>${p.value != null ? Number(p.value).toFixed(2) + "%" : "—"}</b>`)
            .join("<br/>");
          return `<b>${y} 年</b><br/>${rows}`;
        },
      },
      xAxis: {
        type: "category",
        data: solved.years,
        axisLabel: { fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } },
      },
      series: [
        {
          name: "上证综指",
          type: "bar",
          data: solved.cn,
          barWidth: "32%",
          itemStyle: {
            color: (p: any) => (p.value == null ? "#cbd5e1" : p.value >= 0 ? "#c0392b" : "#1e8449"),
            borderRadius: [3, 3, 0, 0],
          },
          label: { show: true, position: "top", fontSize: 10, color: "#334155", formatter: pctLabel },
        },
        {
          name: "标普500",
          type: "bar",
          data: solved.us,
          barWidth: "32%",
          itemStyle: {
            color: (p: any) => (p.value == null ? "#cbd5e1" : p.value >= 0 ? "#1d4ed8" : "#6b6862"),
            borderRadius: [3, 3, 0, 0],
          },
          label: { show: true, position: "bottom", fontSize: 10, color: "#6b6862", formatter: pctLabel },
        },
      ],
    };
  }, [solved]);

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold mb-1">{title}</p>
      <EChart option={option} height={300} />
      <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">
        <b className="text-foreground">图注：</b>
        年度收盘口径涨跌幅（上证取腾讯日线年末收盘；标普500 取 us-market 年度收盘）。
        {note ? <> {note}</> : null}
      </figcaption>
    </figure>
  );
}
