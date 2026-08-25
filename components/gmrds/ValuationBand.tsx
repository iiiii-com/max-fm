"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

export interface ValuationBandItem {
  name: string; // 标的
  pe: number | null; // 当前 PE（真实接口值，null 表示未接入）
  band: [number, number]; // 合理区间（低, 高）
  note?: string;
}

/**
 * 估值区间测算：当前估值 vs 合理区间（条形带）
 * 当前 PE 用真实接口值；合理区间为基于方法论的测算输入。
 */
export default function ValuationBand({
  items,
  title,
  caption,
}: {
  items: ValuationBandItem[];
  title?: string;
  caption?: string;
}) {
  const option = useMemo<EChartsOption>(() => {
    const names = items.map((i) => i.name);
    const maxV = Math.max(...items.map((i) => i.band[1] * 1.25));
    return {
      animation: false,
      grid: { left: 74, right: 24, top: 30, bottom: 24 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#cbd5e1",
        textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const it = items[i];
          const pe = it.pe != null ? `${it.pe} 倍` : "未接入";
          return `<b>${it.name}</b><br/>当前 PE：${pe}<br/>合理区间：${it.band[0]}~${it.band[1]} 倍${it.note ? `<br/><span style="color:#64748b;font-size:11px">${it.note}</span>` : ""}`;
        },
      },
      xAxis: {
        type: "value",
        max: maxV,
        name: "PE（倍）",
        nameLocation: "middle",
        nameGap: 24,
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: "合理区间",
          type: "bar",
          data: items.map((i) => [i.band[0], i.band[1] - i.band[0]]),
          barWidth: 18,
          itemStyle: { color: "rgba(99,102,241,0.35)", borderRadius: 4 },
        },
        {
          name: "当前PE",
          type: "scatter",
          data: items.map((i) => [i.pe, i.name]),
          symbolSize: 10,
          itemStyle: { color: (p: any) => (p.value?.[0] == null ? "#94a3b8" : p.value[0] > items[p.dataIndex].band[1] ? "#d7000b" : p.value[0] < items[p.dataIndex].band[0] ? "#0aa06e" : "#3b82f6") },
        },
      ],
    };
  }, [items]);

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      {title && <p className="text-sm font-bold mb-1">{title}</p>}
      <EChart option={option} height={Math.max(180, items.length * 56)} />
      {caption && <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">{caption}</figcaption>}
    </figure>
  );
}
