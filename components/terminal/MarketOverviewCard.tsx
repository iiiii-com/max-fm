"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Q {
  code: string;
  name: string;
  price: number;
  changePct: number;
}

/** 核心展示位：A 股 6 指数 + 全球 3 大 + 汇/金/油 */
const PINNED = [
  ["000001", "上证指数"], ["399001", "深证成指"], ["399006", "创业板指"],
  ["000300", "沪深300"], ["000905", "中证500"], ["000688", "科创50"],
  ["SPX", "标普500"], ["NDX", "纳斯达克"], ["DJIA", "道琼斯"],
  ["USDCNH", "美元/离岸人民币"], ["XAU", "伦敦金"], ["CL", "WTI原油"],
];

function color(pct: number) {
  if (pct > 0.05) return "#dc2626";
  if (pct < -0.05) return "#16a34a";
  return "#64748b";
}

export default function MarketOverviewCard() {
  const [quotes, setQuotes] = useState<Q[]>([]);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/quotes", { cache: "no-store" });
      const j = await res.json();
      if (!Array.isArray(j?.quotes)) throw new Error("empty");
      setQuotes(j.quotes);
      setUpdated(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    } catch {
      setErr("行情加载失败");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byCode = new Map(quotes.map((q) => [q.code, q]));

  return (
    <figure>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {PINNED.map(([code, name]) => {
          const q = byCode.get(code);
          if (!q) {
            return (
              <div key={code} className="rounded-lg border border-border/60 px-2 py-1.5">
                <p className="text-[10px] text-muted truncate">{name}</p>
                {quotes.length === 0 && !err ? (
                  <div className="mt-1.5 space-y-1 animate-pulse">
                    <div className="h-3 bg-muted/30 rounded w-3/4" />
                    <div className="h-2.5 bg-muted/20 rounded w-1/2" />
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">—</p>
                )}
              </div>
            );
          }
          const up = q.changePct >= 0;
          return (
            <Link
              key={code}
              href={code.startsWith("000") || code.startsWith("399") ? `/market?tab=stocks&q=${encodeURIComponent(name)}` : "/market"}
              className="rounded-lg border border-border/60 px-2 py-1.5 hover:bg-muted/20 transition-colors"
            >
              <p className="text-[10px] text-muted truncate">{name}</p>
              <p className="text-[12px] font-bold font-mono">{q.price.toFixed(2)}</p>
              <p className="text-[10px] font-mono font-bold" style={{ color: color(q.changePct) }}>
                {up ? "▲" : "▼"} {q.changePct >= 0 ? "+" : ""}
                {q.changePct.toFixed(2)}%
              </p>
            </Link>
          );
        })}
      </div>
      <figcaption className="text-[10px] text-muted mt-2 leading-relaxed">
        A 股指数 / 全球三大指数 / 汇率与大宗实时行情（红涨绿跌）· 数据源多源容错{updated ? ` · ${updated} 更新` : ""}
        {err ? ` · ${err}` : ""} · 点击条目进入个股行情
      </figcaption>
    </figure>
  );
}
