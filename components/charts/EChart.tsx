"use client";

import dynamic from "next/dynamic";
import type { EChartInnerProps } from "./EChartInner";

export type EChartProps = EChartInnerProps;

/**
 * ECharts 图表外壳（全站统一入口，42 个调用点无需改动）。
 *
 * 背景：ECharts 按需注册的 chunk 约 823KB，之前被静态 import 到本文件，
 * 于是所有带图的页面首屏关键路径都要先下载并解析这 823KB。
 * 但图表本身只能用 canvas（无法 SSR），首屏之前它并不需要就位 —— 拆成
 * `dynamic(..., { ssr: false })` 后 echarts 变成异步 chunk：
 * 页面骨架先出来，图表随后补上（外层 div 已按 height 占好位置，不会引起 CLS）。
 *
 * 注意：不要在这里 import 任何 `echarts` 运行时值，否则又会被打进首屏 chunk。
 * 类型引用用 `import type`，编译后会被完全擦除。
 */
const Inner = dynamic(() => import("./EChartInner"), { ssr: false });

export default function EChart({ height = 360, className, ...rest }: EChartProps) {
  return (
    <div style={{ height, width: "100%", position: "relative" }} className={className}>
      <Inner {...rest} height="100%" />
    </div>
  );
}