/**
 * 提前预热 ECharts 运行时 chunk。
 *
 * 背景（2026-11-02 实测，移动端 390×844 + 4× CPU + 4G 1.6Mbps）：
 * `/lab` 的 K 线数据已用 preload 在 HTML 解析阶段拉好，但 ECharts 的 chunk 约 820KB，
 * 只有图表组件真正渲染时才会被 `next/dynamic` 触发下载 —— 于是移动端要等到
 * 约 9.2 秒才出现第一张 canvas（水合 5.5s + 数据 + 820KB 下载 4s，串行）。
 *
 * 这里在页面组件挂载初期就把这个 chunk 的下载跑起来，让它和「数据请求 / React 水合」
 * 重叠：只有首屏确定有图表的页面才调用，滚动到才出现的图表仍由 EChart 自己的
 * IntersectionObserver 控制。
 *
 * 幂等：进程内只跑一次；下载失败不影响功能（组件后续 import 会再试一次，命中同一 chunk）。
 */
let started = false;

export function warmECharts(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  void import("@/components/charts/EChartInner").catch(() => {
    started = false;
  });
}

// 模块被解析时就开跑（比组件挂载再调早 2～3 秒）：
// /lab 与 /compare 的入口 chunk 在 hydration 之前就已执行，这里启动下载后，
// 浏览器会和水合、接口请求并行拉 ECharts，而不是等图表容器挂载才排队。
if (typeof window !== "undefined") warmECharts();

