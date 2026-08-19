"use client";

import { useMemo, useState } from "react";
import ChinaMap from "./charts/ChinaMap";
import { fmt } from "@/lib/utils";

const METRICS = [
  { key: "gdp", label: "GDP 总量（万亿）", unit: "万亿", color: ["#fde8e8", "#c8102e"] },
  { key: "growth", label: "GDP 同比（%）", unit: "%", color: ["#dbeafe", "#1d4ed8"] },
  { key: "perCapitaGdp", label: "人均 GDP（万）", unit: "万", color: ["#d1fae5", "#047857"] },
  { key: "trade", label: "进出口（万亿）", unit: "万亿", color: ["#fef3c7", "#b45309"] },
] as const;

export default function ProvinceMap({ data }: { data: Array<{ name: string; gdp: number; growth: number; perCapitaGdp: number; population: number; trade: number }> }) {
  const [metric, setMetric] = useState<"gdp" | "growth" | "perCapitaGdp" | "trade">("gdp");

  const mapData = useMemo(() => {
    const m = METRICS.find((x) => x.key === metric)!;
    const vals = data.map((d) => d[metric]).filter((v) => v !== undefined && !Number.isNaN(v));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const option = {
      title: { text: m.label, left: 12, top: 6, textStyle: { fontSize: 14, fontWeight: 600 } },
      tooltip: {
        formatter: (p: any) => {
          const row = data.find((d) => d.name === p.name);
          return [
            `<b>${p.name}</b>`,
            `GDP：${fmt(row?.gdp)} 万亿`,
            `同比：${fmt(row?.growth)}%`,
            `人均：${fmt(row?.perCapitaGdp)} 万`,
            `人口：${fmt(row?.population)} 亿`,
          ].join("<br/>");
        },
      },
      visualMap: {
        min, max,
        text: [`${max}${m.unit}`, `${min}${m.unit}`],
        inRange: { color: m.color },
        left: "right", bottom: 20, textStyle: { fontSize: 11 }, calculable: true,
      },
      series: [{
        type: "map", map: "china", roam: true,
        label: { show: false, fontSize: 10 },
        emphasis: { label: { show: true, fontWeight: 600 }, itemStyle: { areaColor: "#f0abfc" } },
        itemStyle: { borderColor: "#fff", borderWidth: 0.8 },
        data: data.map((d) => ({ name: d.name, value: d[metric] })),
      }],
    };
    return option;
  }, [metric, data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key as any)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${metric === m.key ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-2">
          <ChinaMap option={mapData as any} />
        </div>
        <div className="card max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-3 font-medium">省份</th>
                <th className="py-2 pr-3 font-medium text-right">GDP（万亿）</th>
                <th className="py-2 pr-3 font-medium text-right">同比</th>
                <th className="py-2 pr-3 font-medium text-right">人均（万）</th>
                <th className="py-2 font-medium text-right">人口（亿）</th>
              </tr>
            </thead>
            <tbody>
              {[...data].sort((a, b) => b.gdp - a.gdp).map((d) => (
                <tr key={d.name} className="border-b border-border/50 hover:bg-border/20">
                  <td className="py-2 pr-3 font-medium">{d.name}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmt(d.gdp)}</td>
                  <td className={`py-2 pr-3 text-right font-mono ${d.growth >= 0 ? "up" : "down"}`}>{fmt(d.growth)}%</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmt(d.perCapitaGdp)}</td>
                  <td className="py-2 text-right font-mono">{fmt(d.population)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}