"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/data/quotes";
import { fmt, fmtPct } from "@/lib/utils";

export default function Ticker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false); // 内容溢出时才显示渐隐提示

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/quotes", { cache: "no-store" });
        const json = await res.json();
        if (alive && json?.quotes) setQuotes([...(json.quotes || []), ...(json.global || [])]);
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

  // 行情条溢出检测：溢出时右侧渐隐 + 可横向滑动（触屏/滚轮），避免内容被硬截断
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 4);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [quotes]);

  if (!quotes.length) return null;

  return (
    <div className="relative">
      <div
        ref={innerRef}
        className="ticker-scroll flex items-center gap-5 overflow-x-auto text-xs py-1.5 border-t border-border whitespace-nowrap"
      >
        {quotes.map((q) => (
          <span key={q.code} className="flex items-center gap-1.5 shrink-0">
            <span className="text-muted">{q.name}</span>
            <span className="font-mono font-medium">{fmt(q.price)}</span>
            <span className={`font-mono ${q.changePct >= 0 ? "up" : "down"}`}>{fmtPct(q.changePct)}</span>
          </span>
        ))}
      </div>
      {scrollable && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent"
          aria-hidden
        />
      )}
    </div>
  );
}
