import EtfViewer from "@/components/EtfViewer";

export const dynamic = "force-dynamic";

export const metadata = { title: "ETF 行情" };

export default function EtfPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ETF 行情</h1>
        <p className="text-sm text-muted mt-1">ETF 搜索 · 实时行情 · 溢价率监控 · K 线走势 · 数据来自东方财富公开接口</p>
      </header>
      <EtfViewer />
    </div>
  );
}