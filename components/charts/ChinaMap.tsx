"use client";

import { useEffect, useRef } from "react";
import chinaGeo from "@/data/china-geo.json";
import { echarts, type EChartsOption } from "./echarts";
import { useTheme } from "@/components/theme-provider";

echarts.registerMap("china", chinaGeo as any);

/** 简单防抖（用于 resize 等高频事件） */
function debounce(fn: () => void, ms = 150) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

export default function ChinaMap({
  option,
  height = 520,
  className = "",
  onEvents,
  onReady,
}: {
  option: EChartsOption;
  height?: number;
  className?: string;
  onEvents?: Record<string, (params: any) => void>;
  /** chart 初始化完成后回调（用于 georoam 等动态监听） */
  onReady?: (chart: echarts.ECharts) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();

  // 初始化只需一次；option 更新由下方 effect 处理
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;
    chart.setOption(option);
    // resize 防抖：滚轮/动画触发的容器尺寸变化不重复重绘
    const onResize = debounce(() => chart.resize(), 150);
    window.addEventListener("resize", onResize);
    const handlers = Object.entries(onEvents || {}).map(([evt, fn]) => {
      chart.on(evt, fn as any);
      return [evt, fn] as const;
    });
    onReady?.(chart);
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
