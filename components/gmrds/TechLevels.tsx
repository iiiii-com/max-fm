"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, LineChart as LineIcon } from "lucide-react";

interface Level {
  label: string;
  price: number;
  dist: number; // 距现价 %
}

/** 技术位：支撑 / 压力 / 均线（近 60 日真实 K 线自算） */
export default function TechLevels() {
  const [sel, setSel] = useState({ label: "🇨🇳 贵州茅台", secid: "1.600519" });
  const [levels, setLevels] = useState<{ support: Level; pressure: Level; ma20: number; ma60: number; price: number } | null>(null);
  const [err, setErr] = useState("");

  const SYMBOLS = [
    { label: "🇨🇳 贵州茅台", secid: "1.600519" },
    { label: "🇨🇳 宁德时代", secid: "0.300750" },
    { label: "🇨🇳 招商银行", secid: "1.600036" },
    { label: "🇨🇳 比亚迪", secid: "0.002594" },
    { label: "🇺🇸 标普500", secid: "100.SPX" },
    { label: "🇭🇰 恒生指数", secid: "100.HSI" },
  ];

  useEffect(() => {
    let cancelled = false;
    const api = sel.secid.startsWith("100.") ? "/api/index/kline" : "/api/stock/kline";
    fetch(`${api}?secid=${sel.secid}&days=120`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const bars = j?.klines;
        if (!Array.isArray(bars) || bars.length < 70) throw new Error(j?.error ?? "empty");
        const closes = bars.map((b: any) => b.close);
        const price = closes[closes.length - 1];
        const win = bars.slice(-60);
        const hi60 = Math.max(...win.map((b: any) => b.high));
        const lo60 = Math.min(...win.map((b: any) => b.low));
        const ma20 = closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
        const ma60 = closes.slice(-60).reduce((a: number, b: number) => a + b, 0) / 60;
        const dist = (p: number) => Number((((p - price) / price) * 100).toFixed(1));
        setLevels({
          support: { label: "支撑（60 日低）", price: lo60, dist: dist(lo60) },
          pressure: { label: "压力（60 日高）", price: hi60, dist: dist(hi60) },
          ma20, ma60, price,
        });
      })
      .catch((e) => !cancelled && setErr(e?.message ?? "数据加载失败"));
    return () => { cancelled = true; };
  }, [sel]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted mr-1">标的：</span>
        {SYMBOLS.map((s) => (
          <button
            key={s.secid}
            onClick={() => setSel(s)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              sel.secid === s.secid ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {err ? (
        <p className="text-sm text-muted py-4 text-center">{err}</p>
      ) : !levels ? (
        <p className="text-sm text-muted py-4 text-center">技术位计算中…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
            <p className="text-[10px] text-muted flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 压力位（60 日高）</p>
            <p className="text-base font-bold font-mono" style={{ color: "#dc2626" }}>{levels.pressure.price.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-muted">距现价 {levels.pressure.dist >= 0 ? "+" : ""}{levels.pressure.dist}%</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
            <p className="text-[10px] text-muted flex items-center gap-1"><TrendingDown className="w-3 h-3" /> 支撑位（60 日低）</p>
            <p className="text-base font-bold font-mono" style={{ color: "#16a34a" }}>{levels.support.price.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-muted">距现价 {levels.support.dist >= 0 ? "+" : ""}{levels.support.dist}%</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
            <p className="text-[10px] text-muted flex items-center gap-1"><LineIcon className="w-3 h-3" /> MA20</p>
            <p className="text-base font-bold font-mono text-sky-600">{levels.ma20.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-muted">{levels.price >= levels.ma20 ? "现价在其上" : "现价在其下"}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
            <p className="text-[10px] text-muted flex items-center gap-1"><LineIcon className="w-3 h-3" /> MA60</p>
            <p className="text-base font-bold font-mono text-violet-600">{levels.ma60.toFixed(2)}</p>
            <p className="text-[10px] font-mono text-muted">{levels.price >= levels.ma60 ? "现价在其上" : "现价在其下"}</p>
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted leading-relaxed">
        技术位由近 60 日真实 K 线自算（环节 7 技术确认）：压力=区间高点（突破则转支撑），支撑=区间低点（跌破则转压力）；
        MA20/60 为中期趋势参考，现价在均线上方偏多、下方偏空。与 K 线实验台/画线标注联动使用。
      </p>
    </div>
  );
}
