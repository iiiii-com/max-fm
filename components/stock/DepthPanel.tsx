"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { Activity, Waves } from "lucide-react";

interface TrendPoint {
  t: string;
  price: number | null;
  avg: number | null;
  high: number | null;
  low: number | null;
  vol: number | null;
  amount: number | null;
}

interface DepthData {
  ok: boolean;
  name?: string;
  code?: string;
  price?: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  prevClose?: number | null;
  volume?: number | null;
  amount?: number | null;
  volumeRatio?: number | null;
  limitUp?: number | null;
  limitDown?: number | null;
  turnover?: number | null;
  changePct?: number | null;
  amplitude?: number | null;
  trends?: TrendPoint[];
  levels?: Array<{ side: "bid" | "ask"; price: number; vol: number }> | null;
}

/** 盘口摘要 + 当日分时 + 量能（东财实时） */
export default function DepthPanel({ secid, flow }: { secid: string; flow?: { mainNetIn?: number | null; mainNetIn5?: number | null; mainNetIn10?: number | null; trend?: string } | null }) {
  const [data, setData] = useState<DepthData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/depth?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok) setData(j);
        else setErr(j?.error ?? "盘口数据加载失败");
      })
      .catch((e) => !cancelled && setErr(e?.message ?? "加载失败"));
    return () => { cancelled = true; };
  }, [secid]);

  if (err) return <p className="text-sm text-muted py-4 text-center">{err}</p>;
  if (!data) return <div className="h-40 animate-pulse bg-muted/10 rounded-lg" />;

  const times = data.trends?.map((p) => p.t) ?? [];
  const prices = data.trends?.map((p) => p.price) ?? [];
  const avgs = data.trends?.map((p) => p.avg) ?? [];
  const vols = data.trends?.map((p) => p.vol) ?? [];
  const preClose = data.prevClose ?? data.price;

  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 },
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params];
        const i = arr[0]?.dataIndex ?? 0;
        const p = data.trends?.[i];
        if (!p) return "";
        const chg = preClose ? ((((p.price ?? 0) - preClose) / preClose) * 100).toFixed(2) : "—";
        return `<b>${p.t}</b><br/>价 ${p.price ?? "—"}（${chg}%）<br/>均价 ${p.avg ?? "—"}<br/>量 ${p.vol ?? "—"} 手 · 额 ${p.amount ? (p.amount / 1e4).toFixed(0) : "—"} 万`;
      },
    },
    legend: { top: 0, right: 4, textStyle: { fontSize: 10 }, data: ["价格", "均价"] },
    grid: [
      { left: 52, right: 14, top: 26, height: "52%" },
      { left: 52, right: 14, top: "78%", height: "16%" },
    ],
    xAxis: [
      { type: "category", data: times, axisLabel: { fontSize: 8, interval: Math.floor(times.length / 4) }, boundaryGap: false },
      { type: "category", gridIndex: 1, data: times, axisLabel: { show: false } },
    ],
    yAxis: [
      { type: "value", scale: true, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
      { type: "value", gridIndex: 1, axisLabel: { fontSize: 8 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: "价格", type: "line", data: prices, xAxisIndex: 0, yAxisIndex: 0,
        showSymbol: false, smooth: true, lineStyle: { width: 1.4, color: "#3b82f6" },
        areaStyle: { color: "rgba(59,130,246,0.08)" },
        markLine: preClose ? { silent: true, symbol: "none", lineStyle: { color: "#f59e0b", type: "dashed", width: 0.8 }, label: { show: true, formatter: `昨收 ${preClose}`, fontSize: 8, color: "#d97706", position: "insideEndTop" }, data: [{ yAxis: preClose }] } : undefined,
      },
      {
        name: "均价", type: "line", data: avgs, xAxisIndex: 0, yAxisIndex: 0,
        showSymbol: false, lineStyle: { width: 1, color: "#f59e0b" },
      },
      {
        name: "成交量", type: "bar", data: vols, xAxisIndex: 1, yAxisIndex: 1,
        itemStyle: { color: "rgba(100,116,139,0.45)" }, barWidth: "60%",
      },
    ],
  };

  const fmtAmt = (v?: number | null) => (v == null ? "—" : v >= 1e8 ? `${(v / 1e8).toFixed(2)}亿` : `${(v / 1e4).toFixed(0)}万`);
  const fmtVol = (v?: number | null) => (v == null ? "—" : `${(v / 1e4).toFixed(2)}万手`);
  const pct = data.changePct ?? 0;
  const up = pct >= 0;

  return (
    <div className="space-y-3">
      {/* 五档买卖盘（腾讯 qt 真实） */}
      {data.levels && data.levels.length ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/60 p-2">
            <p className="text-[10px] text-muted mb-1.5">卖盘（五档）</p>
            <div className="space-y-1">
              {data.levels.filter((l) => l.side === "ask").slice(0, 5).reverse().map((l, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] font-mono">
                  <span className="text-muted w-6">{5 - i}</span>
                  <span className="font-bold">{l.price.toFixed(2)}</span>
                  <span className="text-muted">{l.vol}手</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-2">
            <p className="text-[10px] text-muted mb-1.5">买盘（五档）</p>
            <div className="space-y-1">
              {data.levels.filter((l) => l.side === "bid").slice(0, 5).map((l, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] font-mono">
                  <span className="text-muted w-6">{i + 1}</span>
                  <span className="font-bold up">{l.price.toFixed(2)}</span>
                  <span className="text-muted">{l.vol}手</span>
                </div>
              ))}
            </div>
          </div>
          <p className="col-span-2 text-[10px] text-muted">五档盘口：腾讯实时（qt.gtimg.cn）· 指数无盘口属正常</p>
        </div>
      ) : null}

      {/* 盘口摘要 */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {[
          { label: "现价", value: data.price?.toFixed(2) ?? "—", cls: up ? "up" : "down", sub: `${up ? "+" : ""}${pct.toFixed(2)}%` },
          { label: "今开", value: data.open?.toFixed(2) ?? "—", cls: "plain" },
          { label: "最高", value: data.high?.toFixed(2) ?? "—", cls: "up" },
          { label: "最低", value: data.low?.toFixed(2) ?? "—", cls: "down" },
          { label: "昨收", value: data.prevClose?.toFixed(2) ?? "—", cls: "plain" },
          { label: "量比", value: data.volumeRatio != null ? (data.volumeRatio / 100).toFixed(2) : "—", cls: "plain" },
          { label: "换手", value: data.turnover != null ? `${(data.turnover / 100).toFixed(2)}%` : "—", cls: "plain" },
          { label: "振幅", value: data.amplitude != null ? `${(data.amplitude / 100).toFixed(2)}%` : "—", cls: "plain" },
          { label: "成交量", value: fmtVol(data.volume), cls: "plain" },
          { label: "成交额", value: fmtAmt(data.amount), cls: "plain" },
          { label: "涨停", value: data.limitUp?.toFixed(2) ?? "—", cls: "up" },
          { label: "跌停", value: data.limitDown?.toFixed(2) ?? "—", cls: "down" },
        ].map((it) => (
          <div key={it.label} className="rounded-lg border border-border/60 px-2 py-1.5">
            <p className="text-[9px] text-muted">{it.label}</p>
            <p className={`text-[12px] font-mono font-bold ${it.cls === "up" ? "up" : it.cls === "down" ? "down" : ""}`}>{it.value}</p>
            {it.sub ? <p className={`text-[9px] font-mono ${up ? "up" : "down"}`}>{it.sub}</p> : null}
          </div>
        ))}
      </div>

      {/* 分时图 */}
      <div className="rounded-lg border border-border bg-card p-2">
        <p className="flex items-center gap-1 text-[11px] font-bold mb-1 text-primary">
          <Activity className="w-3.5 h-3.5" /> 当日分时 · {data.name}
        </p>
        <EChart option={option} height={300} />
        <p className="text-[10px] text-muted mt-1">数据源：东方财富实时 · 更新 {new Date().toLocaleTimeString("zh-CN", { hour12: false })} · 15 分钟延迟</p>
      </div>

      {/* 资金流摘要 */}
      {flow ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/60 px-3 py-2">
          <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
            <Waves className="w-3.5 h-3.5" /> 资金流
          </span>
          <span className="text-[11px]">今日主力 <b className={flow.mainNetIn != null && flow.mainNetIn >= 0 ? "up" : "down"}>{fmtAmt(flow.mainNetIn)}</b></span>
          <span className="text-[11px]">5日 <b className={flow.mainNetIn5 != null && flow.mainNetIn5 >= 0 ? "up" : "down"}>{fmtAmt(flow.mainNetIn5)}</b></span>
          <span className="text-[11px]">10日 <b className={flow.mainNetIn10 != null && flow.mainNetIn10 >= 0 ? "up" : "down"}>{fmtAmt(flow.mainNetIn10)}</b></span>
          {flow.trend ? <span className="text-[11px] text-muted">趋势：{flow.trend}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
