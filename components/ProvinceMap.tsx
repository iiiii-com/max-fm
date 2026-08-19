"use client";

import { useMemo, useState } from "react";
import ChinaMap from "./charts/ChinaMap";
import { fmt } from "@/lib/utils";

const METRICS = [
  { key: "gdp", label: "GDP 总量", unit: "万亿", color: ["#fde8e8", "#c8102e"] },
  { key: "growth", label: "GDP 同比", unit: "%", color: ["#dbeafe", "#1d4ed8"] },
  { key: "perCapitaGdp", label: "人均 GDP", unit: "万", color: ["#d1fae5", "#047857"] },
  { key: "trade", label: "进出口", unit: "万亿", color: ["#fef3c7", "#b45309"] },
  { key: "population", label: "人口", unit: "亿", color: ["#fae8ff", "#a21caf"] },
  { key: "fiscalRevenue", label: "财政收入", unit: "万亿", color: ["#e0f2fe", "#0369a1"] },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const RANK_LABEL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

export default function ProvinceMap({ data }: { data: Array<{ name: string; gdp: number; growth: number; perCapitaGdp: number; population: number; trade: number; fiscalRevenue: number }> }) {
  const [metric, setMetric] = useState<MetricKey>("gdp");
  const [sortKey, setSortKey] = useState<MetricKey>("gdp");

  const mapData = useMemo(() => {
    const m = METRICS.find((x) => x.key === metric)!;
    const vals = data.map((d) => d[metric]).filter((v) => v !== undefined && !Number.isNaN(v));
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    const ranking = [...data].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
    const rankOf = (name: string) => ranking.findIndex((d) => d.name === name) + 1;
    const option = {
      title: { text: m.label, left: 12, top: 6, textStyle: { fontSize: 14, fontWeight: 600 } },
      tooltip: {
        formatter: (p: any) => {
          const row = data.find((d) => d.name === p.name);
          if (!row) return p.name;
          const val = row[metric];
          const r = rankOf(row.name);
          return [
            `<b>${p.name}</b>　全国第 ${r} 名`,
            `<b>${m.label}：${fmt(val)} ${m.unit}</b>`,
            `GDP：${fmt(row.gdp)} 万亿 · 同比：${fmt(row.growth)}%`,
            `人均：${fmt(row.perCapitaGdp)} 万 · 人口：${fmt(row.population)} 亿`,
            `财政：${fmt(row.fiscalRevenue)} 万亿 · 外贸：${fmt(row.trade)} 万亿`,
          ].join("<br/>");
        },
      },
      visualMap: {
        min, max,
        text: [`${fmt(max)}${m.unit}`, `${fmt(min)}${m.unit}`],
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

  const sorted = useMemo(
    () => [...data].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0)),
    [data, sortKey]
  );

  const cell = (d: any, k: MetricKey, unit: string) => (
    <td className={`py-2 px-3 text-right font-mono ${k === sortKey ? "bg-primary/10 rounded" : ""}`}>
      {fmt(d[k])}{unit}
    </td>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
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
          <p className="text-xs text-muted px-3 pt-3">点击表头切换排序 · 当前按「{METRICS.find((m) => m.key === sortKey)?.label}」排序</p>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pl-3 pr-3 font-medium w-8">#</th>
                <th className="py-2 pr-3 font-medium">省份</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="py-2 px-3 font-medium text-right whitespace-nowrap">
                    <button onClick={() => setSortKey(m.key)} className={`hover:text-primary transition-colors ${sortKey === m.key ? "text-primary" : ""}`}>
                      {m.label}{sortKey === m.key ? " ↓" : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.name} className="border-b border-border/50 hover:bg-border/20">
                  <td className="py-2 pl-3 pr-3 font-medium">{RANK_LABEL[i] ?? i + 1}</td>
                  <td className="py-2 pr-3 font-medium">{d.name}</td>
                  {cell(d, "gdp", "" )}
                  {cell(d, "growth", "%")}
                  {cell(d, "perCapitaGdp", "")}
                  {cell(d, "trade", "")}
                  {cell(d, "population", "")}
                  {cell(d, "fiscalRevenue", "")}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
