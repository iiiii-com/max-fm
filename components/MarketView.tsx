"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/data/quotes";
import { fmt, fmtPct } from "@/lib/utils";

export default function MarketView({ initialQuotes, initialSectors }: { initialQuotes: Quote[]; initialSectors: Quote[] }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [sectors, setSectors] = useState(initialSectors);
  const [watch, setWatch] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("max-watchlist") || "[]"); } catch { return []; }
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/quotes", { cache: "no-store" });
        const json = await res.json();
        if (json?.quotes) setQuotes(json.quotes);
        if (json?.sectors) setSectors(json.sectors);
      } catch { /* ignore */ }
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const toggle = async (q: Quote) => {
    const next = watch.includes(q.code) ? watch.filter((c) => c !== q.code) : [...watch, q.code];
    setWatch(next);
    localStorage.setItem("max-watchlist", JSON.stringify(next));
    try {
      const res = await fetch("/api/watchlist/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: q.code, name: q.name, action: watch.includes(q.code) ? "remove" : "add" }),
      });
      if (res.status === 401) setMsg("未登录：自选股仅保存在本地");
      else setMsg("");
    } catch { /* ignore */ }
  };

  const sortedSectors = [...sectors].sort((a, b) => b.changePct - a.changePct);

  return (
    <div className="space-y-6">
      {msg && <p className="text-xs text-amber-600">{msg}</p>}
      <section>
        <h2 className="font-bold mb-3">主要指数</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quotes.map((q) => (
            <div key={q.code} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">{q.name}</p>
                <button onClick={() => toggle(q)} className="text-xs text-primary hover:underline">
                  {watch.includes(q.code) ? "已自选 ✓" : "加入自选"}
                </button>
              </div>
              <p className="text-xl font-bold font-mono mt-1">{fmt(q.price)}</p>
              <p className={`text-sm font-mono mt-1 ${q.changePct >= 0 ? "up" : "down"}`}>
                {q.changePct >= 0 ? "+" : ""}{fmtPct(q.changePct)}　{q.changeAmount >= 0 ? "+" : ""}{fmt(q.changeAmount)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-3">板块热度（实时）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-4 font-medium">板块</th>
                <th className="py-2 pr-4 font-medium text-right">涨跌幅</th>
                <th className="py-2 font-medium text-right">成交额</th>
              </tr>
            </thead>
            <tbody>
              {sortedSectors.slice(0, 15).map((x) => (
                <tr key={x.code} className="border-b border-border/50">
                  <td className="py-2 pr-4">{x.name}</td>
                  <td className={`py-2 pr-4 text-right font-mono ${x.changePct >= 0 ? "up" : "down"}`}>{fmtPct(x.changePct)}</td>
                  <td className="py-2 text-right font-mono">{fmtWanSafe(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function fmtWanSafe(n: number) {
  if (!n) return "—";
  return n >= 10000 ? `${(n / 10000).toFixed(1)}亿` : `${(n / 10000 / 10000).toFixed(1)}亿`;
}