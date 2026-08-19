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
type Row = { name: string; year?: number; gdp: number; growth: number; perCapitaGdp: number; population: number; trade: number; fiscalRevenue: number };

const RANK_LABEL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

function ProvinceDetail({ name, history }: { name: string; history: Row[] }) {
  const [seriesKey, setSeriesKey] = useState<"gdp" | "population" | "fiscalRevenue" | "growth">("gdp");

  const years = history.map((h) => h.year ?? 0);
  const first = years[0];
  const last = years[years.length - 1];

  const rankOf = (year: number, key: "gdp" | "population" | "fiscalRevenue" | "growth") =>
    [...history]
      .filter((h) => h.year === year)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .findIndex((h) => h.name === name) + 1;

  const rankNow = rankOf(last, seriesKey);
  const rankFirst = rankOf(first, seriesKey);
  const delta = rankFirst - rankNow;

  const option = useMemo(() => {
    const METAS: Record<string, { label: string; unit: string; color: string }> = {
      gdp: { label: "GDP 总量", unit: "万亿", color: "#c8102e" },
      population: { label: "人口", unit: "亿", color: "#a21caf" },
      fiscalRevenue: { label: "财政收入", unit: "万亿", color: "#0369a1" },
      growth: { label: "GDP 同比", unit: "%", color: "#1d4ed8" },
    };
    const m = METAS[seriesKey];
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 16, top: 34, bottom: 28 },
      xAxis: { type: "category", data: years.map(String) },
      yAxis: { type: "value", name: m.unit },
      series: [{
        name: m.label,
        type: "line",
        smooth: true,
        data: history.map((h) => Math.round((h[seriesKey] ?? 0) * 100) / 100),
        itemStyle: { color: m.color },
        areaStyle: { opacity: 0.12 },
      }],
    };
  }, [seriesKey, history, years]);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-lg">{name}</h3>
        <span className="text-xs text-muted">{first}-{last} 走势</span>
        <button
          onClick={() => setSeriesKey("gdp")}
          className="ml-auto text-xs text-muted hover:text-primary transition-colors"
        >
          关闭选择
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["gdp", "population", "fiscalRevenue", "growth"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSeriesKey(k)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${seriesKey === k ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
          >
            {k === "gdp" ? "GDP" : k === "population" ? "人口" : k === "fiscalRevenue" ? "财政" : "增速"}
          </button>
        ))}
      </div>
      <div className="text-xs text-muted">
        全国排名：{first} 年第 {rankFirst} 名 → {last} 年第 {rankNow} 名
        {delta > 0 ? <span className="up font-medium"> ↑{delta}</span> : delta < 0 ? <span className="down font-medium"> ↓{-delta}</span> : <span> —</span>}
        <span className="ml-2">（GDP {fmt(history[history.length - 1]?.gdp ?? 0)} 万亿 · 人口 {fmt(history[history.length - 1]?.population ?? 0)} 亿）</span>
      </div>
      <div className="h-56">
        <ChinaMap option={option as any} height={224} />
      </div>
    </div>
  );
}

export default function ProvinceMap({ data, history }: { data: Row[]; history: Row[] }) {
  const [metric, setMetric] = useState<MetricKey>("gdp");
  const [sortKey, setSortKey] = useState<MetricKey>("gdp");
  const [selected, setSelected] = useState<string | null>(null);

  const selectProvince = (name: string) => {
    const plain = name.replace(/省|市|自治区|壮族|回族|维吾尔|特别行政区/g, "");
    const match = data.find((d) => d.name === name) ?? data.find((d) => d.name.includes(plain));
    setSelected(match?.name ?? null);
  };

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
            `<span style="color:#888">点击查看 2018-2025 走势</span>`,
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

  const selectedHistory = useMemo(
    () => history.filter((h) => h.name === selected),
    [history, selected]
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
          <ChinaMap
            option={mapData as any}
            onEvents={{ click: (p: any) => p?.name && selectProvince(p.name) }}
          />
        </div>
        <div className="space-y-4">
          {selected && selectedHistory.length > 0 && (
            <ProvinceDetail name={selected} history={selectedHistory} />
          )}
          <div className="card max-h-[560px] overflow-y-auto">
            <p className="text-xs text-muted px-3 pt-3">点击表头切换排序 · 点击省份行查看走势 · 当前按「{METRICS.find((m) => m.key === sortKey)?.label}」排序</p>
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
                  <tr
                    key={d.name}
                    onClick={() => selectProvince(d.name)}
                    className={`border-b border-border/50 hover:bg-border/20 cursor-pointer ${selected === d.name ? "bg-primary/5" : ""}`}
                  >
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
    </div>
  );
}