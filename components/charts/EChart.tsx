"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { EChartInnerProps } from "./EChartInner";

export type EChartProps = EChartInnerProps;

/**
 * ECharts 运行时外壳（全站统一入口，42 个调用点无需改动）。
 *
 * 性能背景（2026-10-31 实测）：
 * ECharts 的 chunk 约 **800KB**（按需注册后仍是这个量级）。之前它虽然通过
 * `dynamic(..., { ssr:false })` 变成了异步 chunk，但只要 EChart 组件被**渲染**，
 * dynamic 就会立即开始下载 —— 页面上有一半图表在首屏之外（用户根本没看到），
 * 却照样在打开页面时抢带宽和主线程。实测 /macro、/industry、/stock、/pro、/compare
 * 都在首屏加载了这 800KB，直接拖慢 FCP/LCP 与可交互时间。
 *
 * 现在的策略：
 *  - 外层 div 仍然按 height 先把位置占住（不会产生 CLS）；
 *  - 只有容器进入视口前 300px 才挂载真正的图表组件，这时才触发 800KB chunk 下载；
 *  - 首屏外的图表等用户滚动到附近再加载，滚到位时通常已经画好。
 *
 * 注意：不要在这里 import 任何 `echarts` 运行时值，否则又会被打进首屏 chunk。
 * 类型引用用 `import type`，编译后会被完全擦除。
 */
const Inner = dynamic(() => import("./EChartInner"), { ssr: false });

export default function EChart({ height = 360, className, lazy = true, ...rest }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!lazy);

  useEffect(() => {
    if (visible || !lazy) return;
    const el = ref.current;
    if (!el) return;
    // 不支持 IntersectionObserver 的环境直接放行，不能因为优化把图弄没了
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

  return (
    <div ref={ref} style={{ height, width: "100%", position: "relative" }} className={className}>
      {visible ? (
        <Inner {...rest} height="100%" lazy={false} />
      ) : (
        // 占位块保持与图表一致的高度，视觉上是一条淡淡的 loading 条，不改变布局
        <div
          className="h-full w-full animate-pulse rounded-lg bg-muted/10"
          aria-hidden="true"
          data-chart-placeholder="1"
        />
      )}
    </div>
  );
}
