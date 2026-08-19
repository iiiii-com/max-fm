"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  title: string;
  url: string;
  ctime: string;
  date: string;
}

export default function NewsPanel() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/news/flash", { cache: "no-store" });
        const j = await res.json();
        if (j?.ok && j.items?.length) setItems(j.items);
        else setErr("快讯暂不可用");
      } catch {
        setErr("快讯暂不可用");
      } finally {
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">财经快讯</h2>
        <span className="text-[10px] text-muted">来自新浪财经 · 每 5 分钟刷新</span>
      </div>
      {loading && <p className="text-xs text-muted">加载中…</p>}
      {err && <p className="text-xs text-muted">{err}</p>}
      <div className="space-y-0">
        {items.map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0 group"
          >
            <span className="text-[10px] text-muted shrink-0 mt-0.5 font-mono w-16">{n.date}</span>
            <span className="text-sm leading-snug group-hover:text-primary line-clamp-2">{n.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}