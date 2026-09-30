"use client";

/**
 * K 线「每日涨跌幅」标注控制条 —— 7 个图表共用的同一套交互。
 *
 * 为什么需要：
 * 7 个图表此前把 `show: true` 写死在代码里（CrisisEngine / KlineLab /
 * InteractiveKlineLab / KlinePatternChart / BuySellScanner / LeaderKlineGrid /
 * StockDrawer），用户无法关闭。在 8000 根日 K 上这些标注会糊成一片，
 * 而 `kline-tooltip.ts` 自己已经用 maxVisible/keep 缓解了，却**没有留 UI 逃生口**。
 * 另 4 个图表（BullBearKline / UsMarketKline / StockSearch / EtfViewer）
 * 各写了一份自己的开关 UI，样式与默认值不一致。
 *
 * 这里统一：默认值、开/关、位置（上方/下方）、字号三档，
 * 以及一个始终可见的「最新一根」读数（DailyMoveBadge 的轻量替身，
 * 避免小图上再挂一个组件）。
 */

import { useState } from "react";

export interface PctPrefs {
  show: boolean;
  position: "top" | "bottom";
  fontSize: 9 | 10 | 11;
}

export const PCT_DEFAULTS: PctPrefs = { show: true, position: "top", fontSize: 9 };

const FONT_SIZES: Array<PctPrefs["fontSize"]> = [9, 10, 11];

/**
 * @param compact 紧凑模式：小图（如迷你 K 线网格）只给一个开关，不给位置/字号
 * @param initial 初始值。迷你图网格一屏 20 张，默认关闭标注更合理
 */
export function usePctPrefs(compact = false, initial?: Partial<PctPrefs>) {
  const [pct, setPct] = useState<PctPrefs>({ ...PCT_DEFAULTS, ...initial });
  const toggle = (
    <div className="flex items-center gap-2 flex-wrap text-[11px]">
      <label className="inline-flex items-center gap-1.5 cursor-pointer text-muted hover:text-foreground transition-colors">
        <input
          type="checkbox"
          checked={pct.show}
          onChange={(e) => setPct((v) => ({ ...v, show: e.target.checked }))}
          className="accent-[var(--color-primary)]"
        />
        每日涨跌幅
      </label>
      {!compact && pct.show ? (
        <>
          <span className="w-px h-3 bg-border" aria-hidden />
          <div className="flex items-center gap-0.5" role="group" aria-label="标注位置">
            {(["top", "bottom"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={pct.position === p}
                onClick={() => setPct((v) => ({ ...v, position: p }))}
                className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                  pct.position === p ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {p === "top" ? "上方" : "下方"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5" role="group" aria-label="标注字号">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={pct.fontSize === s}
                onClick={() => setPct((v) => ({ ...v, fontSize: s }))}
                className={`px-1.5 py-0.5 rounded-sm font-mono transition-colors ${
                  pct.fontSize === s ? "bg-primary text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
  return { pct, setPct, pctToggle: toggle };
}

/**
 * 形如 StockDrawer / LeaderKlineGrid 这类空间极小的图表：
 * 原来 fontSize 写死 8 / maxVisible 3，导致标注挤成一团。
 * 现在跟随 prefs，但强制单行显示且只在最近若干根内标注。
 */
export function miniPctConfig(p: PctPrefs, maxVisible = 8) {
  return { show: p.show, position: p.position, fontSize: p.fontSize, maxVisible, keep: maxVisible };
}
