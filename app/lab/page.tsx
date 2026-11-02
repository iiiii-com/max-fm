import type { Metadata } from "next";
import { Suspense } from "react";
import LabTerminal from "@/components/lab/LabTerminal";
import { getSession } from "@/lib/auth";
import { isPro } from "@/lib/plan";

export const metadata: Metadata = {
  title: "K线实验室 · 实操教学终端",
  description: "股票/指数可视化实操教学终端：K线实验台、形态识别、财务雷达、估值测算、买卖点扫描、技术位分析、财务三表趋势、策略回测 + 全球指数/市场宽度/市场脉搏 —— 全部基于真实行情与财报数据。支持 /lab?secid= 预选标的。",
};

export const dynamic = "force-dynamic";

/**
 * 实验室首屏的两份关键数据用 preload 提前拉起来。
 *
 * 线上实测（tmp/diag-canvas.py + tmp/waterfall.py）：K 线请求要等 React 水合完成
 * （约 3 秒）才发出，冷实例上再等 4 秒 —— 图表 8 秒才出现。而 HTML 里的
 * `<link rel="preload" as="fetch">` 在解析阶段就会发请求，比水合早 2 秒以上；
 * 接口响应带 20 秒浏览器 max-age，组件挂载后的 fetch 直接吃这份缓存。
 *
 * 这里的 URL 必须与 LabTerminal 首次请求完全一致（secid/period/days 三项），
 * 否则缓存键不一致、preload 白拉一次。
 */
export default async function Lab() {
  const session = await getSession();
  const pro = isPro(session);
  return (
    <>
      <link
        rel="preload"
        as="fetch"
        href="/api/stock/kline?secid=1.000001&period=day&days=8000"
        crossOrigin="anonymous"
      />
      <link rel="preload" as="fetch" href="/api/quotes" crossOrigin="anonymous" />
      <Suspense>
        <LabTerminal pro={pro} />
      </Suspense>
    </>
  );
}
