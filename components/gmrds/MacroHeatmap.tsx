"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { Flame } from "lucide-react";

interface Macro { ok: boolean; stage?: string; score?: number; summary?: string; idx?: { yearChg?: number | null; annVol?: number | null } }

/** 宏观经济热力图：增长(近1年涨跌)×通胀(宏观评分代理) 四象限 + 当前宏观定位（真实数据） */
export default function MacroHeatmap() {
  const [m, setM] = useState<Macro | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/macro/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setM(j) : setErr(j?.error ?? "加载失败")))
      .catch((e) => setErr(e?.message ?? "加载失败"));
  }, []);

  if (err) return <p className="text-sm text-muted py-6 text-center">{err}</p>;
  if (!m) return <div className="h-64 animate-pulse bg-muted/10 rounded-lg" />;

  const growth = m.idx?.yearChg ?? 0; // 近1年涨跌（%）
  const heat = m.score ?? 50; // 宏观评分（0-100）
  const isOverheat = heat >= 65 && growth >= 0;
  const isStag = heat < 45 && growth <= 0;
  const stage = m.stage ?? "—";

  // 象限定位：x = 增长（近1年涨跌），y = 通胀/政策温度（评分）
  const x = Math.max(-15, Math.min(15, growth)) / 15; // -1 ~ 1
  const y = ((heat - 50) / 50) * 1.6; // 0~100 → -1.6~1.6 映射

  const opt: EChartsOption = {
    animation: false,
    grid: { left: 20, right: 20, top: 24, bottom: 24 },
    xAxis: { type: "value", min: -1.2, max: 1.2, show: false },
    yAxis: { type: "value", min: -1.8, max: 1.8, show: false },
    series: [
      {
        type: "scatter",
        data: [[-0.6, -1.2], [0.6, -1.2], [-0.6, 1.2], [0.6, 1.2], [x, y]],
        symbolSize: [0, 0, 0, 0, 22],
        itemStyle: { color: isOverheat ? "#d7000b" : isStag ? "#0aa06e" : "#3b82f6", borderColor: "#fff", borderWidth: 2 },
        label: { show: true, formatter: "当前", position: "top", fontSize: 10, fontWeight: 700 },
        markArea: {
          silent: true,
          data: [
            [{ coord: [-1.2, -1.8], name: "衰退防御\n（低增长·政策宽松）" }, { coord: [0, 0] }],
            [{ coord: [0, -1.8] }, { coord: [1.2, 0], name: "复苏期\n（低通胀·增长回升）" }],
            [{ coord: [-1.2, 0] }, { coord: [0, 1.8], name: "滞胀期\n（高通胀·低增长）" }],
            [{ coord: [0, 0] }, { coord: [1.2, 1.8], name: "过热期\n（高增长·高通胀）" }],
          ],
          itemStyle: { opacity: 0.12 },
          label: { show: true, fontSize: 9, color: "#64748b" },
        },
        markLine: {
          silent: true, symbol: "none",
          lineStyle: { color: "#cbd5e1", width: 0.8 },
          data: [{ xAxis: 0 }, { yAxis: 0 }],
        },
      },
    ],
    graphic: [
      { type: "text", left: "8%", top: "6%", style: { text: `当前宏观阶段：${stage}（评分 ${heat}）`, fontSize: 11, fontWeight: 700, fill: "#64748b" } },
      { type: "text", right: "6%", bottom: "2%", style: { text: `增长轴=上证近1年 ${growth >= 0 ? "+" : ""}${growth}% · 纵轴=宏观评分（政策温度代理）`, fontSize: 9, fill: "#94a3b8" } },
    ],
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold mb-2 text-primary">
        <Flame className="w-4 h-4" /> 宏观经济热力图 · 美林时钟定位（真实数据）
      </p>
      <EChart option={opt} height={300} />
      <p className="text-[10px] text-muted mt-1">
        四象限：<b>过热期</b>（高增长+高温度→商品/周期）· <b>复苏期</b>（低温度+增长回升→权益成长）· <b>衰退防御</b>（低增长+宽松→债券/现金）· <b>滞胀期</b>（高通胀+低增长→防御/资源）。
        当前定位来自 /api/macro/context（上证真实数据自算）。该图承载环节 1 的『该配什么』决策输出。
      </p>
    </div>
  );
}
