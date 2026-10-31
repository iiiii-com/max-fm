"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 视口内再挂载（任务⑥：把首屏之外的图表代码移出首屏请求）。
 *
 * 单独用 `next/dynamic` 不够：组件一旦被渲染，对应 chunk 会立刻开始下载——
 * 即使它此刻在可视区之外。ETF 专区的「热门 ETF K 线速览」在页面下方、
 * 用户可能只看一眼表格就走，却要为此下载约 800KB 的 echarts。
 *
 * 这里用 IntersectionObserver 做「延迟渲染」：元素进入视口（提前 300px 预取）
 * 之前只渲染占位骨架，进入视口后才真正渲染 children，从而触发器 chunk 下载。
 * 与 `components/charts/EChartInner.tsx` 的 lazy 逻辑一致，只是粒度更粗——
 * 这里是整块组件，不是单个 canvas。
 */
export default function DeferInView({
  children,
  height = 320,
  label = "图表加载中",
  rootMargin = "300px",
}: {
  children: ReactNode;
  height?: number;
  label?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 不支持 IntersectionObserver 的环境直接显示，避免内容永远空着
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  if (shown) return <>{children}</>;
  return (
    <div
      ref={ref}
      className="animate-pulse rounded-lg bg-muted/10"
      style={{ height }}
      aria-busy="true"
      aria-label={label}
    />
  );
}
