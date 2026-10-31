"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RelatedChain {
  slug: string;
  name: string;
  basis: "映射" | "名称匹配";
}

/**
 * ETF 详情里的「相关产业链」反查。
 * 这是任务 3 的另一半：从产业链能到 ETF，从 ETF 也要能回到产业链。
 * 查不到时静默隐藏（不占位、不报错），避免干扰看盘。
 */
export default function EtfRelatedChains({ code, name }: { code: string; name: string }) {
  const [chains, setChains] = useState<RelatedChain[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!/^\d{6}$/.test(code)) {
      setChains([]);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/etf/chains?code=${code}&name=${encodeURIComponent(name)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive) setChains(Array.isArray(j?.chains) ? j.chains : []);
      })
      .catch(() => {
        if (alive) setChains([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [code, name]);

  if (!loading && !chains.length) return null;

  return (
    <div className="rounded-lg border border-border bg-surface/60 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted shrink-0">相关产业链</span>
        {loading && !chains.length ? (
          <span className="text-[11px] text-muted">反查中…</span>
        ) : (
          chains.map((c) => (
            <Link
              key={c.slug}
              href={`/industry/${c.slug}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-primary/25 bg-primary/8 text-primary hover:bg-primary/15 transition-colors"
              title={c.basis === "映射" ? "人工精选映射" : "按 ETF 名称关键词匹配"}
            >
              {c.name}
              <span className="text-[9px] opacity-60">{c.basis === "映射" ? "映射" : "名称"}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
