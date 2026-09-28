import { Suspense } from "react";
import BoardTabs from "@/components/BoardTabs";
import MarketIndexes from "@/components/MarketIndexes";
import StockSearch from "@/components/StockSearch";
import EtfViewer from "@/components/EtfViewer";
import NewsPanel from "@/components/NewsPanel";
import WatchlistSidebar from "@/components/WatchlistSidebar";
import FundDirections from "@/components/FundDirections";
import NorthboundPanel from "@/components/NorthboundPanel";
import QuoteRefreshBar from "@/components/layout/QuoteRefreshBar";

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
              <StockSearch />
            </Suspense>
          )}
          {active === "etf" && <EtfViewer />}
        </div>
        <aside className="space-y-4">
          <NewsPanel />
          <WatchlistSidebar />
        </aside>
      </div>
    </div>
  );
}
