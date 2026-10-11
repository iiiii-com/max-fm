"use client";

import { useEffect, useRef, useState } from "react";
import { echarts, initResponsiveChart, type EChartsOption } from "./echarts";
import { useTheme } from "@/components/theme-provider";
import { resolveChartTheme } from "@/lib/charts/theme";

/** 注册到 ECharts 的主题名（内容按当前令牌实时重建） */
const THEME_NAME = "mx-site";

export default function EChart({
  option,
  height = 360,
  className = "",
  chartRef,
  onDataZoom,
  onClick,
  onReady,
  children,
  /** 进入视口前不初始化图表（默认开启）。首屏外的图表不必抢主线程 */
  lazy = true,
}: {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  /** 暴露 chart 实例（画线标注等需要坐标转换） */
  chartRef?: React.MutableRefObject<echarts.ECharts | null>;
  /** dataZoom 缩放/平移回调（画线标注随图重绘） */
  onDataZoom?: (e?: unknown) => void;
  /** click 事件回调（K 线点击查看当日详情等场景） */
  onClick?: (e: unknown) => void;
  /** chart 初始化完成后回调 */
  onReady?: (chart: echarts.ECharts) => void;
  /** 渲染进图表容器内部（如 SVG 画线覆盖层）——子元素事件冒泡经过容器，ECharts 可同时收到滚轮/拖拽 */
  children?: React.ReactNode;
  lazy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();
  /**
   * 是否已进入（或接近）视口。
   *
   * 为什么要这个门：重页面（ETF 专区、工具箱、产业地图）一次挂 7~12 个 ECharts 实例，
   * 每个都要建 canvas、算布局、画轴 —— 全部挤在首屏那几百毫秒里，
   * 桌面端表现为开页卡一下，移动端（CPU 弱得多）表现为白屏更久。
   * 首屏外的图表用户根本看不到，没必要抢这段时间。
   * rootMargin 提前 300px 预热，滚到时已经画好，不会看到空白。
   */
  const [visible, setVisible] = useState(!lazy);

  useEffect(() => {
    if (visible || !lazy || !ref.current) return;
    const el = ref.current;
    // 不支持 IntersectionObserver 时直接放行，不能因为优化把图弄没
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, lazy]);

  // 初始化只需一次；option 更新由下方 effect 处理
  useEffect(() => {
    if (!visible || !ref.current) return;
    // 主题按当前 CSS 令牌实时构建，而不是硬编码 ECharts 内置 dark ——
    // 后者与站点主题脱钩：站点换肤后图表不跟随，切换明暗对图表也无效。
    // 变量在 effect 内读取，确保拿到的是 .dark 类切换后的生效值。
    echarts.registerTheme(THEME_NAME, resolveChartTheme());
    /**
     * 用 initResponsiveChart 而不是裸 echarts.init + window.resize：
     * 容器在 init 时若高度为 0（隐藏的 tab、未完成布局、异步内容未撑开），
     * ECharts 会按 0×0 渲染且不会自己恢复 —— 这就是"K 线有时候不显示"的成因。
     * ResizeObserver 盯容器本身，容器一有尺寸就重画。
     */
    const { chart, dispose } = initResponsiveChart(ref.current, THEME_NAME);
    innerRef.current = chart;
    if (chartRef) chartRef.current = chart;
    // 画布保持透明，露出卡片底色
    chart.setOption({ backgroundColor: "transparent", ...option });
    if (onDataZoom) chart.on("datazoom", onDataZoom);
    if (onClick) chart.on("click", onClick);
    onReady?.(chart);
    return () => {
      if (onDataZoom) chart.off("datazoom", onDataZoom);
      if (onClick) {
        try { chart.off("click", onClick); } catch { /* ignore */ }
      }
      // dispose 内部会先断开 ResizeObserver 再销毁实例
      dispose();
      innerRef.current = null;
      if (chartRef) chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, visible]);

  useEffect(() => {
    innerRef.current?.setOption(option, { notMerge: false });
  }, [option]);

  return (
    <div ref={ref} style={{ height, width: "100%", position: "relative" }} className={className}>
      {children}
    </div>
  );
}
