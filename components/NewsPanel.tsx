"use client";

import { useCallback, useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { EmptyState, ErrorState, LoadingRegion } from "@/components/ui-state";

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

  // 抽成可复用的 load：既给定时刷新用，也给错误态「重试」按钮用
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/news/flash", { cache: "no-store" });
      const j = await res.json();
      if (j?.ok && j.items?.length) {
        setItems(j.items);
        setErr("");
      } else {
        setErr("快讯暂不可用");
      }
    } catch {
      setErr("快讯暂不可用");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // 定时刷新走静默模式：不闪 loading，避免每 5 分钟整块内容跳动一次
    const t = setInterval(() => load(true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">财经快讯</h2>
        <span className="text-[10px] text-muted">来自新浪财经 · 每 5 分钟刷新</span>
      </div>

      {loading && <LoadingRegion rows={5} />}
      {!loading && err && <ErrorState message={err} hint="接口偶发限流，稍后重试通常即可恢复" onRetry={() => load()} compact />}
      {!loading && !err && items.length === 0 && (
        <EmptyState icon={<Newspaper className="h-7 w-7" />} title="暂无快讯" hint="当前时段没有新的财经快讯，稍后会自动刷新" />
      )}

      {!loading && !err && items.length > 0 && (
        <div className="space-y-0">
          {items.map((n) => (
            <a
              key={n.url || `${n.date}-${n.title}`}
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
      )}
    </div>
  );
}
