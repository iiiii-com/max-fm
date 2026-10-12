"use client";

import { useEffect, useState } from "react";

/**
 * 跟随视口宽度（含旋转屏与窗口缩放）。
 *
 * 为什么需要：K 线的初始显示根数、图表高度、图例是否收起都要按可用宽度决定。
 * 服务端渲染时拿不到 window，所以初值给桌面宽度，挂载后再校正 ——
 * 这些值只影响图表 option（不进 DOM），因此不会造成 hydration 不一致。
 */
export function useViewportWidth(desktopFallback = 1200): number {
  const [w, setW] = useState(desktopFallback);

  useEffect(() => {
    const read = () => setW(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  return w;
}

/** 窄屏（手机）判定：< 640px 与 Tailwind 的 sm 断点一致，避免两套标准 */
export function useIsNarrow(): boolean {
  return useViewportWidth() < 640;
}
