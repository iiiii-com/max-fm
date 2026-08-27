import { Suspense } from "react";
import StockDeepView from "@/components/stock/StockDeepView";

export const dynamic = "force-dynamic";

export const metadata = { title: "个股深度 | Max 财经数据平台" };

/**
 * 个股聚合深度页：K线 + 数据联动条 + 财务摘要 + 估值定位 + 评分资金流
 * 路由：/stock/[secid]（如 /stock/1.600519）
 */
export default async function StockDeepPage({ params }: { params: Promise<{ secid: string }> }) {
  const { secid } = await params;
  const safe = encodeURIComponent(String(secid ?? "").replace(/[^\d.]/g, ""));

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      <Suspense fallback={<p className="text-sm text-muted py-10 text-center">个股深度数据加载中…</p>}>
        <StockDeepView secid={safe} />
      </Suspense>
    </div>
  );
}
