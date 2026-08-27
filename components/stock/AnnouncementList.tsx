"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

interface Ann {
  title: string;
  date: string;
  type: string;
}

/** 公告聚合（东财，A股个股） */
export default function AnnouncementList({ secid }: { secid: string }) {
  const [anns, setAnns] = useState<Ann[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/announcements?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (cancelled ? null : j?.ok ? setAnns(j.anns ?? []) : setErr(j?.error ?? "公告加载失败")))
      .catch((e) => !cancelled && setErr(e?.message ?? "加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [secid]);

  if (err) return <p className="text-sm text-muted py-4 text-center">{err}</p>;
  if (loading) return <div className="h-32 animate-pulse bg-muted/10 rounded-lg" />;
  if (!anns.length) return <p className="text-sm text-muted py-4 text-center">暂无公告</p>;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="text-xs text-muted border-b border-border bg-muted/20">
              <th className="text-left py-2 pl-3 pr-2 font-medium w-24">日期</th>
              <th className="text-left py-2 px-2 font-medium w-28">类型</th>
              <th className="text-left py-2 pr-3 font-medium">标题</th>
            </tr>
          </thead>
          <tbody>
            {anns.map((a, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0">
                <td className="py-1.5 pl-3 pr-2 text-muted font-mono text-[11px] whitespace-nowrap">{a.date}</td>
                <td className="py-1.5 px-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted whitespace-nowrap">{a.type}</span>
                </td>
                <td className="py-1.5 pr-3 text-[12px] leading-snug">{a.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted px-3 py-1.5 border-t border-border/60 flex items-center gap-1">
        <FileText className="w-3 h-3" /> 数据源：东方财富公告 · 30 分钟缓存
      </p>
    </div>
  );
}
