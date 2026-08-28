import { Suspense } from "react";
import SectorCenter from "@/components/sector/SectorCenter";
import QuoteRefreshBar from "@/components/layout/QuoteRefreshBar";

export const dynamic = "force-dynamic";
export const metadata = { title: "板块中心" };

export default async function SectorPage({ searchParams }: { searchParams: Promise<{ bk?: string }> }) {
  const { bk } = await searchParams;
  const validBk = bk && /^BK\d+$/.test(bk) ? bk : undefined;
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">板块中心</h1>
          <p className="text-sm text-muted mt-1">行业板块行情 · 资金流向 · K线联动 · 成分股 · 热点，数据来自东方财富公开接口</p>
        </div>
        <QuoteRefreshBar />
      </header>
      <Suspense fallback={<p className="text-sm text-muted">加载中…</p>}>
        <SectorCenter initialBk={validBk} />
      </Suspense>
    </div>
  );
}
