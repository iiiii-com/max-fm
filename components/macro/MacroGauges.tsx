"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { Gauge } from "lucide-react";

interface Macro {
  ok: boolean;
  stage?: string;
  score?: number;
  equityPref?: string;
  summary?: string;
  idx?: { yearChg?: number | null; vsMa250?: number | null; annVol?: number | null };
}

/** 宏观表盘：宏观评分 / 年化波动 / 近 1 年涨跌（/api/macro/context 真实自算） */
export default function MacroGauges() {
  const [m, setM] = useState<Macro | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/macro/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setM(j) : setErr(j?.error ?? "加载失败")))
      .catch((e) => setErr(e?.message ?? "加载失败"));
  }, []);

  if (err) return <p className="text-sm text-muted py-6 text-center">{err}</p>;
  if (!m) return <div className="h-56 animate-pulse bg-muted/10 rounded-lg" />;

  const score = m.score ?? 0;
  const vol = m.idx?.annVol ?? 0;
  const yr = m.idx?.yearChg ?? 0;
  const scoreColor = score >= 65 ? "#d7000b" : score >= 45 ? "#3b82f6" : "#0aa06e";

  const option: EChartsOption = {
    animation: false,
    series: [
      {
        type: "gauge", center: ["18%", "55%"], radius: "90%", min: 0, max: 100, startAngle: 210, endAngle: -30,
        progress: { show: true, width: 12, itemStyle: { color: scoreColor } },
        axisLine: { lineStyle: { width: 12 } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
        detail: { valueAnimation: false, formatter: `{value}\n宏观评分`, fontSize: 14, fontWeight: 700, color: scoreColor, offsetCenter: [0, "-4%"] },
        data: [{ value: Math.round(score) }],
      },
      {
        type: "gauge", center: ["50%", "55%"], radius: "90%", min: 0, max: 40, startAngle: 210, endAngle: -30,
        progress: { show: true, width: 12, itemStyle: { color: vol > 30 ? "#d7000b" : "#f59e0b" } },
        axisLine: { lineStyle: { width: 12 } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
        detail: { valueAnimation: false, formatter: `{value}%\n年化波动`, fontSize: 12, fontWeight: 700, offsetCenter: [0, "-4%"] },
        data: [{ value: Number(vol.toFixed(1)) }],
      },
      {
        type: "gauge", center: ["82%", "55%"], radius: "90%", min: -20, max: 40, startAngle: 210, endAngle: -30,
        progress: { show: true, width: 12, itemStyle: { color: yr >= 0 ? "#d7000b" : "#0aa06e" } },
        axisLine: { lineStyle: { width: 12 } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
        detail: { valueAnimation: false, formatter: `{value}%\n近1年涨跌`, fontSize: 12, fontWeight: 700, offsetCenter: [0, "-4%"] },
        data: [{ value: Number(yr.toFixed(1)) }],
      },
    ],
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold mb-1 text-primary">
        <Gauge className="w-4 h-4" /> 宏观表盘 · {m.stage}
      </p>
      <p className="text-[11px] text-muted mb-2">{m.summary} · 资产偏好：{m.equityPref}</p>
      <EChart option={option} height={240} />
      <p className="text-[10px] text-muted mt-1">
        数据源：/api/macro/context（上证真实数据自算：近1年涨跌/距250日线/年化波动）· GMRDS 环节 1+3 口径
      </p>
    </div>
  );
}
