import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import BoardTabs from "@/components/BoardTabs";
import NewsPanel from "@/components/NewsPanel";
import WatchlistSidebar from "@/components/WatchlistSidebar";
import QuoteRefreshBar from "@/components/layout/QuoteRefreshBar";
import { LazyStockSearch, LazyEtfViewer } from "@/components/market/LazyPanels";

/**
 * 三个 Tab 的面板改为按需加载（用户任务⑥：/market、/etf 首屏 JS 过大）。
 *
 * 旧实现把 MarketIndexes / StockSearch / EtfViewer / FundDirections / NorthboundPanel 全部
 * 静态 import，浏览器首屏必须下载三个 Tab 的全部代码（含 ETF 表格与图表依赖），
 * 而用户一次只看得见一个 Tab。改为 next/dynamic 后：
 *  - 默认 Tab（大盘指数）保留 SSR（不牺牲首屏内容与 SEO）；
 *  - 个股/ETF 面板放进 `components/market/LazyPanels.tsx`（客户端壳）再 ssr:false 懒加载，
 *    因为 Server Component 里不允许 ssr:false；它们本来也是客户端取数；
 *  - 统一给骨架占位，避免切换时布局跳动（CLS）。
 */
const PanelSkeleton = ({ label }: { label: string }) => (
  <div className="space-y-3" aria-busy="true" aria-label={`${label}加载中`}>
    <div className="h-28 animate-pulse rounded-lg bg-muted/10" />
    <div className="h-40 animate-pulse rounded-lg bg-muted/10" />
  </div>
);

const MarketIndexes = nextDynamic(() => import("@/components/MarketIndexes"), {
  loading: () => <PanelSkeleton label="大盘指数" />,
});
const FundDirections = nextDynamic(() => import("@/components/FundDirections"), {
  loading: () => <PanelSkeleton label="资金流向" />,
});
const NorthboundPanel = nextDynamic(() => import("@/components/NorthboundPanel"), {
  loading: () => <PanelSkeleton label="北向资金" />,
});

export const dynamic = "force-dynamic";

const TABS = [
  { key: "indexes", label: "大盘指数", title: "大盘指数", desc: "A 股主要指数与港股指数实时行情 · 悬停看详情 · 点击卡片直达个股行情" },
  { key: "stocks", label: "个股行情", title: "个股行情", desc: "搜索任意 A 股 / 指数，查看 K 线走势、资金流与量化评分" },
  { key: "etf", label: "ETF 专区", title: "ETF 专区", desc: "ETF 实时行情、净值与溢价率、近 60 日走势" },
] as const;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const t = TABS.find((x) => x.key === tab);
  // 旧实现对三个 tab 共用同一个 title「市场洞察」+ 同一个 H1，
  // 导致 /market、/market?tab=stocks、/market?tab=etf 三个标签页在浏览器里无法区分。
  return { title: t ? t.title : "大盘指数", description: t?.desc };
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "indexes";
  const cur = TABS.find((t) => t.key === active)!;
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{cur.title}</h1>
          <p className="text-sm text-muted mt-1">{cur.desc}</p>
        </div>
        <QuoteRefreshBar />
      </header>
      <BoardTabs tabs={TABS.map((t) => ({ key: t.key, label: t.label }))} active={active} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {active === "indexes" && (
            <div className="space-y-6">
              <MarketIndexes />
              <FundDirections />
              <NorthboundPanel />
            </div>
          )}
          {active === "stocks" && (
            <Suspense fallback={<p className="text-sm text-muted">加载中…</p>}>
              <LazyStockSearch />
            </Suspense>
          )}
          {active === "etf" && <LazyEtfViewer />}
        </div>
        <aside className="space-y-4">
          <NewsPanel />
          <WatchlistSidebar />
        </aside>
      </div>
    </div>
  );
}
