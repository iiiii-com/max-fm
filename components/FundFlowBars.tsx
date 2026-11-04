"use client";

import { useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { BarChart3 } from "lucide-react";

export interface FlowItem {
  code: string;
  name: string;
  mainFlow: number | null;
}

export interface FlowSet {
  key: string;
  label: string;
  inflow: FlowItem[];
  outflow: FlowItem[];
}

const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const fmtYi = (v: number) => `${(v / 1e8).toFixed(1)}亿`;

/**
 * 资金流向对比条形图（流入 vs 流出）。
 *
 * 为什么用「背离式」横向条而不是两张柱状图：
 * - 两张图各自从 0 起画，读者很难直接比出「流入 12 亿」和「流出 9 亿」谁更强；
 * - 放在同一根 0 轴上，红色向右、绿色向左，正负方向本身就是对比，一眼能看出资金是
 *   净流入主导还是净流出主导。
 * 数值统一换算成「亿」，轴范围取两侧绝对值最大值对称，避免视觉放大某一侧。
 */
export default function FundFlowBars({ sets }: { sets: FlowSet[] }) {
  const [active, setActive] = useState(0);
  const set = sets[active] ?? sets[0];

  const rows = useMemo(() => {
    const ins = (set?.inflow ?? [])
      .filter((it) => isNum(it.mainFlow) && it.mainFlow >= 0)
      .sort((a, b) => (b.mainFlow as number) - (a.mainFlow as number))
      .slice(0, 8);
    const outs = (set?.outflow ?? [])
      .filter((it) => isNum(it.mainFlow) && it.mainFlow < 0)
      .sort((a, b) => (b.mainFlow as number) - (a.mainFlow as number))
      .slice(0, 8);
    return [...ins, ...outs];
  }, [set]);

  const maxAbs = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(r.mainFlow as number))),
    [rows],
  );

  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(255,255,255,0.96)",
      borderColor: "#e2e0dc",
      textStyle: { color: "#3a3834", fontSize: 11 },
      formatter: (p: any) => {
        const v = Number(p?.value) || 0;
        const tag = v >= 0 ? "主力净流入" : "主力净流出";
        return `<b>${p?.name ?? ""}</b><br/>${tag} ${fmtYi(Math.abs(v))}`;
      },
    },
    grid: { left: 92, right: 58, top: 6, bottom: 22 },
    xAxis: {
      type: "value",
      min: -maxAbs * 1.35,
      max: maxAbs * 1.35,
      axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 1e8).toFixed(0)}亿` },
      splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((r) => r.name),
      axisTick: { show: false },
      axisLabel: { fontSize: 10, width: 84, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        barWidth: "62%",
        data: rows.map((r) => {
          const v = r.mainFlow as number;
          return {
            value: v,
            itemStyle: { color: v >= 0 ? "rgba(215,0,11,0.78)" : "rgba(10,160,110,0.8)", borderRadius: 2 },
            label: {
              show: true,
              position: v >= 0 ? "right" : "left",
              formatter: `${v >= 0 ? "+" : "-"}${Math.abs(v / 1e8).toFixed(1)}亿`,
              fontSize: 9,
              color: "#8a8780",
            },
          };
        }),
      },
    ],
  };

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-bold flex items-center gap-1">
          <BarChart3 className="w-3.5 h-3.5" /> 资金流向对比
        </p>
        <p className="text-xs text-muted mt-2">暂无可对比的流入/流出数据（上游缺失时不补 0）。</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="flex items-center gap-1 text-[11px] font-bold">
          <BarChart3 className="w-3.5 h-3.5" /> 资金流向对比
        </span>
        <span className="text-[10px] text-muted">红=净流入 · 绿=净流出 · 单位亿元</span>
        <div className="ml-auto flex items-center gap-1">
          {sets.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActive(i)}
              className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors ${
                i === active ? "bg-primary text-white border-primary" : "border-border text-muted hover:border-primary/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <EChart option={option} height={Math.max(180, rows.length * 21 + 28)} />
    </div>
  );
}
