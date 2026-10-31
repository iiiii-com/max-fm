"use client";

import Link from "next/link";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { Badge, Card, SectionTitle } from "@/components/ui";

export interface TemperatureBoardProps {
  temperature: number | null;
  date: string | null;
  raw: { pmi: number | null; cpi: number | null; m2: number | null };
  scores: { pmi: number; cpi: number; m2: number };
  series: Array<{ date: string; temperature: number }>;
  feeling: { overall: number | null; sampleCount: number; diff: number | null };
}

const HEAT_STEPS: Array<{ max: number; label: string; color: string; tone: "green" | "blue" | "amber" | "red" | "gray" }> = [
  { max: 35, label: "偏冷", color: "#1d4ed8", tone: "blue" },
  { max: 45, label: "中性偏冷", color: "#0d9488", tone: "green" },
  { max: 55, label: "中性", color: "#6b6862", tone: "gray" },
  { max: 65, label: "中性偏暖", color: "#b45309", tone: "amber" },
  { max: 75, label: "偏暖", color: "#c0392b", tone: "red" },
  { max: 101, label: "偏热", color: "#7c2d12", tone: "red" },
];

function heatOf(t: number | null) {
  return t == null ? { label: "暂无读数", color: "#6b6862", tone: "gray" as const } : HEAT_STEPS.find((s) => t < s.max)!;
}

export default function TemperatureBoard({ temperature, date, raw, scores, series, feeling }: TemperatureBoardProps) {
  const heat = heatOf(temperature);
  const factors: Array<{ key: string; label: string; raw: string; score: number; weight: string }> = [
    { key: "pmi", label: "制造业 PMI", raw: raw.pmi == null ? "—" : String(raw.pmi), score: scores.pmi, weight: "40%" },
    { key: "cpi", label: "CPI 同比", raw: raw.cpi == null ? "—" : `${raw.cpi}%`, score: scores.cpi, weight: "35%" },
    { key: "m2", label: "M2 同比", raw: raw.m2 == null ? "—" : `${raw.m2}%`, score: scores.m2, weight: "25%" },
  ];

  const option: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v: any) => `${v}°` },
    grid: { left: 40, right: 16, top: 20, bottom: 26 },
    xAxis: {
      type: "category",
      data: series.map((p) => p.date),
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } },
    },
    series: [
      {
        type: "line",
        data: series.map((p) => p.temperature),
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: heat.color, width: 2 },
        itemStyle: { color: heat.color },
        areaStyle: { color: heat.color, opacity: 0.08 },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: "#9ca3af", type: "dashed" },
          label: { formatter: "中性线 50°", fontSize: 10, color: "#9ca3af" },
          data: [{ yAxis: 50 }],
        },
      },
    ],
  };

  return (
    <section>
      <SectionTitle
        title="宏观温度 · 三因子拆解"
        sub="温度 = 0.4×PMI 得分 + 0.35×CPI 得分 + 0.25×M2 得分（0–100，越高越暖）；左侧是读数与拆解，右侧是近 12 个月轨迹"
        extra={
          <Link href="/macro/feeling" className="text-xs text-primary hover:underline">
            对比大众体感 →
          </Link>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-end justify-between gap-2 flex-wrap">
            <div>
              <p className="text-[11px] text-muted mb-0.5">当前宏观温度{date ? ` · ${date}` : ""}</p>
              <p className="text-4xl font-bold font-mono tabular-nums" style={{ color: heat.color }}>
                {temperature == null ? "—" : temperature}
                <span className="text-base font-normal text-muted ml-1">°</span>
              </p>
            </div>
            <div className="text-right">
              <Badge tone={heat.tone}>{heat.label}</Badge>
              {feeling.overall != null && feeling.sampleCount > 0 && feeling.diff != null ? (
                <p className="text-[11px] text-muted mt-1">
                  体感 {Math.round(Number(feeling.overall))}°（{feeling.sampleCount} 份）· 温差{" "}
                  <span className={feeling.diff >= 0 ? "up" : "down"}>
                    {feeling.diff > 0 ? "+" : ""}
                    {feeling.diff}°
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-muted mt-1">体感样本不足，温差暂不可计算</p>
              )}
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {factors.map((f) => (
              <li key={f.key}>
                <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                  <span>
                    {f.label} <span className="font-mono text-muted/80">{f.raw}</span>
                  </span>
                  <span className="font-mono">
                    {f.score} 分 · 权重 {f.weight}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/15 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(2, Math.min(100, f.score))}%`, background: heat.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted leading-relaxed">
            分项得分把原始指标映射到 0–100：PMI 越高越暖（50 荣枯线≈中性），CPI 温和为正最暖（深度为负扣分），
            M2 适度宽松加分。温度是实时计算结果，随指标同步刷新。
          </p>
        </Card>
        <Card className="lg:col-span-3">
          <p className="text-sm font-bold mb-1">近 12 个月温度轨迹</p>
          <p className="text-[11px] text-muted mb-2">温度按月计算并留存，用于观察趋势方向；单月读数不代表拐点</p>
          {series.length ? (
            <EChart option={option} height={280} />
          ) : (
            <p className="text-sm text-muted py-10 text-center">暂无温度历史</p>
          )}
        </Card>
      </div>
    </section>
  );
}
