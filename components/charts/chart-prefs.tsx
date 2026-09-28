"use client";

/**
 * 全站图表偏好（图形 / 周期 / 对数轴）
 *
 * 为什么要抽成 Context：
 * 此前每张 TrendCard 各自持有一份 type / range / log 状态和一个 ChartToolbar。
 * /macro 有 24 张卡，CompareTool、IndicatorLine 等再加若干，
 * 结果是**一页 264 个局部控件**——用户要横向对比两组数据时，
 * 得在每张卡上重复点一遍才能对齐周期，控件本身还挤掉了图表的显示空间。
 *
 * 改为：偏好集中在一处，由页面顶部一条控制条统一设置，所有图表订阅同一份状态。
 * 这样「同屏所有图看同一时间窗」变成默认行为，而不是需要用户逐个对齐的负担。
 *
 * 未包裹 Provider 的场景（如单图独立页）自动退回各自的默认值，不影响既有行为。
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ChartType, ChartRange } from "./ChartToolbar";

export interface ChartPrefs {
  type: ChartType;
  range: ChartRange;
  log: boolean;
}

interface Ctx {
  prefs: ChartPrefs;
  set: (patch: Partial<ChartPrefs>) => void;
}

const ChartPrefsContext = createContext<Ctx | null>(null);

const DEFAULTS: ChartPrefs = { type: "line", range: 36, log: false };

export function ChartPrefsProvider({ children, initial }: { children: ReactNode; initial?: Partial<ChartPrefs> }) {
  const [prefs, setPrefs] = useState<ChartPrefs>({ ...DEFAULTS, ...initial });
  const value = useMemo<Ctx>(
    () => ({ prefs, set: (patch) => setPrefs((p) => ({ ...p, ...patch })) }),
    [prefs]
  );
  return <ChartPrefsContext.Provider value={value}>{children}</ChartPrefsContext.Provider>;
}

/** 读取共享偏好；无 Provider 时返回 null，调用方自行使用默认值 */
export function useChartPrefs(): Ctx | null {
  return useContext(ChartPrefsContext);
}

const TYPES: Array<{ key: ChartType; label: string }> = [
  { key: "line", label: "折线" },
  { key: "bar", label: "柱状" },
  { key: "area", label: "面积" },
];
const RANGES: Array<{ key: ChartRange; label: string }> = [
  { key: 12, label: "12 期" },
  { key: 36, label: "36 期" },
  { key: 60, label: "60 期" },
  { key: 120, label: "120 期" },
  { key: 0, label: "全部" },
];

/**
 * 全局图表控制条。视觉上是一条细发丝线下的工具带，不做成卡片，
 * 避免与页内图表卡片争夺层级。
 */
export function ChartPrefsBar({ count }: { count?: number }) {
  const ctx = useChartPrefs();
  if (!ctx) return null;
  const { prefs, set } = ctx;

  const btn = (active: boolean) =>
    `px-2 py-0.5 text-[11px] transition-colors ${
      active ? "bg-primary text-white font-medium" : "text-muted hover:text-foreground"
    }`;

  return (
    <div className="flex items-center gap-3 flex-wrap border-b border-border pb-2.5 mb-4">
      <span className="text-[11px] text-muted font-mono">图表设置</span>
      {count != null ? <span className="text-[11px] text-muted">统一作用于本页 {count} 张图</span> : null}

      <div className="flex items-center gap-1" role="group" aria-label="图形类型">
        {TYPES.map((t) => (
          <button key={t.key} type="button" aria-pressed={prefs.type === t.key}
            className={btn(prefs.type === t.key)} onClick={() => set({ type: t.key })}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="时间窗口">
        {RANGES.map((r) => (
          <button key={r.key} type="button" aria-pressed={prefs.range === r.key}
            className={btn(prefs.range === r.key)} onClick={() => set({ range: r.key })}>
            {r.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
        <input type="checkbox" checked={prefs.log} onChange={(e) => set({ log: e.target.checked })}
          className="accent-[var(--color-primary)]" />
        对数轴
      </label>

      <button type="button" onClick={() => set(DEFAULTS)}
        className="text-[11px] text-muted hover:text-foreground underline underline-offset-2">
        恢复默认
      </button>
    </div>
  );
}
