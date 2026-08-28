"use client";

import { useEffect, useState } from "react";
import MarketBreadth from "@/components/MarketBreadth";

interface Detail {
  name: string;
  price: number;
  yearChg: number; // 近 250 日
  monthChg: number; // 近 20 日
  vsMa250: number; // 距 250 日线
  annVol: number; // 年化波动
}

const INDEXES = [
  { secid: "1.000001", name: "上证指数" },
  { secid: "0.399001", name: "深证成指" },
  { secid: "0.399006", name: "创业板指" },
  { secid: "1.000300", name: "沪深300" },
  { secid: "1.000905", name: "中证500" },
  { secid: "1.000688", name: "科创50" },
];

/** 指数详情：阶段表现 / 波动 / 市场宽度（真实数据自算） */
export default function IndexDetailPanel() {
  const [sel, setSel] = useState(INDEXES[0]);
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [pe, setPe] = useState<{ pe: number; pctile: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/index/kline?secid=${sel.secid}&days=260`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!Array.isArray(j?.klines) || j.klines.length < 60) throw new Error(j?.error ?? "empty");
        const closes = j.klines.map((b: any) => b.close);
        const last = closes[closes.length - 1];
        const yAgo = closes[Math.max(0, closes.length - 251)];
        const m20 = closes[Math.max(0, closes.length - 21)];
        const ma250 = closes.slice(-250).reduce((a: number, b: number) => a + b, 0) / Math.min(250, closes.length);
        const rets: number[] = [];
        for (let i = closes.length - 60; i < closes.length; i++) {
          if (i > 0 && closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
        }
        const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
        const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
        setD({
          name: sel.name,
          price: last,
          yearChg: Number((((last - yAgo) / yAgo) * 100).toFixed(1)),
          monthChg: Number((((last - m20) / m20) * 100).toFixed(1)),
          vsMa250: Number((((last - ma250) / ma250) * 100).toFixed(1)),
          annVol: Number((sd * Math.sqrt(250) * 100).toFixed(1)),
        });
      })
      .catch((e) => !cancelled && setErr(e?.message ?? "指数数据加载失败"));
    // 指数 PE 分位（东财历史估值）
    setPe(null);
    fetch(`/api/stock/valuation-percentile?secid=${sel.secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok && j.current?.pe != null && j.stats?.pctile != null) {
          setPe({ pe: Number(j.current.pe), pctile: Number(j.stats.pctile) });
        }
      })
      .catch(() => { /* PE 分位不可用则不显示 */ });
    return () => { cancelled = true; };
  }, [sel]);

  const cards = d
    ? [
        ["近 1 年", `${d.yearChg >= 0 ? "+" : ""}${d.yearChg}%`, d.yearChg >= 0 ? "#dc2626" : "#16a34a"],
        ["近 1 月", `${d.monthChg >= 0 ? "+" : ""}${d.monthChg}%`, d.monthChg >= 0 ? "#dc2626" : "#16a34a"],
        ["距 250 日线", `${d.vsMa250 >= 0 ? "+" : ""}${d.vsMa250}%`, d.vsMa250 >= 0 ? "#dc2626" : "#16a34a"],
        ["年化波动", `${d.annVol}%`, "#64748b"],
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted mr-1">指数：</span>
        {INDEXES.map((ix) => (
          <button
            key={ix.secid}
            onClick={() => setSel(ix)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              sel.secid === ix.secid ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {ix.name}
          </button>
        ))}
      </div>

      {err ? (
        <p className="text-sm text-muted py-4 text-center">{err}</p>
      ) : !d ? (
        <p className="text-sm text-muted py-4 text-center">指数数据计算中…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cards.map(([label, val, color]) => (
              <div key={String(label)} className="rounded-lg border border-border/70 bg-card px-3 py-2">
                <p className="text-[10px] text-muted">{label}</p>
                <p className="text-base font-bold font-mono" style={{ color: String(color) }}>{val}</p>
              </div>
            ))}
            {pe ? (
              <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
                <p className="text-[10px] text-muted">PE(TTM) · 5 年分位</p>
                <p className="text-base font-bold font-mono">{pe.pe}（<span className={pe.pctile < 20 ? "down" : pe.pctile >= 80 ? "up" : ""}>{pe.pctile}%</span>）</p>
              </div>
            ) : null}
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            <b className="text-foreground">{d.name}</b> 现价 {d.price.toFixed(2)}：近 1 年与近 1 月表现、距 250 日线位置、年化波动均由真实日线自算
            （对应 GMRDS 环节 1 宏观 + 环节 3 周期定位）。指数成分股/行业权重/估值分位待数据源接入。
          </p>
        </>
      )}

      <div className="border-t border-border/60 pt-3">
        <p className="text-xs font-bold mb-2">市场宽度 · 全市场冷热</p>
        <MarketBreadth />
      </div>
    </div>
  );
}
