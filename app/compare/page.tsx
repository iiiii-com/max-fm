import type { Metadata } from "next";
import CompareCenter from "@/components/CompareCenter";

export const metadata: Metadata = { title: "对比中心" };

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">对比中心</h1>
        <p className="text-sm text-muted">
          跨类型走势对比——股票 · 指数 · ETF 任意组合，以起点 = 100 归一化呈现，让不同量级的标的在同一坐标系里讲真话。
        </p>
      </div>
      <CompareCenter />
    </div>
  );
}
