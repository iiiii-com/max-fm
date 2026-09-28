"use client";

import { useState } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";

export function DualThermometer({ macro, feeling }: { macro: number; feeling: number }) {
  const option: EChartsOption = {
    tooltip: { formatter: (p: any) => `${p.name}: ${p.value}°` },
    series: [
      {
        type: "gauge",
        startAngle: 180, endAngle: 0,
        min: 0, max: 100,
        radius: "95%", center: ["50%", "58%"],
        axisLine: {
          lineStyle: {
            width: 18,
            color: [
              [0.35, "#1d4ed8"], [0.55, "#a16207"], [0.75, "#f97316"], [1, "#c0392b"],
            ],
          },
        },
        pointer: { itemStyle: { color: "#111" }, length: "58%", width: 6 },
        axisTick: { distance: -18, length: 4, lineStyle: { color: "#fff", width: 1 } },
        splitLine: { distance: -18, length: 12, lineStyle: { color: "#fff", width: 2 } },
        axisLabel: { distance: -34, color: "#999", fontSize: 10 },
        anchor: { show: true, size: 12, itemStyle: { color: "#111" } },
        title: { show: true, offsetCenter: [0, "42%"], fontSize: 14, color: "#555" },
        detail: { show: true, offsetCenter: [0, "-12%"], fontSize: 30, fontWeight: "bold", color: "#111", formatter: "{value}°" },
        data: [{ value: macro, name: "宏观温度" }],
      },
      {
        type: "gauge",
        startAngle: 180, endAngle: 0,
        min: 0, max: 100,
        radius: "95%", center: ["50%", "58%"],
        axisLine: { lineStyle: { width: 4, color: [[1, "rgba(0,0,0,0)"]] } },
        pointer: { itemStyle: { color: "#c0392b" }, length: "52%", width: 4 },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        anchor: { show: true, size: 10, itemStyle: { color: "#c0392b" } },
        title: { show: true, offsetCenter: [0, "58%"], fontSize: 14, color: "#c0392b" },
        detail: { show: true, offsetCenter: [0, "8%"], fontSize: 20, fontWeight: "bold", color: "#c0392b", formatter: "{value}°" },
        data: [{ value: feeling, name: "大众体感" }],
      },
    ],
  };
  return <EChart option={option} height={340} />;
}

/**
 * 宏观温度走势 + 体感参考线。
 *
 * 体感问卷只在提交时记录当日分，**没有按月历史序列**。旧实现用
 * `45 + (macro-62)*0.6` 造出一条与宏观线高度相关的「体感线」，看上去像两套独立数据，
 * 实则是宏观数据的线性变换。现改为：只画真实宏观序列，体感以一条明确标注的
 * 水平参考线呈现（markLine），并在 tooltip 里注明「当前均值，无历史序列」。
 */
export function TempTrendChart({
  data,
  feelingRef,
}: {
  data: Array<{ date: string; macro: number }>;
  feelingRef?: number | null;
}) {
  const hasRef = feelingRef != null && Number.isFinite(feelingRef);
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      formatter: (ps: any) => {
        const p = Array.isArray(ps) ? ps[0] : ps;
        const date = p?.axisValue ?? "";
        const macro = p?.value ?? "—";
        const feel = hasRef ? `${feelingRef}°` : "—";
        return `${date}<br/>宏观温度：${macro}°<br/>当前体感均值：${feel}${
          hasRef ? "<br/><span style='color:#888'>体感为问卷均值，无按月历史序列</span>" : ""
        }`;
      },
    },
    legend: { data: hasRef ? ["宏观温度", "体感均值（当前）"] : ["宏观温度"], top: 4, right: 8 },
    grid: { left: 44, right: 16, top: 40, bottom: 28 },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", min: 0, max: 100, splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } } },
    series: [
      {
        name: "宏观温度",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((d) => d.macro),
        lineStyle: { color: "#1d4ed8", width: 2 },
        markLine: hasRef
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { color: "#c0392b", type: "dashed", width: 1.5 },
              label: { formatter: `体感均值 ${Math.round(Number(feelingRef))}°`, fontSize: 10, color: "#c0392b" },
              data: [{ yAxis: Number(feelingRef) }],
            }
          : undefined,
      },
    ],
  };
  return <EChart option={option} height={300} />;
}

export function FeelingBar({ data, color = "#c0392b" }: { data: Array<{ name: string; value: number }>; color?: string }) {
  const option: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v) => `${v}°` },
    grid: { left: 8, right: 60, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: data.map((d) => d.name), axisLabel: { fontSize: 11 } },
    yAxis: { type: "value", min: 0, max: 100, splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } } },
    series: [{
      type: "bar", data: data.map((d) => ({ value: d.value, name: d.name })),
      itemStyle: { color, borderRadius: [4, 4, 0, 0] }, barWidth: "45%",
      label: { show: true, position: "top", fontSize: 11, formatter: "{c}°" },
    }],
  };
  return <EChart option={option} height={280} />;
}

export function useFeelingSurvey() {
  const [result, setResult] = useState<{ myScore: number; overall: number; sampleCount: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (answers: Record<string, any>) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feeling/submit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "提交失败");
      setResult(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  return { result, error, loading, submit };
}