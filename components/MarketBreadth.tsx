"use client";

import { useEffect, useState } from "react";
import { Activity, Flame, Snowflake, Minus } from "lucide-react";

interface Breadth {
  up: number;
  down: number;
  flat: number;
  upRatio: number;
  amount: number;
  stage: string;
}

/** 市场宽度：涨跌家数 / 红绿比 / 成交额 / 冷热判定 */
export default function MarketBreadth() {
  const [d, setD] = useState<Breadth | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/market/breadth", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          if (j?.ok) setD(j);
          else setErr(j?.error ?? "加载失败");
        })
        .catch(() => !cancelled && setErr("加载失败"));
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const stageColor = d?.stage === "偏热" ? "#dc2626" : d?.stage === "偏冷" ? "#16a34a" : "#64748b";
  const upRatio = d?.upRatio ?? 50;

  return (
    <figure>
      {err ? (
        <p className="text-sm text-muted py-4 text-center">{err}</p>
      ) : !d ? (
        <p className="text-sm text-muted py-4 text-center">市场宽度统计中…</p>
      ) : (
        <div className="space-y-3">
          {/* 冷热条 */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-bold shrink-0" style={{ color: stageColor }}>
              {d.stage === "偏热" ? <Flame className="w-4 h-4" /> : d.stage === "偏冷" ? <Snowflake className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
              市场{d.stage}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-muted/40 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${upRatio}%`, background: "linear-gradient(90deg,#16a34a,#f59e0b,#dc2626)" }} />
            </div>
            <span className="text-[11px] font-mono text-muted shrink-0">上涨占比 {upRatio}%</span>
          </div>

          {/* 家数卡 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/70 px-3 py-2 text-center">
              <p className="text-[10px] text-muted">上涨</p>
              <p className="text-lg font-bold font-mono" style={{ color: "#dc2626" }}>{d.up}</p>
            </div>
            <div className="rounded-lg border border-border/70 px-3 py-2 text-center">
              <p className="text-[10px] text-muted">下跌</p>
              <p className="text-lg font-bold font-mono" style={{ color: "#16a34a" }}>{d.down}</p>
            </div>
            <div className="rounded-lg border border-border/70 px-3 py-2 text-center">
              <p className="text-[10px] text-muted">平盘</p>
              <p className="text-lg font-bold font-mono text-muted">{d.flat}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1"><Minus className="w-3 h-3" /> 两市成交 {d.amount} 万亿</span>
            <span>红绿比 {d.up}:{d.down}</span>
          </div>
        </div>
      )}
      <figcaption className="text-[10px] text-muted mt-2 leading-relaxed">
        市场宽度：全市场涨跌家数与成交额（东财实时）。上涨占比 &gt;60% 偏热（情绪亢奋、注意回调），&lt;40% 偏冷（情绪冰点、关注反弹）——环节 8 情绪评估的宽度口径。
      </figcaption>
    </figure>
  );
}
