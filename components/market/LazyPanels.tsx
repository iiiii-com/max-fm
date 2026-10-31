"use client";

import dynamic from "next/dynamic";

/**
 * /market 的「个股行情」与「ETF 专区」面板壳（任务⑥：首屏 JS 瘦身）。
 *
 * 为什么需要这一层：`next/dynamic` 的 `ssr: false` 只能在客户端组件里用，
 * 而 `app/market/page.tsx` 是 Server Component。把这两个面板放进单独的客户端壳，
 * 服务端只渲染一段骨架，浏览器在切到对应 Tab 时才去拉 EtfViewer/StockSearch 的 chunk
 * ——这两个组件合计包含 ETF 全量表格、K 线详情与 echarts（约 800KB+），
 * 不该为大数指数 Tab 的首屏买单。
 */
const PanelSkeleton = ({ label }: { label: string }) => (
  <div className="space-y-3" aria-busy="true" aria-label={`${label}加载中`}>
    <div className="h-28 animate-pulse rounded-lg bg-muted/10" />
    <div className="h-40 animate-pulse rounded-lg bg-muted/10" />
  </div>
);

export const LazyStockSearch = dynamic(() => import("@/components/StockSearch"), {
  ssr: false,
  loading: () => <PanelSkeleton label="个股行情" />,
});

export const LazyEtfViewer = dynamic(() => import("@/components/EtfViewer"), {
  ssr: false,
  loading: () => <PanelSkeleton label="ETF 专区" />,
});
