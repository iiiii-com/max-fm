"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { RefreshCw } from "lucide-react";

interface RankItem { code: string; name: string; mainFlow: number; pct: number | null }

/** 行业轮动矩阵：相对强度(涨跌幅) × 主力资金流 四象限（东财真实） */
export default function RotationMatrix() {
  const [items, setItems] = useState<RankItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setErr("");
    fetch("/api/market/fund-rank", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          // 板块流入榜 + 流出榜合并，补充 pct 数据（流入榜有 pct，流出榜补充）
          const all = [...(j.sectorIn ?? []), ...(j.sectorOut ?? [])];
          const merged = new Map<string, RankItem>();
          all.forEach((s: RankItem) => {
            if (!merged.has(s.code)) merged.set(s.code, s);
            else if (merged.get(s.code)!.pct == null && s.pct != null) merged.set(s.code, s);
          });
          setItems([...merged.values()].slice(0, 16));
        } else setErr(j?.error ?? "加载失败");
      })
      .catch((e) => setErr(e?.message ?? "加载失败"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (err) return <p className="text-sm text-muted py-6 text-center">{err}</p>;
  if (loading && !items.length) return <div className="h-64 animate-pulse bg-muted/10 rounded-lg" />;

  const data = items.map((s) => ({ x: s.pct ?? 0, y: s.mainFlow / 1e8, name: s.name, flow: s.mainFlow }));
  const maxFlow = Math.max(...data.map((d) => Math.abs(d.y)), 5);

  const opt: EChartsOption = {
    animation: false,
    tooltip: { trigger: "item", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 }, formatter: (p: any) => { const d = p.data; return `<b>${d[2]}</b><br/>涨跌幅 ${d[0] >= 0 ? "+" : ""}${d[0].toFixed(2)}%<br/>主力净流入 ${d[1] >= 0 ? "+" : ""}${d[1].toFixed(1)}亿`; } },
    grid: { left: 30, right: 30, top: 26, bottom: 24 },
    xAxis: { type: "value", name: "相对强度（涨跌幅%）", nameLocation: "middle", nameGap: 24, min: -12, max: 12, axisLabel: { fontSize: 9 } },
    yAxis: { type: "value", name: "主力资金（亿）", min: -maxFlow, max: maxFlow, axisLabel: { fontSize: 9 } },
    series: [
      {
        type: "scatter",
        data: data.map((d) => ({
          value: [Number(d.x.toFixed(2)), Number(d.y.toFixed(1))],
          symbolSize: Math.min(46, 12 + (Math.abs(d.y) / maxFlow) * 30),
          itemStyle: { color: d.y >= 0 ? "rgba(215,0,11,0.55)" : "rgba(10,160,110,0.55)", borderColor: "#fff", borderWidth: 1 },
          label: { show: true, formatter: d.name, position: "top", fontSize: 8.5, color: "#64748b" },
        })),
        markArea: {
          silent: true,
          data: [
            [{ coord: [0, 0], name: "超配区\n强+流入" }, { coord: [12, maxFlow] }],
            [{ coord: [-12, 0], name: "观察区\n弱+流入" }, { coord: [0, maxFlow] }],
            [{ coord: [0, -maxFlow], name: "回避区\n弱+流出" }, { coord: [12, 0] }],
            [{ coord: [-12, -maxFlow], name: "规避区\n弱+流出" }, { coord: [0, 0] }],
          ],
          itemStyle: { opacity: 0.1 },
          label: { show: true, fontSize: 9, color: "#64748b" },
        },
        markLine: {
          silent: true, symbol: "none", lineStyle: { color: "#cbd5e1", width: 0.8 },
          data: [{ xAxis: 0 }, { yAxis: 0 }],
        },
      },
    ],
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-primary">🔄 行业轮动矩阵 · 强度 × 资金四象限（真实）</p>
        <button onClick={load} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border text-muted hover:text-primary">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> 刷新
        </button>
      </div>
      <EChart option={opt} height={300} />
      <p className="text-[10px] text-muted mt-1">
        右上「超配区」= 强度强 + 资金流入（行业配置首选）；左下「规避区」= 强度弱 + 资金流出（回避）。数据来自东财板块资金榜（f62），承载环节 4 的行业筛选决策。
      </p>
    </div>
  );
}
