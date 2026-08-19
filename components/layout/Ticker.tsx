"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/data/quotes";
import { fmt, fmtPct } from "@/lib/utils";

export default function Ticker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/quotes", { cache: "no-store" });
        const json = await res.json();
        if (alive && json?.quotes) setQuotes(json.quotes);
      } catch {
        /* ignore */
      }
    }
    load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!quotes.length) return null;

  return (
    <div className="flex items-center gap-5 overflow-hidden text-xs py-1.5 border-t border-border whitespace-nowrap">
      {quotes.map((q) => (
        <span key={q.code} className="flex items-center gap-1.5">
          <span className="text-muted">{q.name}</span>
          <span className="font-mono font-medium">{fmt(q.price)}</span>
          <span className={`font-mono ${q.changePct >= 0 ? "up" : "down"}`}>{fmtPct(q.changePct)}</span>
        </span>
      ))}
    </div>
  );
}