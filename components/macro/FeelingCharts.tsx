"use client";

import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { SectionTitle, Card } from "@/components/ui";

export interface TempFeelingPoint {
  month: string;
  macro: number | null;
  feeling: number | null;
  count: number;
}

export function TempFeelingTrend({ points }: { points: TempFeelingPoint[] }) {
  const hasFeeling = points.some((p) => p.feeling != null);
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params];
        const idx = arr[0]?.dataIndex ?? 0;
        const p = points[idx];
        if (!p) return "";
        const fmt = (v: number | null) => (v == null ? "—" : `${Math.round(v * 10) / 10}°`);
        return [
          `<b>${p.month}</b>`,
          `宏观温度：${fmt(p.macro)}`,
          `大众体感：${fmt(p.feeling)}${p.feeling == null ? "（当月无问卷）" : ""}`,
          `样本：${p.count} 份`,
        ].join("<br/>");
      },
    },
    legend: { data: ["宏观温度", "大众体感（月均）"], top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 46, top: 32, bottom: 26 },
    xAxis: { type: "category", data: points.map((p) => p.month), axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: "value", name: "温度", min: 0, max: 100, splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } } },
      { type: "value", name: "样本", min: 0, splitLine: { show: false }, axisLabel: { show: false } },
    ],
    series: [
      {
        name: "样本量",
        type: "bar",
        yAxisIndex: 1,
        data: points.map((p) => p.count),
        barWidth: 10,
        itemStyle: { color: "#e5e0d5" },
        z: 0,
      },
      {
        name: "宏观温度",
        type: "line",
        data: points.map((p) => p.macro),
        smooth: true,
        symbolSize: 6,
        connectNulls: false,
        lineStyle: { color: "#1d4ed8", width: 2.5 },
        itemStyle: { color: "#1d4ed8" },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: "#9ca3af", type: "dashed" },
          label: { formatter: "中性线 50°", fontSize: 10, color: "#9ca3af" },
          data: [{ yAxis: 50 }],
        },
      },
      {
        name: "大众体感（月均）",
        type: "line",
        data: points.map((p) => p.feeling),
        smooth: true,
        symbolSize: 7,
        symbol: "diamond",
        connectNulls: false,
        lineStyle: { color: "#b45309", width: 2.5, type: "dashed" },
        itemStyle: { color: "#b45309" },
      },
    ],
  };

  return (
    <Card>
      <SectionTitle
        title="宏观温度 vs 大众体感 · 月度对照"
        sub={
          hasFeeling
            ? "两条线都来自真实数据：宏观线按月留存，体感线由当月问卷均分聚合（空月断开、不推导）"
            : "体感线需要按月聚合的问卷数据；当前月份样本会累计，跨月后自动生成历史点"
        }
      />
      <EChart option={option} height={300} />
      <p className="mt-2 text-[10px] text-muted leading-relaxed">
        样本量柱为当月有效问卷数。体感均值来自本站问卷（0–100 分），不是 GDP/CPI 推导值；
        当月无问卷或样本不足时断开，避免用宏观线伪造体感。
      </p>
    </Card>
  );
}

export function FeelingDistribution({
  buckets,
  total,
}: {
  buckets: Array<{ bucket: string; count: number }>;
  total: number;
}) {
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 16, top: 16, bottom: 26 },
    xAxis: { type: "category", data: buckets.map((b) => b.bucket), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } } },
    series: [
      {
        type: "bar",
        data: buckets.map((b) => b.count),
        barWidth: "55%",
        itemStyle: { color: "#0d9488", borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: "top", fontSize: 10, color: "#6b6862" },
      },
    ],
  };
  return (
    <Card>
      <SectionTitle title="体感分数分布" sub={`共 ${total} 份有效问卷 · 10 分一档（分数越高体感越暖）`} />
      <EChart option={option} height={240} />
    </Card>
  );
}
