"use client";

import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { BarChart3 } from "lucide-react";
import { DEPTH_STEPS } from "@/lib/data/gmrds-depth";

/** 决策流程甘特图：11 环节时间线 + 阶段依赖（数据接力可视化） */
export default function DecisionGantt() {
  const stages = ["宏观研判", "资产与行业", "标的研究", "执行与优化"];
  const stageColor: Record<string, string> = {
    宏观研判: "#3b82f6", 资产与行业: "#16a34a", 标的研究: "#e11d48", 执行与优化: "#f59e0b",
  };
  // 每环节时间跨度（模拟相对耗时，展示依赖关系）
  const duration = [6, 5, 7, 6, 7, 6, 5, 4, 5, 4, 5];
  let cursor = 0;
  const rows = DEPTH_STEPS.map((s) => {
    const start = cursor;
    cursor += duration[s.no - 1] + 1;
    return { no: s.no, title: s.title, stage: s.stage, start, span: duration[s.no - 1] };
  });
  const total = cursor;

  const opt: EChartsOption = {
    animation: false,
    tooltip: { trigger: "item", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 }, formatter: (p: any) => { const d = p.data; return `<b>环节 ${d.no} · ${d.title}</b><br/>阶段：${d.stage}<br/>输出作为下一环节输入（数据接力）`; } },
    grid: { left: 90, right: 20, top: 8, bottom: 24 },
    xAxis: { type: "value", min: 0, max: total, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: "category", data: rows.map((r) => `环节${r.no} ${r.title}`).reverse(), axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        data: rows.map((r) => ({
          value: r.span,
          // 占位实现左对齐：用 stack 前导透明段
        })),
        barWidth: 14,
        showBackground: true,
        backgroundStyle: { color: "rgba(148,163,184,0.12)" },
        itemStyle: { color: (p: any) => stageColor[rows[rows.length - 1 - p.dataIndex].stage] ?? "#94a3b8", borderRadius: 3 },
        label: { show: true, position: "right", fontSize: 9, color: "#64748b", formatter: (p: any) => rows[rows.length - 1 - p.dataIndex].stage },
      },
    ],
    graphic: stages.map((st, i) => ({
      type: "text",
      left: 92 + (i * total) / stages.length,
      top: 0,
      style: { text: st, fontSize: 10, fontWeight: 700, fill: stageColor[st] },
    })),
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
        <BarChart3 className="w-4 h-4" /> 决策流程甘特图 · 11 环节数据接力
      </p>
      <EChart option={opt} height={360} />
      <p className="text-[10px] text-muted mt-1">
        展示 11 环节的先后顺序与四大阶段分组：每环节输出作为下一环节输入（宏观→流动性→周期→行业→盈利→估值→技术→情绪→风险→仓位→复盘）。
        颜色区分阶段：蓝=宏观研判 · 绿=资产与行业 · 红=标的研究 · 橙=执行与优化。该图承载体系『层层递进、互相支撑』的结构信息。
      </p>
    </div>
  );
}
