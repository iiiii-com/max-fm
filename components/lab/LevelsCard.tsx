"use client";

import { useMemo } from "react";
import { sma } from "@/lib/data/indicators";
import type { LabBar } from "./KlineLab";

/** 06 技术位分析：支撑/压力（摆动极值聚类）+ 均线系统 + 当前价相对位置
 *  支撑/压力口径：局部极值（前后 5 根内最高/最低），按价格 1.5% 容差聚类，出现 ≥2 次视为有效位
 */
export default function LevelsCard({ bars }: { bars: LabBar[] }) {
  const { levels, mas, last } = useMemo(() => {
    const lastBar = bars[bars.length - 1];
    if (!lastBar) return { levels: { supports: [] as Array<{ price: number; count: number }>, resistances: [] as Array<{ price: number; count: number }> }, mas: [] as Array<{ n: number; value: number; dist: number }>, last: null as LabBar | null };

    // 局部极值（swing high/low，窗口 5）
    const highs: Array<{ price: number; date: string }> = [];
    const lows: Array<{ price: number; date: string }> = [];
    const W = 5;
    for (let i = W; i < bars.length - W; i++) {
      let isH = true;
      let isL = true;
      for (let j = i - W; j <= i + W; j++) {
        if (j === i) continue;
        if (bars[j].high >= bars[i].high) isH = false;
        if (bars[j].low <= bars[i].low) isL = false;
      }
      if (isH) highs.push({ price: bars[i].high, date: bars[i].date });
      if (isL) lows.push({ price: bars[i].low, date: bars[i].date });
    }

    // 聚类（容差 1.5%）：同价位多次触及 = 有效支撑/压力
    const cluster = (pts: Array<{ price: number }>) => {
      const sorted = [...pts].sort((a, b) => a.price - b.price);
      const out: Array<{ price: number; count: number }> = [];
      for (const p of sorted) {
        const lastC = out[out.length - 1];
        if (lastC && Math.abs(p.price - lastC.price) / lastC.price <= 0.015) {
          lastC.count++;
          lastC.price = (lastC.price * (lastC.count - 1) + p.price) / lastC.count;
        } else {
          out.push({ price: p.price, count: 1 });
        }
      }
      return out;
    };
    const hc = cluster(highs).filter((c) => c.count >= 2);
    const lc = cluster(lows).filter((c) => c.count >= 2);

    // 近端位（距现价 ±25% 内），压力取高于现价最近 3 档，支撑取低于现价最近 3 档
    const price = lastBar.close;
    const resistances = hc.filter((c) => c.price > price).sort((a, b) => a.price - b.price).slice(0, 3);
    const supports = lc.filter((c) => c.price < price).sort((a, b) => b.price - a.price).slice(0, 3);

    const closes = bars.map((b) => b.close);
    const maDefs = [5, 10, 20, 60, 120, 250];
    const mas = maDefs
      .map((n) => {
        const arr = sma(closes, n);
        const v = arr[arr.length - 1];
        return v == null ? null : { n, value: v, dist: ((v - price) / price) * 100 };
      })
      .filter((x): x is { n: number; value: number; dist: number } => x != null);

    return { levels: { supports, resistances }, mas, last: lastBar };
  }, [bars]);

  if (!last) return <p className="text-sm text-muted py-8 text-center">行情数据加载中…</p>;

  const price = last.close;
  const row = (label: string, value: number, dist: number, tone: "res" | "sup" | "ma", k: string) => (
    <div key={k} className="flex items-center gap-3 px-3 py-1.5 text-xs">
      <span className="w-16 shrink-0 font-medium">
        {tone === "res" ? `压力${label}` : tone === "sup" ? `支撑${label}` : `MA${label}`}
      </span>
      <span className="font-mono tabular-nums w-20 text-right font-bold">{value.toFixed(2)}</span>
      <div className="flex-1 h-1.5 rounded-full bg-border/60 overflow-hidden relative">
        {/* 位置条：以现价为中心，左支撑右压力 */}
        <div
          className={`absolute inset-y-0 rounded-full ${tone === "res" ? "bg-up/30 right-0" : tone === "sup" ? "bg-down/30 left-0" : "bg-primary/30"}`}
          style={{ width: `${Math.min(100, Math.abs(dist) * 4)}%`, ...(tone === "ma" ? { left: `${50 - Math.min(50, Math.abs(dist) * 2)}%` } : {}) }}
        />
      </div>
      <span className={`font-mono tabular-nums w-16 text-right ${dist >= 0 ? "up" : "down"}`}>
        {dist >= 0 ? "+" : ""}
        {dist.toFixed(1)}%
      </span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium text-muted mb-2">
          关键价位（现价 <span className="font-mono font-bold text-foreground">{price.toFixed(2)}</span> · 摆动极值 1.5% 容差聚类 · ≥2 次触及有效）
        </p>
        <div className="rounded-md border border-border divide-y divide-border/50">
          {levels.resistances.length ? (
            [...levels.resistances].reverse().map((c, i) => row(`R${levels.resistances.length - i}`, c.price, ((c.price - price) / price) * 100, "res", `R${levels.resistances.length - i}`))
          ) : (
            <p className="px-3 py-2 text-xs text-muted">现价上方无有效压力位（创新高行情）</p>
          )}
          <div className="px-3 py-1.5 bg-primary-soft text-xs font-bold font-mono flex justify-between">
            <span>现价</span>
            <span>{price.toFixed(2)}</span>
          </div>
          {levels.supports.length ? (
            levels.supports.map((c, i) => row(`S${i + 1}`, c.price, ((c.price - price) / price) * 100, "sup", `S${i + 1}`))
          ) : (
            <p className="px-3 py-2 text-xs text-muted">现价下方无有效支撑位（创新低行情）</p>
          )}
        </div>
        <p className="text-[11px] text-muted mt-2 leading-relaxed">
          压力/支撑为历史成交密集区的统计结果，非精确价位；跌破支撑后压力支撑常互换。
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-muted mb-2">均线系统（距离 = (均线 − 现价) / 现价）</p>
        <div className="rounded-md border border-border divide-y divide-border/50">
          {mas.map((m) => row(String(m.n), m.value, m.dist, "ma", `MA${m.n}`))}
        </div>
        <p className="text-[11px] text-muted mt-2 leading-relaxed">
          多头排列（MA5&gt;MA10&gt;MA20&gt;MA60）为强势特征；现价站上全部均线且均线向上 = 趋势健康。可在 01 实验台叠加均线直观验证。
        </p>
      </div>
    </div>
  );
}
