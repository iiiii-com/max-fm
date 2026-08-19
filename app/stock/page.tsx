import StockSearch from "@/components/StockSearch";

export const dynamic = "force-dynamic";

export const metadata = { title: "个股行情" };

export default function StockPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">个股行情 & K 线</h1>
        <p className="text-sm text-muted mt-1">A 股实时搜索 · 日 K 蜡烛图（含均线、成交量）· 数据来自东方财富公开接口</p>
      </header>
      <StockSearch />
    </div>
  );
}
