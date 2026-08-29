"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

interface TrendPoint {
  period: string;
  date: string;
  revenue: number | null;
  netProfit: number | null;
  grossMargin: number | null;
  roe: number | null;
  eps: number | null;
}

/** 07 财务三表趋势：营收/净利（柱，左轴 亿）+ 毛利率/ROE（线，右轴 %），近 8 期 */
export default function TrendCard({ secid, isIndex }: { secid: string; isIndex: boolean }) {
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isIndex) return;
    let alive = true;
    setTrend(null);
    setErr("");
    fetch(`/api/stock/finance-trend?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok && Array.isArray(j.trend) && j.trend.length) setTrend(j.trend);
        else setErr(j?.error ?? "财报数据暂不可用");
      })
      .catch(() => alive && setErr("财报数据暂不可用"));
    return () => {
      alive = false;
    };
  }, [secid, isIndex]);

  const option = useMemo<EChartsOption>(() => {
    if (!trend?.length) return {};
    const labels = trend.map((p) => p.period);
    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex;
          if (i == null || !trend[i]) return "";
          const t = trend[i];
          return `<b>${t.period}</b><br/>营收 ${t.revenue != null ? `${t.revenue.toFixed(1)}亿` : "—"}<br/>归母净利 ${t.netProfit != null ? `${t.netProfit.toFixed(1)}亿` : "—"}<br/>毛利率 ${t.grossMargin != null ? `${t.grossMargin.toFixed(1)}%` : "—"}<br/>ROE ${t.roe != null ? `${t.roe.toFixed(1)}%` : "—"}<br/>EPS ${t.eps != null ? `${t.eps.toFixed(2)}元` : "—"}`;
        },
      },
      legend: { top: 0, textStyle: { fontSize: 10 } },
      grid: { left: 52, right: 52, top: 30, bottom: 24 },
      xAxis: { type: "category", data: labels, axisLabel: { fontSize: 9, interval: 0, rotate: labels.length > 6 ? 30 : 0 } },
      yAxis: [
        { type: "value", name: "亿元", nameTextStyle: { fontSize: 9 }, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.12)" } } },
        { type: "value", name: "%", nameTextStyle: { fontSize: 9 }, axisLabel: { fontSize: 9 }, splitLine: { show: false }, scale: true },
      ],
      series: [
        {
          name: "营收",
          type: "bar",
          barWidth: "26%",
          itemStyle: { color: "rgba(200,16,46,0.55)", borderRadius: [2, 2, 0, 0] },
          data: trend.map((p) => p.revenue),
        },
        {
          name: "归母净利",
          type: "bar",
          barWidth: "26%",
          itemStyle: { color: "rgba(59,130,246,0.6)", borderRadius: [2, 2, 0, 0] },
          data: trend.map((p) => p.netProfit),
        },
        { name: "毛利率", type: "line", yAxisIndex: 1, symbol: "circle", symbolSize: 5, lineStyle: { width: 1.5, color: "#f59e0b" }, itemStyle: { color: "#f59e0b" }, data: trend.map((p) => p.grossMargin) },
        { name: "ROE", type: "line", yAxisIndex: 1, symbol: "circle", symbolSize: 5, lineStyle: { width: 1.5, color: "#8b5cf6" }, itemStyle: { color: "#8b5cf6" }, data: trend.map((p) => p.roe) },
      ],
    };
  }, [trend]);

  if (isIndex) {
    return (
      <p className="text-sm text-muted py-8 text-center leading-relaxed">
        指数无个别企业财报，本模块仅适用于 A 股个股。切换到个股标的即可查看营收 / 净利 / 毛利率 / ROE 趋势。
      </p>
    );
  }
  if (err) return <p className="text-sm text-muted py-8 text-center">{err}</p>;
  if (!trend) return <p className="text-sm text-muted py-8 text-center">财报数据加载中…</p>;

  return <EChart option={option} height={300} />;
}
