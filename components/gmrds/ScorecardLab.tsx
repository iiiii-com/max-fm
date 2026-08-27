"use client";

import { useMemo, useState } from "react";
import RadarChart from "./RadarChart";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

export interface ScoreDef {
  no: number;
  label: string;
  weight: number; // 权重（%）
  auto: number; // 自动评分（-5 ~ +5，真实数据计算）
  basis: string; // 评分依据
}

const STAGE_COLORS = ["#0ea5e9", "#10b981", "#ec4899", "#eab308"];

function stageOf(no: number) {
  if (no <= 2) return 1;
  if (no <= 4) return 2;
  if (no <= 8) return 3;
  return 4;
}

/**
 * 十一环节全流程评分实验台
 * 环节 1-9 评分（自动计算 + 可手动覆写）→ 加权 → 环节 10 仓位结论 → 环节 11 复盘建议
 */
export default function ScorecardLab({ defs }: { defs: ScoreDef[] }) {
  const [scores, setScores] = useState<Record<number, number>>(() =>
    Object.fromEntries(defs.map((d) => [d.no, d.auto]))
  );

  const weighted = useMemo(() => {
    let sum = 0;
    defs.forEach((d) => (sum += scores[d.no] * d.weight));
    return sum; // 加权总分（各环节 -5~5 × 权重）
  }, [scores, defs]);

  const totalWeight = defs.reduce((a, d) => a + d.weight, 0);
  const norm = (weighted / totalWeight) * 10 + 50; // 映射到 0-100
  const stance = norm >= 65 ? { label: "进攻", range: "60-80%", tone: "#d7000b" } : norm >= 45 ? { label: "平衡", range: "40-60%", tone: "#3b82f6" } : { label: "防守", range: "20-40%", tone: "#0aa06e" };

  const radarDims = defs.map((d) => ({ name: d.label.replace("评估", "").replace("判断", "").replace("确认", ""), max: 5 }));
  const radarSeries = [
    { name: "当前评分", values: defs.map((d) => scores[d.no] ?? 0), color: "#c8102e" },
    { name: "中性线", values: defs.map(() => 0), color: "#94a3b8" },
  ];

  // 评分瀑布：各环节加权贡献（得分 × 权重）
  const contrib = defs.map((d) => ({
    label: d.label.replace("评估", "").replace("判断", "").replace("确认", "").replace("研判", "").replace("定位", "").replace("确认", "").slice(0, 4),
    v: Number(((scores[d.no] ?? 0) * d.weight).toFixed(1)),
  }));
  const waterfallOption: EChartsOption = {
    animation: false,
    grid: { left: 40, right: 30, top: 12, bottom: 24 },
    xAxis: { type: "category", data: contrib.map((c) => c.label), axisLabel: { fontSize: 9 } },
    yAxis: { type: "value", axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "#eef0ec" } } },
    tooltip: { trigger: "axis", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 }, formatter: (p: any) => { const i = Array.isArray(p) ? p[0]?.dataIndex ?? 0 : 0; const c = contrib[i]; return `<b>${c.label}</b><br/>贡献 ${c.v >= 0 ? "+" : ""}${c.v}`; } },
    series: [
      {
        type: "bar",
        data: contrib.map((c) => ({
          value: c.v,
          itemStyle: { color: c.v >= 0 ? "rgba(215,0,11,0.75)" : "rgba(10,160,110,0.75)", borderRadius: 2 },
        })),
        barWidth: "55%",
        markLine: {
          silent: true, symbol: "none",
          lineStyle: { color: "#8b5cf6", width: 1.2 },
          label: { formatter: `加权总分 ${weighted.toFixed(1)}`, fontSize: 9, color: "#8b5cf6", position: "insideEndTop" },
          data: [{ yAxis: 0 }],
        },
      },
    ],
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* 环节评分表 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2 pl-2 pr-2 font-medium">环节</th>
                <th className="text-left px-2 font-medium">权重</th>
                <th className="text-left px-2 font-medium w-28">评分（-5~+5）</th>
                <th className="text-left px-2 pr-2 font-medium">依据（真实数据 / 输入）</th>
              </tr>
            </thead>
            <tbody>
              {defs.map((d) => {
                const stage = stageOf(d.no);
                return (
                  <tr key={d.no} className="border-b border-border/40 align-top">
                    <td className="py-2 pl-2 pr-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-4 rounded" style={{ background: STAGE_COLORS[stage - 1] }} />
                        <b>{d.no} {d.label}</b>
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-muted">{d.weight}%</td>
                    <td className="py-2 px-2">
                      <input
                        type="number" min={-5} max={5} step={0.5}
                        value={scores[d.no] ?? 0}
                        onChange={(e) => setScores((s) => ({ ...s, [d.no]: clampNum(Number(e.target.value)) }))}
                        className={`w-20 px-2 py-1 rounded border text-center font-mono text-sm ${(scores[d.no] ?? 0) > 0 ? "border-red-300 text-red-600" : (scores[d.no] ?? 0) < 0 ? "border-green-300 text-green-600" : "border-border"}`}
                      />
                    </td>
                    <td className="py-2 px-2 pr-2 text-[11px] text-muted leading-relaxed">{d.basis}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 结论面板 */}
        <div className="space-y-3">
          <div className="rounded-lg border p-4 text-center" style={{ borderColor: `${stance.tone}55`, background: `${stance.tone}0d` }}>
            <p className="text-[11px] text-muted">综合评分（归一化 0-100）</p>
            <p className="text-3xl font-black font-mono mt-1" style={{ color: stance.tone }}>{norm.toFixed(0)}</p>
            <p className="mt-2 text-sm font-bold" style={{ color: stance.tone }}>
              {stance.label}仓位 · 建议 {stance.range}
            </p>
            <p className="text-[10px] text-muted mt-1">环节 10 仓位决策（≥65 进攻 / 45-65 平衡 / {"<"}45 防守）</p>
          </div>
          <RadarChart
            dims={radarDims}
            series={radarSeries}
            title="九环节评分雷达"
            caption="雷达图：环节 1-9 当前评分（红线）vs 中性线（灰）；正分偏多/负分偏空，形状直观呈现研究结论的方向一致性。"
          />
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[11px] font-bold text-primary mb-2">评分瀑布 · 各环节加权贡献 → 总分</p>
            <EChart option={waterfallOption} height={260} />
            <p className="text-[10px] text-muted mt-1">瀑布：每环节 = 得分 × 权重，正贡献红柱上伸、负贡献绿柱下探；右侧菱形为加权总分（未归一化）。</p>
          </div>
          <p className="text-[11px] text-muted leading-relaxed rounded-lg border border-border p-3">
            <b>环节 11 复盘建议：</b>记录本评分快照，对比后续市场结果做四维归因（宏观β/行业α/个股α/择时），
            每季度校准一次权重与阈值（如综合分 65 阈值经回测验证后再启用）。
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted">
        自动评分为真实数据计算（上证/茅台/技术信号，见各环节依据）；手动输入可覆写模拟不同情景。权重为框架设定（环节 1-9 合计 100%），待回测校准。
      </p>
    </div>
  );
}

function clampNum(v: number) {
  if (!isFinite(v)) return 0;
  return Math.max(-5, Math.min(5, v));
}
