"use client";

import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { PieChart } from "lucide-react";

interface Attr { label: string; value: number; color: string; desc: string }

/** 复盘绩效归因图：宏观β / 行业α / 个股α / 择时 四维分解（基于真实年度收益的教学性归因） */
export default function AttributionChart({ year = 2024 }: { year?: number }) {
  // 2024 年上证 +12.7%（真实）：宏观β 为基准；其余维度为教学性归因示例（标注说明）
  const base = 12.7;
  const attrs: Attr[] = [
    { label: "宏观β（上证基准）", value: base, color: "#3b82f6", desc: "2024 年上证 +12.7%（sh-index.json 真实年度收益）" },
    { label: "行业α（超配科技）", value: 5.2, color: "#d7000b", desc: "2024 年 AI/半导体行业跑赢大盘的部分（东财行业指数，示意）" },
    { label: "个股α（选股）", value: 2.8, color: "#f59e0b", desc: "龙头股相对行业超额（示意）" },
    { label: "择时α（10月减仓）", value: 1.5, color: "#16a34a", desc: "2024-10-08 高点 3489.78 减仓规避回调（真实高点）" },
  ];
  const total = attrs.reduce((a, b) => a + b.value, 0);
  const pctOf = (v: number) => ((v / total) * 100).toFixed(1);

  const opt: EChartsOption = {
    animation: false,
    tooltip: { trigger: "item", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 }, formatter: (p: any) => `<b>${p.name}</b><br/>贡献 ${p.value} 个百分点（${pctOf(p.value)}%）<br/>${attrs[p.dataIndex]?.desc ?? ""}` },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    series: [
      {
        type: "pie", radius: ["38%", "62%"], center: ["50%", "44%"],
        data: attrs.map((a) => ({ name: a.label, value: Number(a.value.toFixed(1)) })),
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 1.5 },
        label: { fontSize: 10, formatter: "{b}\n{c}pp" },
        emphasis: { scaleSize: 6 },
      },
    ],
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold mb-1 text-primary">
        <PieChart className="w-4 h-4" /> 复盘绩效归因图 · {year} 年四维分解
      </p>
      <EChart option={opt} height={260} />
      <p className="text-[10px] text-muted mt-1 leading-relaxed">
        组合收益 = 宏观β（基准）+ 行业α + 个股α + 择时α。图中<b>宏观β +12.7% 为上证 {year} 年真实年度收益</b>（sh-index.json）；
        行业/个股/择时 α 为教学性归因示例（演示方法，数值待实盘记录回填）。该图承载环节 11 的『收益来自哪里』核心输出。
      </p>
    </div>
  );
}
