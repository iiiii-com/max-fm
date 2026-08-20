"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { useTheme } from "@/components/theme-provider";
import { HistoryEvent, CAT_TONE, REGION_TONE, REGION_LABEL } from "@/lib/data/history";
import { Badge } from "@/components/ui";

const CN_COLOR = "#c8102e";
const WEST_COLOR = "#2563eb";

export default function HistoryAxis({
  events,
  onSelect,
}: {
  events: HistoryEvent[];
  onSelect?: (e: HistoryEvent | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();
  const [selected, setSelected] = useState<HistoryEvent | null>(null);

  const cnData = useMemo(
    () => events.map((e, i) => (e.region === "cn" ? { value: [e.year, 1, i], e, i } : null)).filter(Boolean),
    [events]
  );
  const westData = useMemo(
    () => events.map((e, i) => (e.region === "west" ? { value: [e.year, 0, i], e, i } : null)).filter(Boolean),
    [events]
  );

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onClick = (params: any) => {
      const e = events[params?.value?.[2] ?? -1];
      if (e) {
        setSelected(e);
        onSelect?.(e);
      }
    };
    chart.on("click", onClick);
    return () => {
      chart.off("click", onClick);
    };
  }, [events, onSelect]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const years = events.map((e) => e.year);
    if (!years.length) return;
    const min = Math.min(...years);
    const max = Math.max(...years);
    const pad = Math.max(20, Math.round((max - min) * 0.04));
    const scatterSeries = (
      data: any[],
      name: string,
      color: string
    ) => ({
      name,
      type: "scatter" as const,
      data: data.map((d) => ({
        value: d.value,
        symbolSize: events[d.value[2]]?.featured ? 10 : 6,
        itemStyle: {
          color,
          opacity: events[d.value[2]]?.featured ? 1 : 0.6,
        },
      })),
      emphasis: { itemStyle: { borderColor: "#000", borderWidth: 1 } },
    });
    const option: EChartsOption = {
      animation: false,
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const e = events[params?.value?.[2] ?? -1];
          if (!e) return "";
          return (
            `<b>${e.year < 0 ? `公元前 ${-e.year}` : e.year} 年 · ${e.title}</b><br/>` +
            `${e.category} · ${REGION_LABEL[e.region]}${e.wave ? ` · 第 ${e.wave} 波康波` : ""}${e.featured ? " · 精选" : ""}`
          );
        },
      },
      legend: { top: 4, right: 8, textStyle: { fontSize: 11 } },
      grid: { left: 52, right: 20, top: 34, bottom: 40 },
      xAxis: {
        type: "value",
        name: "年份",
        nameLocation: "middle",
        nameGap: 28,
        min: min - pad,
        max: max + pad,
        axisLabel: {
          fontSize: 10,
          formatter: (v: number) => (v < 0 ? `公元前 ${-v}` : `${v}`),
        },
      },
      yAxis: {
        type: "category",
        data: ["西方", "中国"],
        axisLabel: { fontSize: 11 },
        splitLine: { show: true, lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      dataZoom: [
        { type: "inside", filterMode: "none", zoomOnMouseWheel: true },
        { type: "slider", height: 16, bottom: 4, filterMode: "none" },
      ],
      series: [
        scatterSeries(cnData, "中国", CN_COLOR),
        scatterSeries(westData, "西方", WEST_COLOR),
      ],
    };
    chart.setOption(option, { notMerge: true });
  }, [events, cnData, westData]);

  const e = selected;
  return (
    <div className="space-y-4">
      <div ref={ref} style={{ height: 420, width: "100%" }} />
      {e ? (
        <div className="rounded-xl border border-primary/30 bg-background p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono font-bold text-sm ${e.year < 0 ? "text-green-600" : "text-primary"}`}>
              {e.year < 0 ? `公元前 ${-e.year} 年` : `${e.year} 年`}
            </span>
            <Badge tone={(CAT_TONE[e.category] ?? "gray") as any}>{e.category}</Badge>
            <Badge tone={(REGION_TONE[e.region] ?? "gray") as any}>{REGION_LABEL[e.region]}</Badge>
            {e.wave && <Badge tone="amber">第 {e.wave} 波康波</Badge>}
            {e.featured && <Badge tone="red">精选</Badge>}
          </div>
          <h3 className="font-bold text-lg leading-snug">{e.title}</h3>
          <p className="text-sm text-muted leading-relaxed">{e.summary}</p>
          <p className="text-sm leading-relaxed border-l-2 border-primary/30 pl-3 text-muted">{e.detail}</p>
          {e.lesson && (
            <p className="text-sm rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 leading-relaxed">
              <span className="font-bold text-amber-600 dark:text-amber-400">对今日启示：</span>
              {e.lesson}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            {e.figures && (
              <p className="rounded-lg bg-border/30 px-3 py-2">
                <span className="font-bold block mb-0.5">关键人物</span>{e.figures}
              </p>
            )}
            {e.impact && (
              <p className="rounded-lg bg-border/30 px-3 py-2">
                <span className="font-bold block mb-0.5">历史影响</span>{e.impact}
              </p>
            )}
            {e.source && (
              <p className="rounded-lg bg-border/30 px-3 py-2">
                <span className="font-bold block mb-0.5">史料出处</span>{e.source}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">点击散点查看事件详情（大小 = 精选/普通，红色 = 中国，蓝色 = 西方）</p>
      )}
    </div>
  );
}