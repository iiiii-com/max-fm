"use client";

import { useEffect, useRef } from "react";
import { echarts, type EChartsOption } from "./echarts";
import { useTheme } from "@/components/theme-provider";

export default function EChart({
  option,
  height = 360,
  className = "",
  chartRef,
  onDataZoom,
  onReady,
  children,
}: {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  /** 暴露 chart 实例（画线标注等需要坐标转换） */
  chartRef?: React.MutableRefObject<echarts.ECharts | null>;
  /** dataZoom 缩放/平移回调（画线标注随图重绘） */
  onDataZoom?: (e?: unknown) => void;
  /** chart 初始化完成后回调 */
  onReady?: (chart: echarts.ECharts) => void;
  /** 渲染进图表容器内部（如 SVG 画线覆盖层）——子元素事件冒泡经过容器，ECharts 可同时收到滚轮/拖拽 */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();

  // 初始化只需一次；option 更新由下方 effect 处理
  useEffect(() => {
    if (!ref.current) return;
    // 全站终端风格：图表统一走 ECharts dark 主题（黑底浅字，与终端视觉一致）
    const useDark = true;
    const chart = echarts.init(ref.current, useDark ? "dark" : undefined);
    innerRef.current = chart;
    if (chartRef) chartRef.current = chart;
    // dark 主题自带深蓝紫画布底，终端风格需要透明以露出卡片底色
    chart.setOption(useDark ? { backgroundColor: "transparent", ...option } : option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    if (onDataZoom) chart.on("datazoom", onDataZoom);
    onReady?.(chart);
    return () => {
      window.removeEventListener("resize", onResize);
      if (onDataZoom) chart.off("datazoom", onDataZoom);
      try {
        chart.dispose();
      } catch {
        /* 组件已卸载时 dispose 可能抛 removeChild NotFoundError，忽略 */
      }
      innerRef.current = null;
      if (chartRef) chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    innerRef.current?.setOption(option, { notMerge: false });
  }, [option]);

  return (
    <div ref={ref} style={{ height, width: "100%", position: "relative" }} className={className}>
      {children}
    </div>
  );
}
