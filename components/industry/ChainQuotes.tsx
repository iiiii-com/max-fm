"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

interface QuoteRow {
  name: string;
  secid: string | null;
  price: number | null;
  changePct: number | null;
  status: "ok" | "pending" | "miss";
}

/** 产业链节点行情：公司名 → 真实行情（搜索匹配 + 财务接口） */
export default function ChainQuotes({ companies }: { companies: string[] }) {
  const [rows, setRows] = useState<QuoteRow[]>(() => companies.slice(0, 10).map((c) => ({ name: c, secid: null, price: null, changePct: null, status: "pending" as const })));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows(companies.slice(0, 10).map((c) => ({ name: c, secid: null, price: null, changePct: null, status: "pending" as const })));
    const run = async () => {
      const out: QuoteRow[] = [];
      const queue = [...companies.slice(0, 10)];
      const worker = async () => {
        while (queue.length) {
          const name = queue.shift()!;
          try {
            const s = await fetch(`/api/stock/search?q=${encodeURIComponent(name)}`, { cache: "no-store" }).then((r) => r.json());
            const hit = (s?.hits ?? []).find((h: any) => h.kind === "stock" && (h.name === name || h.name.includes(name) || name.includes(h.name)));
            if (!hit) { out.push({ name, secid: null, price: null, changePct: null, status: "miss" }); continue; }
            const f = await fetch(`/api/stock/fundamentals?secid=${hit.secid}`, { cache: "no-store" }).then((r) => r.json());
            out.push({
              name,
              secid: hit.secid,
              price: f?.data?.price ?? null,
              changePct: null,
              status: "ok",
            });
          } catch {
            out.push({ name, secid: null, price: null, changePct: null, status: "miss" });
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!cancelled) {
        setRows(out.sort((a, b) => (a.status === "ok" ? -1 : 1)));
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.join("|")]);

  if (!rows.length) return null;

  return (
    <div className="mt-2">
      <p className="text-[11px] font-bold text-muted mb-1.5">链上公司行情（真实 · 点击进入深度页）</p>
      {loading ? (
        <p className="text-[11px] text-muted flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> 行情匹配中…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {rows.map((r) =>
            r.status === "ok" && r.secid ? (
              <Link key={r.name} href={`/stock/${encodeURIComponent(r.secid)}`} className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1 hover:bg-muted/20 transition-colors">
                <span className="text-xs truncate">{r.name}</span>
                <span className="ml-auto text-xs font-mono font-bold">{r.price?.toFixed(2) ?? "—"}</span>
                {r.changePct != null ? (
                  <span className="text-[10px] font-mono" style={{ color: r.changePct >= 0 ? "#dc2626" : "#16a34a" }}>
                    {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
                  </span>
                ) : null}
              </Link>
            ) : r.status === "pending" ? (
              <span key={r.name} className="text-xs text-muted px-2 py-1">{r.name}</span>
            ) : (
              <span key={r.name} className="text-xs text-muted px-2 py-1" title="未匹配到 A 股标的（可能为未上市/非 A 股）">
                {r.name} <span className="text-[10px] opacity-70">· 未匹配</span>
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
