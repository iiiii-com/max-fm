"use client";

import dynamicImport from "next/dynamic";

/**
 * 历史页非首屏 tab 的 ECharts 重组件懒加载（client 模块，允许 ssr:false）
 * - 独立 chunk，切换 tab 时按需加载，移动端首屏 JS 显著瘦身
 */
export const KonratiefWaves = dynamicImport(() => import("@/components/KonratiefWaves"), {
  ssr: false,
  loading: () => <p className="text-xs text-muted py-6 text-center">康波全景加载中…</p>,
});

export const DynastyTable = dynamicImport(() => import("@/components/DynastyTable"), {
  ssr: false,
  loading: () => <p className="text-xs text-muted py-6 text-center">朝代对照加载中…</p>,
});

export const MerrillClock = dynamicImport(() => import("@/components/MerrillClock"), {
  ssr: false,
  loading: () => <p className="text-xs text-muted py-6 text-center">美林时钟加载中…</p>,
});

export const CrisisTab = dynamicImport(() => import("@/components/crisis/CrisisTab"), {
  ssr: false,
  loading: () => <p className="text-xs text-muted py-6 text-center">牛熊重演加载中…</p>,
});
