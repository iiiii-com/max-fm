"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { Gauge } from "lucide-react";

interface MacroCtx {
  stage?: string;
  score?: number;
  equityPref?: string;
  summary?: string;
}

interface MacroIndex {
  name?: string;
  yearChg?: number | null;
  vsMa250?: number | null;
  annVol?: number | null;
}

/** 降级信息：上游不可达时表盘读数来自快照，必须显式告知 */
interface Meta {
  asOf?: string;
  source?: string;
  stale?: boolean;
}

/** 宏观表盘：宏观评分 / 年化波动 / 近 1 年涨跌（/api/macro/context 真实自算） */
export default function MacroGauges() {
  // 注意：接口返回的是嵌套结构 { ok, updated, index: {...}, macro: {...} }，
  // 必须分别取 j.macro / j.index。曾按扁平结构读 m.score / m.idx.annVol，
  // 导致三个表盘全部显示 0（真实数据其实正常返回）。
  const [macro, setMacro] = useState<MacroCtx | null>(null);
  const [idx, setIdx] = useState<MacroIndex | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/macro/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setMacro(j.macro ?? null);
          setIdx(j.index ?? null);
          setMeta({ asOf: j.asOf, source: j.source, stale: j.stale });
        } else {
          setErr(j?.error ?? "加载失败");
        }
      })
      .catch((e) => setErr(e?.message ?? "加载失败"));
  }, []);

  if (err) return <p className="text-sm text-muted py-6 text-center" role="alert">{err}</p>;
  if (!macro) return <div className="h-56 animate-pulse bg-muted/10 rounded-lg" aria-busy="true" />;

  const score = macro.score ?? 0;
  const vol = idx?.annVol ?? 0;
  const yr = idx?.yearChg ?? 0;
  const scoreColor = score >= 65 ? "#c0392b" : score >= 45 ? "#1d4ed8" : "#1e8449";

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
        progress: { show: true, width: 12, itemStyle: { color: vol > 30 ? "#c0392b" : "#b45309" } },
        axisLine: { lineStyle: { width: 12 } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
        detail: { valueAnimation: false, formatter: `{value}%\n年化波动`, fontSize: 12, fontWeight: 700, offsetCenter: [0, "-4%"] },
        data: [{ value: Number(vol.toFixed(1)) }],
      },
      {
        type: "gauge", center: ["82%", "55%"], radius: "90%", min: -20, max: 40, startAngle: 210, endAngle: -30,
        progress: { show: true, width: 12, itemStyle: { color: yr >= 0 ? "#c0392b" : "#1e8449" } },
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
        <Gauge className="w-4 h-4" /> 宏观表盘 · {macro.stage ?? "—"}
      </p>
      <p className="text-[11px] text-muted mb-2">
        {macro.summary ?? ""}
        {macro.equityPref ? ` · 资产偏好：${macro.equityPref}` : ""}
      </p>
      <EChart option={option} height={240} />
      {meta?.stale ? (
        <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900" role="status">
          <b>数据已降级</b>：实时行情源不可达，以下读数取自 {meta.asOf ?? "最近一次可用快照"}
          ，非当前值，请勿据此决策。
        </p>
      ) : null}
      <p className="text-[10px] text-muted mt-1">
        数据源：{meta?.source ?? "/api/macro/context"}
        {meta?.asOf ? ` · 截至 ${meta.asOf}` : ""}
        （上证真实数据自算：近1年涨跌/距250日线/年化波动）· GMRDS 环节 1+3 口径
      </p>
    </div>
  );
}
