"use client";

import { useEffect, useRef, useState } from "react";
import { echarts, initResponsiveChart, type EChartsOption } from "./echarts";
import { useTheme } from "@/components/theme-provider";

/**
 * 地图 GeoJSON 按需加载
 *
 * 原先在模块顶层 `import chinaGeo from "@/data/china-geo.json"` 并立即 registerMap，
 * 会把约 582KB 的 GeoJSON 打进客户端 JS 包（实测 603KB chunk）。
 * 改为运行时 fetch 后：仅地图页面承担该体积、可被 CDN 缓存、且作为 JSON 解析（远快于 JS 对象字面量）。
 * 同一页面多次挂载时通过 getMap 判断避免重复下载。
 */
let geoPromise: Promise<void> | null = null;
function ensureChinaMap(): Promise<void> {
  if ((echarts as any).getMap?.("china")) return Promise.resolve();
  if (!geoPromise) {
    geoPromise = fetch("/api/data/china-geo")
      .then((r) => {
        if (!r.ok) throw new Error(`geo ${r.status}`);
        return r.json();
      })
      .then((geo) => {
        echarts.registerMap("china", geo as any);
      })
      .catch((e) => {
        geoPromise = null; // 允许失败后重试
        throw e;
      });
  }
  return geoPromise;
}

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
  const [geoState, setGeoState] = useState<"loading" | "ready" | "error">("loading");

  // 地图数据按需加载（不阻塞其它页面，也不进 JS 包）
  useEffect(() => {
    let alive = true;
    ensureChinaMap()
      .then(() => {
        if (alive) setGeoState("ready");
      })
      .catch(() => {
        if (alive) setGeoState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  // 初始化只需一次（必须等地图数据就绪，否则 geo 组件无法渲染）；option 更新由下方 effect 处理
  useEffect(() => {
    if (!ref.current || geoState !== "ready") return;
    const { chart, dispose } = initResponsiveChart(ref.current, theme === "dark" ? "dark" : undefined);
    chartRef.current = chart;
    chart.setOption(option);
    // resize 防抖：滚轮/动画触发的容器尺寸变化不重复重绘
    const handlers = Object.entries(onEvents || {}).map(([evt, fn]) => {
      chart.on(evt, fn as any);
      return [evt, fn] as const;
    });
    onReady?.(chart);
    return () => {
      for (const [evt, fn] of handlers) chart.off(evt as any, fn as any);
      dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, geoState]);

  useEffect(() => {
    if (geoState !== "ready") return;
    chartRef.current?.setOption(option, { notMerge: false });
  }, [option, geoState]);

  if (geoState === "error") {
    return (
      <div
        style={{ height, width: "100%" }}
        className={`flex items-center justify-center rounded-lg border border-border bg-card text-xs text-muted ${className}`}
        role="alert"
      >
        地图数据加载失败，请刷新页面重试
      </div>
    );
  }

  if (geoState === "loading") {
    return (
      <div
        style={{ height, width: "100%" }}
        className={`flex items-center justify-center rounded-lg border border-border bg-card text-xs text-muted ${className}`}
        aria-busy="true"
      >
        地图加载中…
      </div>
    );
  }

  return <div ref={ref} style={{ height, width: "100%" }} className={className} />;
}
