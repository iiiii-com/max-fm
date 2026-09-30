"use client";

import { useMemo, useState } from "react";
import ChinaMap from "./charts/ChinaMap";
import { fmt } from "@/lib/utils";


/**
 * 可切换指标。
 *
 * ⚠ 进出口与财政收入**已下线**：seed.ts 此前用
 *   trade = gdp * (0.25 + rng()*0.4)、fiscalRevenue = gdp * (0.08 + rng()*0.03)
 * 生成，即纯随机数，却以省级统计的名义展示。随机数把广东排到外贸依存度第 31 位、
 * 甘肃排到第 2 位，排名完全失真。已由 scripts/fix-province-fake-data.ts 置空。
 * 在有可核验的逐年公开数据之前，这两个维度不再出现 ——
 * 数字看起来精确比没有数字更危险。
 *
 * 「占全国 X 成」这类比例同理不做：分母（全国 GDP）站内没有，不能用 31 省加总代替。
 */
const METRICS = [
  { key: "gdp", label: "GDP 总量", unit: "万亿", color: ["#fde8e8", "#c0392b"] },
  { key: "growth", label: "GDP 同比", unit: "%", color: ["#dbeafe", "#1d4ed8"] },
  { key: "perCapitaGdp", label: "人均 GDP", unit: "万", color: ["#d1fae5", "#047857"] },
  { key: "population", label: "人口", unit: "亿", color: ["#fae8ff", "#a21caf"] },
  // GDP 占比：分母是 31 省合计（与分子同源同口径），不是全国 GDP。
  // 用于看集中度，与「占全国 X 成」是两回事，标签已写明。
  { key: "gdpShare", label: "占 31 省合计", unit: "%", color: ["#e0e7ff", "#4338ca"] },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];
type Row = { name: string; year?: number; gdp: number; growth: number; perCapitaGdp: number; population: number };

/** 取指标值；派生指标现算，取不到返回 null（不做除零兜底成 0） */
function metricValue(d: Row, key: MetricKey, ctx?: { totalGdp: number }): number | null {
  if (key === "gdpShare") {
    const t = ctx?.totalGdp ?? 0;
    return t > 0 ? (d.gdp / t) * 100 : null;
  }
  return d[key] ?? null;
}

/** 数字格式化：null 显示为「—」而不是 0，避免把「无数据」读成「真的是 0」 */
const fmtV = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : fmt(Math.round(v * 100) / 100, d);

const RANK_LABEL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

function ProvinceDetail({ name, history }: { name: string; history: Row[] }) {
  // 财政收入序列已下线（seed 中为随机数），走势图改用人均 GDP
  const [seriesKey, setSeriesKey] = useState<"gdp" | "population" | "perCapitaGdp" | "growth">("gdp");

  const years = history.map((h) => h.year ?? 0);
  const first = years[0];
  const last = years[years.length - 1];

  const rankOf = (year: number, key: "gdp" | "population" | "perCapitaGdp" | "growth") =>
    [...history]
      .filter((h) => h.year === year)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .findIndex((h) => h.name === name) + 1;

  const rankNow = rankOf(last, seriesKey);
  const rankFirst = rankOf(first, seriesKey);
  const delta = rankFirst - rankNow;

  const option = useMemo(() => {
    const METAS: Record<string, { label: string; unit: string; color: string }> = {
      gdp: { label: "GDP 总量", unit: "万亿", color: "#c0392b" },
      population: { label: "人口", unit: "亿", color: "#a21caf" },
      perCapitaGdp: { label: "人均 GDP", unit: "万", color: "#047857" },
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
        {(["gdp", "population", "perCapitaGdp", "growth"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSeriesKey(k)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${seriesKey === k ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
          >
            {k === "gdp" ? "GDP" : k === "population" ? "人口" : k === "perCapitaGdp" ? "人均" : "增速"}
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

  // 31 省 GDP 合计，作为「占 31 省合计」的分母（与分子同源同口径，非全国 GDP）
  const totalGdp = useMemo(() => data.reduce((a, d) => a + (d.gdp || 0), 0), [data]);

  const mapData = useMemo(() => {
    const m = METRICS.find((x) => x.key === metric)!;
    const vals = data.map((d) => metricValue(d, metric)).filter((v): v is number => v !== null && !Number.isNaN(v));
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    const ranking = [...data].sort((a, b) => (metricValue(b, metric, { totalGdp }) ?? 0) - (metricValue(a, metric, { totalGdp }) ?? 0));
    const rankOf = (name: string) => ranking.findIndex((d) => d.name === name) + 1;
    const option = {
      title: { text: m.label, left: 12, top: 6, textStyle: { fontSize: 14, fontWeight: 600 } },
      tooltip: {
        formatter: (p: any) => {
          const row = data.find((d) => d.name === p.name);
          if (!row) return p.name;
          const val = metricValue(row, metric, { totalGdp });
          const r = rankOf(row.name);
          return [
            `<b>${p.name}</b>　全国第 ${r} 名`,
            `<b>${m.label}：${fmtV(val)} ${m.unit}</b>`,
            `GDP：${fmt(row.gdp)} 万亿 · 同比：${fmt(row.growth)}%`,
            `人均：${fmt(row.perCapitaGdp)} 万 · 人口：${fmt(row.population)} 亿`,
            `<span style="color:#888">点击查看 2018-2025 走势（历史年份为推算值）</span>`,
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
        data: data.map((d) => ({ name: d.name, value: metricValue(d, metric, { totalGdp }) })),
      }],
    };
    return option;
  }, [metric, data, totalGdp]);

  const sorted = useMemo(
    () => [...data].sort((a, b) => (metricValue(b, sortKey, { totalGdp }) ?? 0) - (metricValue(a, sortKey, { totalGdp }) ?? 0)),
    [data, sortKey, totalGdp]
  );

  const selectedHistory = useMemo(
    () => history.filter((h) => h.name === selected),
    [history, selected]
  );

  const cell = (d: any, k: MetricKey, unit: string) => (
    <td className={`py-2 px-3 text-right font-mono ${k === sortKey ? "bg-primary/10 rounded" : ""}`}>
      {fmtV(metricValue(d, k, { totalGdp }))}{unit}
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
                        {m.label}
                        {/* 表头标出单位：旧实现单元格后缀为空，31 行全是「14.8」这类无单位裸数字 */}
                        <span className="text-[10px] font-normal opacity-70 ml-0.5">({m.unit})</span>
                        {sortKey === m.key ? " ↓" : ""}
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
                    {cell(d, "gdp", " 万亿")}
                    {cell(d, "growth", "%")}
                    {cell(d, "perCapitaGdp", " 万")}
                    {cell(d, "gdpShare", "%")}
                    {cell(d, "population", " 亿")}
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