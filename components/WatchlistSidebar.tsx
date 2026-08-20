"use client";

import Link from "next/link";
import { useWatchlist } from "@/lib/hooks/useWatchlist";

const KIND_LABEL: Record<string, string> = {
  stock: "股票",
  index: "指数",
  etf: "ETF",
  sector: "板块",
};

export default function WatchlistSidebar() {
  const { items, remove } = useWatchlist();
  const stocks = items.filter((i) => i.kind !== "sector");

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">我的自选</h2>
        {stocks.length > 0 && <span className="text-[10px] text-muted">{stocks.length} 个</span>}
      </div>
      {stocks.length === 0 ? (
        <p className="text-xs text-muted leading-relaxed">
          暂无自选。在「个股行情」或「ETF 专区」点击「加自选」即可收录，之后可从侧栏一键跳转。
        </p>
      ) : (
        <div className="space-y-1">
          {stocks.map((w) => (
            <div key={w.secid} className="flex items-center gap-2 text-xs">
              <Link
                href={`/market?tab=stocks&q=${encodeURIComponent(w.name)}`}
                className="font-medium hover:text-primary flex-1 truncate"
              >
                {w.name}
              </Link>
              <span className="text-[10px] text-muted font-mono">{w.code}</span>
              <span className="text-[10px] px-1 rounded bg-muted/50 text-muted">{KIND_LABEL[w.kind] ?? w.kind}</span>
              <button onClick={() => remove(w.secid)} className="text-muted hover:text-red-500" title="移除自选">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
