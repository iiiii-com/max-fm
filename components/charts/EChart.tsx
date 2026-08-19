"use client";

import { useEffect, useRef } from "react";
import { echarts, type EChartsOption } from "./echarts";
import { useTheme } from "@/components/theme-provider";

export default function EChart({ option, height = 360, className = "" }: { option: EChartsOption; height?: number | string; className?: string }) {
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
    return () => {
      window.removeEventListener("resize", onResize);
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