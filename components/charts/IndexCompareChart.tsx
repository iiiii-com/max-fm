"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";
import type { KlineBar } from "@/app/api/stock/kline/route";
import { CHART_COLORS } from "./palette";
import { mkMainAxis } from "@/lib/data/axis";

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErr("");
      const results = await Promise.allSettled(
        indexes.map(async (ix) => {
          const res = await fetch(`/api/stock/kline?secid=${ix.secid}`, { cache: "no-store" });
          const j = await res.json();
          if (!Array.isArray(j?.klines) || !j.klines.length) throw new Error(j?.error ?? "empty");
          const bars: KlineBar[] = j.klines.slice(-60);
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
  }, [indexes]);

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
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
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
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">近 60 交易日走势对比（起点 = 100）</p>
        <span className="text-[10px] text-muted">收盘价归一化 · 约 2 分钟延迟</span>
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
