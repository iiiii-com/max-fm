"use client";

import { useEffect, useMemo, useState } from "react";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { useTheme } from "@/components/theme-provider";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import type { KlineBar } from "@/app/api/stock/kline/route";
import { CHART_COLORS } from "@/components/charts/palette";

interface CmpItem {
  secid: string;
  name: string;
  bars: KlineBar[];
  changePct: number;
}

const COLORS = CHART_COLORS;

export default function StockCompare() {
  const { theme } = useTheme();
  const { items } = useWatchlist();
  const [picked, setPicked] = useState<string[]>([]);
  const [data, setData] = useState<CmpItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (picked.length < 2) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      picked.map(async (secid) => {
        const w = items.find((i) => i.secid === secid);
        if (!w) return null;
        const res = await fetch(`/api/stock/kline?secid=${secid}`, { cache: "no-store" });
        const j = await res.json();
        return { secid, name: w.name, bars: j?.klines ?? [] } as CmpItem;
      })
    ).then((rows) => {
      if (cancelled) return;
      const valid = rows.filter((r): r is CmpItem => !!r && r.bars.length > 0);
      setData(
        valid.map((r, i) => {
          const base = r.bars[0]?.close ?? 1;
          const last = r.bars[r.bars.length - 1]?.close ?? base;
          return { ...r, changePct: ((last - base) / base) * 100 };
        })
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [picked, items]);

  const option = useMemo<EChartsOption>(() => {
    if (data.length < 2) return {};
    const dates = data[0].bars.map((b) => b.date.slice(5));
    const series = data.map((d, i) => {
      const base = d.bars[0]?.close ?? 1;
      const norm = d.bars.map((b) => Number((((b.close - base) / base) * 100).toFixed(2)));
      return {
        name: d.name,
        type: "line" as const,
        data: norm,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: COLORS[i % COLORS.length] },
        itemStyle: { color: COLORS[i % COLORS.length] },
      };
    });
    return {
      animation: false,
      tooltip: { trigger: "axis", valueFormatter: (v: any) => `${v}%` },
      legend: { top: 4, textStyle: { fontSize: 11 } },
      grid: { left: 48, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 10 } },
      yAxis: { type: "value", axisLabel: { fontSize: 10, formatter: "{value}%" }, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
      dataZoom: [
        { type: "inside", start: 30, end: 100 },
        { type: "slider", height: 16, bottom: 2, start: 30, end: 100 },
      ],
      series,
    };
  }, [data]);

  const togglePick = (secid: string) => {
    setPicked((p) => (p.includes(secid) ? p.filter((x) => x !== secid) : p.length >= 6 ? p : [...p, secid]));
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">个股对比</h3>
        <span className="text-[10px] text-muted">从自选中选择 2-6 只，对比归一化区间涨幅（%）</span>
      </div>
      {items.length === 0 && <p className="text-xs text-muted">先在「个股行情 / ETF」页添加自选，再进行对比</p>}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {items.map((w) => {
            const active = picked.includes(w.secid);
            return (
              <button
                key={w.secid}
                onClick={() => togglePick(w.secid)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted hover:border-primary/40"
                }`}
              >
                {w.name}
              </button>
            );
          })}
        </div>
      )}
      {loading && <p className="text-xs text-muted">对比计算中…</p>}
      {!loading && data.length >= 2 && (
        <>
          <div style={{ height: 320, width: "100%" }}>
            <ChartInner option={option} theme={theme} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
            {data.map((d, i) => (
              <div key={d.secid} className="rounded-md border border-border px-2 py-1.5 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {d.name}
                </span>
                <span className={`font-mono font-medium ${d.changePct >= 0 ? "up" : "down"}`}>
                  {d.changePct >= 0 ? "+" : ""}{d.changePct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {!loading && data.length > 0 && data.length < 2 && <p className="text-xs text-muted">请至少选择 2 只标的</p>}
    </div>
  );
}

function ChartInner({ option, theme }: { option: EChartsOption; theme: string }) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const chartRef = useRef2();
  useEffect(() => {
    if (!ref) return;
    const chart = echarts.init(ref, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;
    chart.setOption(option, true);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, theme]);
  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: false });
  }, [option]);
  return <div ref={setRef} style={{ height: "100%", width: "100%" }} />;
}

function useRef2() {
  return useMemo(() => ({ current: null as echarts.ECharts | null }), []);
}