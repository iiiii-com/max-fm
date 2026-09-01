"use client";

import { useEffect, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { Gauge } from "lucide-react";

interface VP {
  ok: boolean;
  current?: { pe: number | null; pb: number | null };
  stats?: { min: number; max: number; avg: number; pctile: number; samples: number; period: string };
  series?: Array<{ date: string; pe: number }>;
}

/** 估值分位：PE 历史曲线 + 当前分位 + 统计（东财近 5 年历史估值） */
export default function ValuationPercentile({ secid, name }: { secid: string; name?: string }) {
  const [d, setD] = useState<VP | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/valuation-percentile?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (cancelled ? null : j?.ok ? setD(j) : setErr(j?.error ?? "估值数据加载失败")))
      .catch((e) => !cancelled && setErr(e?.message ?? "加载失败"));
    return () => { cancelled = true; };
  }, [secid]);

  if (err) return <p className="text-sm text-muted py-4 text-center">{err}</p>;
  if (!d) return <div className="h-40 animate-pulse bg-muted/10 rounded-lg" />;

  const s = d.stats!;
  const cur = d.current?.pe ?? 0;
  const opt: EChartsOption = {
    animation: false,
    tooltip: { trigger: "axis", backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#cbd5e1", textStyle: { color: "#1e293b", fontSize: 11 }, formatter: (p: any) => { const i = Array.isArray(p) ? p[0]?.dataIndex ?? 0 : 0; const pt = d.series?.[i]; return pt ? `<b>${pt.date}</b><br/>PE(TTM) ${pt.pe}` : ""; } },
    grid: { left: 46, right: 16, top: 30, bottom: 26 },
    xAxis: { type: "category", data: d.series?.map((p) => p.date) ?? [], axisLabel: { fontSize: 8, interval: Math.floor((d.series?.length ?? 1) / 5) } },
    yAxis: { type: "value", scale: true, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "#292929", type: "dashed" } } },
    series: [
      {
        name: "PE(TTM)", type: "line", data: d.series?.map((p) => p.pe) ?? [], showSymbol: false, lineStyle: { width: 1.4, color: "#3b82f6" },
        areaStyle: { color: "rgba(59,130,246,0.08)" },
        markLine: {
          silent: true, symbol: "none",
          data: [
            { yAxis: s.avg, lineStyle: { color: "#f59e0b", width: 0.8, type: "dashed" }, label: { formatter: `均值 ${s.avg}`, fontSize: 8, color: "#d97706", position: "insideEndTop" } },
            { yAxis: cur, lineStyle: { color: "#d7000b", width: 1 }, label: { formatter: `当前 ${cur}`, fontSize: 9, color: "#d7000b", position: "insideEndTop" } },
          ],
        },
      },
    ],
  };

  // 分位档位判定
  const band = s.pctile < 20 ? { label: "低估值区", cls: "down", note: "当前 PE 处于历史低位，安全边际相对充足" } : s.pctile < 50 ? { label: "中低估值", cls: "plain", note: "估值低于历史中位" } : s.pctile < 80 ? { label: "中高估值", cls: "plain", note: "估值高于历史中位" } : { label: "高估值区", cls: "up", note: "当前 PE 处于历史高位，警惕拥挤" };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "当前 PE(TTM)", value: String(cur), cls: "" },
          { label: "历史分位", value: `${s.pctile}%`, cls: s.pctile < 20 ? "down" : s.pctile >= 80 ? "up" : "" },
          { label: "5 年区间", value: `${s.min} ~ ${s.max}`, cls: "" },
          { label: "5 年均值", value: String(s.avg), cls: "" },
        ].map((it) => (
          <div key={it.label} className="rounded-lg border border-border/60 px-2 py-1.5">
            <p className="text-[9px] text-muted">{it.label}</p>
            <p className={`text-[13px] font-mono font-bold ${it.cls}`}>{it.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        <p className="flex items-center gap-1 text-[11px] font-bold mb-1 text-primary">
          <Gauge className="w-3.5 h-3.5" /> PE(TTM) 近 5 年走势与当前分位 · {name ?? secid}
        </p>
        <EChart option={opt} height={220} />
      </div>

      <div className={`rounded-lg border px-3 py-2 text-[11px] ${s.pctile < 20 ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40" : s.pctile >= 80 ? "border-red-200 bg-red-50/40 dark:border-red-900/40" : "border-border"}`}>
        <b className={band.cls}>{band.label}</b>（分位 {s.pctile}%）· {band.note}。统计区间 {s.period}，样本 {s.samples} 个交易日。
        <span className="text-muted">数据源：东财历史估值，1 小时缓存。</span>
      </div>
    </div>
  );
}
