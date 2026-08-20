import { Suspense } from "react";
import BoardTabs from "@/components/BoardTabs";
import MarketIndexes from "@/components/MarketIndexes";
import StockSearch from "@/components/StockSearch";
import EtfViewer from "@/components/EtfViewer";
import NewsPanel from "@/components/NewsPanel";
import WatchlistSidebar from "@/components/WatchlistSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "市场洞察" };

const TABS = [
  { key: "indexes", label: "大盘指数" },
  { key: "stocks", label: "个股行情" },
  { key: "etf", label: "ETF 专区" },
];

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "indexes";
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">市场洞察</h1>
        <p className="text-sm text-muted mt-1">大盘指数 · 个股行情 · ETF · 资金流 · 快讯，数据来自东方财富公开接口</p>
      </header>
      <BoardTabs tabs={TABS} active={active} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {active === "indexes" && <MarketIndexes />}
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
