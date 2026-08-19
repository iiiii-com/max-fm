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
              [0.35, "#3b82f6"], [0.55, "#eab308"], [0.75, "#f97316"], [1, "#dc2626"],
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
        pointer: { itemStyle: { color: "#c8102e" }, length: "52%", width: 4 },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        anchor: { show: true, size: 10, itemStyle: { color: "#c8102e" } },
        title: { show: true, offsetCenter: [0, "58%"], fontSize: 14, color: "#c8102e" },
        detail: { show: true, offsetCenter: [0, "8%"], fontSize: 20, fontWeight: "bold", color: "#c8102e", formatter: "{value}°" },
        data: [{ value: feeling, name: "大众体感" }],
      },
    ],
  };
  return <EChart option={option} height={340} />;
}

export function TempTrendChart({ data }: { data: Array<{ date: string; macro: number; feeling: number }> }) {
  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["宏观温度", "大众体感"], top: 4, right: 8 },
    grid: { left: 44, right: 16, top: 40, bottom: 28 },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", min: 0, max: 100, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
    series: [
      { name: "宏观温度", type: "line", smooth: true, showSymbol: false, data: data.map((d) => d.macro), lineStyle: { color: "#2563eb", width: 2 } },
      { name: "大众体感", type: "line", smooth: true, showSymbol: false, data: data.map((d) => d.feeling), lineStyle: { color: "#c8102e", width: 2 } },
    ],
  };
  return <EChart option={option} height={300} />;
}

export function FeelingBar({ data, color = "#c8102e" }: { data: Array<{ name: string; value: number }>; color?: string }) {
  const option: EChartsOption = {
    tooltip: { trigger: "axis", valueFormatter: (v) => `${v}°` },
    grid: { left: 8, right: 60, top: 8, bottom: 24, containLabel: true },
    xAxis: { type: "category", data: data.map((d) => d.name), axisLabel: { fontSize: 11 } },
    yAxis: { type: "value", min: 0, max: 100, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
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