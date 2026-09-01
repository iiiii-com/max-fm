"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";
import type { KlineBar } from "@/app/api/stock/kline/route";
import { CHART_COLORS } from "./palette";
import { mkMainAxis } from "@/lib/data/axis";
import { aggregateBars } from "@/lib/data/indicators";

export interface IndexRef {
  code: string;
  name: string;
  secid: string;
}

const COLORS = CHART_COLORS;

interface IndexSeries {
  name: string;
  points: Array<[string, number]>;
}

export default function IndexCompareChart({ indexes }: { indexes: IndexRef[] }) {
  const [series, setSeries] = useState<IndexSeries[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [period, setPeriod] = useState<"day" | "week" | "month">("day");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErr("");
      // 按周期取不同数据量：日 60 / 周 300（聚合 60 周）/ 月 750（聚合 30 月）
      const days = period === "day" ? 60 : period === "week" ? 300 : 750;
      const results = await Promise.allSettled(
        indexes.map(async (ix) => {
          // 指数 K 线走东财数据源（腾讯 fqkline 对 100. 前缀美股指数处理错误）
          const res = await fetch(`/api/index/kline?secid=${ix.secid}&days=${days}`, { cache: "no-store" });
          const j = await res.json();
          if (!Array.isArray(j?.klines) || !j.klines.length) throw new Error(j?.error ?? "empty");
          let bars: KlineBar[] = j.klines.slice(-days);
          // 周/月：日线聚合
          if (period !== "day") {
            const agg = aggregateBars(
              bars.map((b) => ({ date: b.date, open: b.open, close: b.close, high: b.high, low: b.low, volume: b.volume })),
              period
            );
            bars = agg.map((b) => ({ date: b.date, open: b.open, close: b.close, high: b.high, low: b.low, volume: b.volume, amount: b.volume }));
            bars = bars.slice(-(period === "week" ? 60 : 30));
          }
          const base = bars[0]?.close ?? 1;
          const points: Array<[string, number]> = bars
            .filter((b) => Number.isFinite(b.close) && b.close > 0)
            .map((b) => [b.date, Math.round((b.close / base) * 10000) / 100]);
          return { name: ix.name, points };
        })
      );
      const ok: IndexSeries[] = [];
      const bad: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.points.length > 1) ok.push(r.value);
        else bad.push(indexes[i].name);
      });
      if (cancelled) return;
      setSeries(ok);
      setFailed(bad);
      if (!ok.length) setErr("指数 K 线暂不可用，请稍后重试");
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [indexes, period]);

  const option = useMemo<EChartsOption>(() => {
    if (!series.length) return {};
    const dateSet = new Set<string>();
    series.forEach((s) => s.points.forEach(([d]) => dateSet.add(d)));
    const dates = [...dateSet].sort();
    const byDate = series.map((s) => new Map(s.points));
    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const d = dates[arr[0]?.dataIndex ?? 0] ?? "";
          const lines = arr.map((p: any) => `${p.marker}${p.seriesName}: ${p.value ?? "—"}`).join("<br/>");
          return `<b>${d}</b><br/>${lines}`;
        },
      },
      legend: { top: 4, type: "scroll", textStyle: { fontSize: 11 } },
      grid: { left: 48, right: 16, top: 40, bottom: 28 },
      xAxis: {
        ...mkMainAxis({ dataLength: dates.length, period: "day", firstDate: dates[0], lastDate: dates[dates.length - 1] }),
        data: dates,
      },
      yAxis: {
        type: "value", scale: true,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: "#292929", type: "dashed" } },
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 16, bottom: 4, start: 0, end: 100 },
      ],
      series: series.map((s, i) => ({
        name: s.name,
        type: "line" as const,
        data: dates.map((d) => byDate[i].get(d) ?? null),
        smooth: true,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.5, color: COLORS[i % COLORS.length] },
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
    };
  }, [series]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <p className="text-sm font-medium">
          {period === "day" ? "近 60 交易日" : period === "week" ? "近 60 周" : "近 30 月"}走势对比（起点 = 100）
        </p>
        <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 ${period === p ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
            >
              {p === "day" ? "日线" : p === "week" ? "周线" : "月线"}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="text-sm text-muted py-10 text-center">正在加载指数 K 线…</p>}
      {err && <p className="text-sm text-red-600 py-6">{err}</p>}
      {failed.length > 0 && !loading && (
        <p className="text-xs text-muted mb-1">以下指数暂时无法获取 K 线：{failed.join("、")}</p>
      )}
      {!loading && series.length > 0 && <EChart option={option} height={360} />}
    </div>
  );
}
