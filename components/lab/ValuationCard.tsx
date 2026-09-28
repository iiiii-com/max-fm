"use client";

import { useEffect, useMemo, useState } from "react";

interface Bands {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}
interface Stat {
  min: number;
  max: number;
  avg: number;
  pctile: number;
  samples: number;
  period?: string;
  bands?: Bands | null;
}

/**
 * 与 /api/stock/valuation-percentile 的**实际**返回结构对齐。
 *
 * 修复：旧组件读的是 `percentile.pe` 与 `stats.pe.{p10..p90}`，而接口从未返回过这两个字段
 * （真实结构是 `stats` = PE 口径的 {min,max,avg,pctile,samples,period}）。
 * 两个字段恒为 undefined → `Band` 组件永远返回 null → **04 估值区间测算整块只剩一段说明文字**，
 * 模块看起来像坏了。现在按真实结构读取，并新增 PB 口径的分位带。
 */
interface ValResp {
  ok: boolean;
  error?: string;
  current?: { pe: number | null; pb: number | null };
  stats?: Stat;
  pbStats?: Stat | null;
  bands?: { pe?: Bands | null; pb?: Bands | null };
  source?: string;
}

/** 分位带：P10–P90 刻度 + 当前位置指针 */
function Band({
  label,
  cur,
  pct,
  bands,
}: {
  label: string;
  cur: number | null;
  pct: number | null;
  bands: Bands | null | undefined;
}) {
  if (cur == null || pct == null || !bands) return null;
  const pos = Math.max(0, Math.min(100, pct));
  const zone =
    pct <= 10 ? "极低估区" : pct <= 25 ? "低估区" : pct <= 50 ? "中低区" : pct <= 75 ? "中高区" : pct <= 90 ? "高估区" : "极高估区";
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-1.5 gap-2 flex-wrap">
        <span className="text-xs font-medium">
          {label} <span className="font-mono font-bold text-base ml-1">{cur.toFixed(2)}</span>
        </span>
        <span className={`text-xs font-mono ${pct <= 25 ? "down" : pct >= 75 ? "up" : "text-muted"}`}>
          近5年分位 {pct.toFixed(1)}% · {zone}
        </span>
      </div>
      <div className="relative h-8 rounded-md bg-gradient-to-r from-down/15 via-border/40 to-up/20 border border-border">
        {[
          { p: 10, v: bands.p10 },
          { p: 25, v: bands.p25 },
          { p: 50, v: bands.p50 },
          { p: 75, v: bands.p75 },
          { p: 90, v: bands.p90 },
        ].map(({ p, v }) => (
          <div
            key={p}
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${p}%`, transform: "translateX(-50%)" }}
          >
            <div className="w-px h-full bg-border-strong/60" />
            <span className="text-[9px] text-muted font-mono absolute -bottom-4 whitespace-nowrap">
              P{p} {v}
            </span>
          </div>
        ))}
        <div
          className="absolute -top-1 -bottom-1 flex flex-col items-center transition-all"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-0.5 h-[calc(100%+8px)] bg-primary rounded-full" />
          <span className="text-[10px] font-bold text-primary font-mono absolute -top-4 whitespace-nowrap">
            {cur.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 04 估值区间测算：近 5 年 PE/PB 分位带 + 当前位置 + 测算依据 */
export default function ValuationCard({ secid, isIndex }: { secid: string; isIndex: boolean }) {
  const [data, setData] = useState<ValResp | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr("");
    fetch(`/api/stock/valuation-percentile?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setData(j);
        else setErr(j?.error ?? "估值数据暂不可用");
      })
      .catch(() => alive && setErr("估值数据暂不可用"));
    return () => {
      alive = false;
    };
  }, [secid]);

  const isUsOrHk = useMemo(() => {
    const mkt = secid.split(".")[0];
    return mkt !== "0" && mkt !== "1";
  }, [secid]);

  if (isUsOrHk) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        估值分位暂仅支持 A 股个股与主要指数（数据源：东方财富 5 年历史估值）。
      </p>
    );
  }
  if (err) return <p className="text-sm text-muted py-8 text-center">{err}</p>;
  if (!data) return <p className="text-sm text-muted py-8 text-center">估值数据加载中…</p>;

  const pe = data.stats;
  const pb = data.pbStats;
  const hasAny = !!(pe?.bands || pb?.bands);

  return (
    <div className="pt-4">
      {hasAny ? (
        <>
          <Band label="PE-TTM" cur={data.current?.pe ?? null} pct={pe?.pctile ?? null} bands={data.bands?.pe ?? pe?.bands} />
          <Band label="PB（MRQ）" cur={data.current?.pb ?? null} pct={pb?.pctile ?? null} bands={data.bands?.pb ?? pb?.bands} />
          {pe?.period && (
            <p className="text-[11px] text-muted mb-2">
              统计区间 {pe.period} · PE 样本 {pe.samples} 个交易日
              {pb ? ` · PB 样本 ${pb.samples} 个交易日` : ""}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted py-6 text-center">
          该标的历史估值样本不足，无法计算分位（需至少 20 个有效交易日）。
        </p>
      )}

      <div className="mt-4 rounded-md bg-surface/60 border border-border/60 p-3 text-xs leading-relaxed">
        <p className="font-medium mb-1">测算依据</p>
        <p className="text-muted">
          取该标的{isIndex ? "指数" : "个股"}近 5 年（约 1240 个交易日）每日 PE-TTM / PB-MRQ 序列，
          计算当前值在历史序列中的百分位（小于等于当前值的样本占比），并给出 P10/P25/P50/P75/P90 五档分位。
          分位越低代表当前估值相对自身历史越便宜；这是<b>相对估值而非绝对结论</b> ——
          高成长股长期处于高分区、周期股反之属正常现象，不同行业之间也不可横向比较。
        </p>
        {data.source && <p className="text-muted/80 mt-1.5">数据源：{data.source}</p>}
      </div>
    </div>
  );
}
