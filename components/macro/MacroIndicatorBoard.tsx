"use client";

/**
 * 宏观指标看板：Tab 分组 + 全局图表控制条
 *
 * 为什么拆成客户端组件：
 * /macro 是 server component（数据在服务端取自 economic_indicators），
 * 而「切 Tab」和「统一图表设置」是纯交互，必须在客户端。
 * 这里由服务端把已经算好的卡片数据传进来，客户端只管展示与状态。
 *
 * 交互改造的动机：此前 24 张图平铺，页面高约 8000px，用户滚到底也说不清
 * 「总量是扩张还是收缩」——因为同屏没有可比对的同类指标。
 * 分成四组后，每组 4~7 张同类指标天然可横向比对。
 */

import { useMemo, useState } from "react";
import { TrendCard } from "@/components/charts/IndicatorLine";
import { ChartPrefsProvider, ChartPrefsBar } from "@/components/charts/chart-prefs";
import { MACRO_GROUPS, type MacroGroup } from "@/lib/data/macro-indicators";

export interface MacroCard {
  type: string;
  title: string;
  group: MacroGroup;
  unit: string;
  changeUnit: string;
  color: string;
  value: number;
  data: Array<{ date: string; value: number }>;
  yoy: number | null;
  mom: number | null;
  source?: string;
}

const GROUP_HINT: Record<MacroGroup, string> = {
  总量景气: "经济总量与生产端景气：判断经济在扩张还是收缩",
  价格: "价格水平：通胀压力与企业盈利空间",
  货币金融: "货币与融资条件：利率、信用与流动性",
  需求外贸: "内需与外需：消费、投资、进出口与汇率",
};

export default function MacroIndicatorBoard({ cards }: { cards: MacroCard[] }) {
  const [active, setActive] = useState<MacroGroup>(MACRO_GROUPS[0]);

  const byGroup = useMemo(() => {
    const m = new Map<MacroGroup, MacroCard[]>();
    for (const g of MACRO_GROUPS) m.set(g, []);
    for (const c of cards) {
      // 未知分组归入第一组，避免指标被静默丢弃
      const g = m.has(c.group) ? c.group : MACRO_GROUPS[0];
      m.get(g)!.push(c);
    }
    return m;
  }, [cards]);

  const shown = byGroup.get(active) ?? [];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-bold text-lg">宏观指标</h2>
        <p className="text-[11px] text-muted">
          共 {cards.length} 项，按性质分组查看
        </p>
      </div>

      {/* Tab：编号 + 名称 + 数量。研究类版式用一条下边线表示选中，不用彩色胶囊 */}
      <div
        className="flex gap-1 overflow-x-auto border-b border-border mb-1"
        role="tablist"
        aria-label="宏观指标分组"
      >
        {MACRO_GROUPS.map((g, i) => {
          const n = byGroup.get(g)?.length ?? 0;
          const on = g === active;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              id={`macro-tab-${g}`}
              aria-selected={on}
              aria-controls={`macro-panel-${g}`}
              disabled={n === 0}
              onClick={() => setActive(g)}
              className={`shrink-0 px-3 py-2 text-sm border-b-2 -mb-px transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                on
                  ? "border-border-strong text-foreground font-medium"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span className="font-mono text-[11px] mr-1.5 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              {g}
              <span className="ml-1.5 text-[11px] text-muted tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted mb-3">{GROUP_HINT[active]}</p>

      <ChartPrefsProvider>
        <ChartPrefsBar count={shown.length} />
        <div
          role="tabpanel"
          id={`macro-panel-${active}`}
          aria-labelledby={`macro-tab-${active}`}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {shown.map((c) => (
            <TrendCard
              key={c.type}
              title={c.title}
              value={c.value}
              unit={c.unit}
              changeUnit={c.changeUnit}
              color={c.color}
              data={c.data}
              yoy={c.yoy}
              mom={c.mom}
              source={c.source}
            />
          ))}
        </div>
      </ChartPrefsProvider>
    </section>
  );
}
