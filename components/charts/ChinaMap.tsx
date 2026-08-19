"use client";

import { useEffect, useRef } from "react";
import chinaGeo from "@/data/china-geo.json";
import { echarts, type EChartsOption } from "./echarts";
import { useTheme } from "@/components/theme-provider";

echarts.registerMap("china", chinaGeo as any);

export default function ChinaMap({ option, height = 520, className = "", onEvents }: { option: EChartsOption; height?: number; className?: string; onEvents?: Record<string, (params: any) => void> }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();

  // 初始化只需一次；option 更新由下方 effect 处理
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    const handlers = Object.entries(onEvents || {}).map(([evt, fn]) => {
      chart.on(evt, fn as any);
      return [evt, fn] as const;
    });
    return () => {
      window.removeEventListener("resize", onResize);
      for (const [evt, fn] of handlers) chart.off(evt as any, fn as any);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: false });
  }, [option]);

  return <div ref={ref} style={{ height, width: "100%" }} className={className} />;
}