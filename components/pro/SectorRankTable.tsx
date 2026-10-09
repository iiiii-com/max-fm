"use client";

import { useCallback, useEffect, useState } from "react";
import ProGate from "@/components/ProGate";

interface RankItem {
  rank: number;
  of: number;
  rankPct: number;
  bk: string;
  name: string;
  score: number;
  position: number;
  momentum20: number | null;
  momentum60: number | null;
  vol20: number;
  bars: number;
  from: string;
  to: string;
}

/**
 * 行业景气排行：观测池内排序。
 *
 * 刻意把四个因子并排展示而不是只给一个分 —— 排序只是入口，
 * 真正能用来做判断的是"它高是因为位置高还是动量强"。
 */
export default function SectorRankTable({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<RankItem[] | null>(null);
  const [meta, setMeta] = useState<{ updated: string; count: number; note: string; degraded: string[] } | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/pro/sector-rank");
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(`${j.error ?? "取数失败"}${j.hint ? ` · ${j.hint}` : ""}`);
        return;
      }
      setItems(j.items);
      setMeta({ updated: j.updated, count: j.count, note: j.note, degraded: j.degraded ?? [] });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && open && !items && !loading) void load();
  }, [enabled, open, items, loading, load]);

  if (!enabled) {
    return (
      <div className="mt-3">
        <ProGate feature="sector-rank" compact />
      </div>
    );
  }

  const heat = (score: number) => (score >= 75 ? "#c0392b" : score >= 55 ? "#c98a24" : "#6b6862");

  return (
    <div className="mt-3 rounded-lg border border-border bg-border/20 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p className="text-xs font-bold tracking-wide text-primary">
          行业景气排行{meta ? `（观测池 ${meta.count} 个板块）` : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setOpen(true);
              void load();
            }}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-md border border-border hover:border-primary/50 disabled:opacity-40"
          >
            {loading ? "取数中…" : items ? "重新计算" : "计算排行"}
          </button>
        </div>
      </div>

      {err && <p className="text-[11px] text-amber-600 leading-relaxed">{err}</p>}

      {!items && !err && !open && (
        <p className="text-[11px] text-muted leading-relaxed">
          对一批板块批量计算景气分并排序。默认观测池是流动性最好的 18 个行业板块；
          排名是<b>池内相对位置</b>，换一组板块就会变，横向比较时请固定同一组。
        </p>
      )}

      {items && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] min-w-[620px]">
              <thead>
                <tr className="text-muted text-[10px] border-b border-border">
                  <th className="text-left py-1.5 pr-2 font-medium">#</th>
                  <th className="text-left px-1.5 py-1.5 font-medium">板块</th>
                  <th className="text-right px-1.5 py-1.5 font-medium">景气分</th>
                  <th className="text-right px-1.5 py-1.5 font-medium">位置分位</th>
                  <th className="text-right px-1.5 py-1.5 font-medium">20日动量</th>
                  <th className="text-right px-1.5 py-1.5 font-medium">60日动量</th>
                  <th className="text-right px-1.5 py-1.5 font-medium">年化波动</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.bk} className="border-b border-border/40">
                    <td className="py-1.5 pr-2 text-muted font-mono">
                      {r.rank}
                      <span className="text-[9px]">/{r.of}</span>
                    </td>
                    <td className="px-1.5 py-1.5">{r.name}</td>
                    <td className="px-1.5 py-1.5 text-right font-mono font-semibold" style={{ color: heat(r.score) }}>
                      {r.score}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono">{r.position}</td>
                    <td className={`px-1.5 py-1.5 text-right font-mono ${(r.momentum20 ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {r.momentum20 == null ? "—" : `${r.momentum20 > 0 ? "+" : ""}${r.momentum20}%`}
                    </td>
                    <td className={`px-1.5 py-1.5 text-right font-mono ${(r.momentum60 ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {r.momentum60 == null ? "—" : `${r.momentum60 > 0 ? "+" : ""}${r.momentum60}%`}
                    </td>
                    <td className="px-1.5 py-1.5 text-right font-mono text-muted">{r.vol20}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <p className="text-[10px] text-muted leading-relaxed mt-2 border-t border-border/60 pt-2">
              {meta.note}
              {meta.degraded.length > 0 && ` 未纳入：${meta.degraded.join("；")}`}
              {` 取数时间 ${new Date(meta.updated).toLocaleString("zh-CN")}`}
            </p>
          )}
        </>
      )}
    </div>
  );
}