"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

interface TrendPoint {
  period: string;
  date: string;
  revenue: number | null;
  netProfit: number | null;
  grossMargin: number | null;
  roe: number | null;
  eps: number | null;
}

/** 财务质量 5 维雷达（全部基于真实财报，归一化口径公开）：
 *  - 成长性：近 8 期营收复合增速（CAGR），[-50%,50%] → [0,100]
 *  - 利润成长：净利 CAGR，同上映射
 *  - 盈利能力：最新毛利率 [0%,60%] → [0,100]
 *  - 股东回报：最新加权 ROE [0%,30%] → [0,100]
 *  - 业绩稳定：ROE 标准差越小越稳，100 - std×5（clamp 0-100）
 */
function radarFromTrend(t: TrendPoint[]) {
  const revs = t.map((p) => p.revenue).filter((v): v is number => v != null && v > 0);
  const nps = t.map((p) => p.netProfit).filter((v): v is number => v != null && v > 0);
  const roes = t.map((p) => p.roe).filter((v): v is number => v != null);
  const gm = [...t].reverse().find((p) => p.grossMargin != null)?.grossMargin ?? null;
  const roe = [...t].reverse().find((p) => p.roe != null)?.roe ?? null;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const cagr = (arr: number[]) => {
    if (arr.length < 2) return null;
    const years = (arr.length - 1) / 2; // 每年 2 期（季报累计）
    if (years <= 0) return null;
    return (Math.pow(arr[arr.length - 1] / arr[0], 1 / years) - 1) * 100;
  };
  const revCagr = cagr(revs);
  const npCagr = cagr(nps);
  const roeStd = roes.length > 1 ? Math.sqrt(roes.reduce((a, v) => a + (v - roes.reduce((x, y) => x + y, 0) / roes.length) ** 2, 0) / roes.length) : null;

  const dims = [
    { name: "成长性\n(营收CAGR)", raw: revCagr, value: revCagr == null ? null : clamp(((revCagr + 50) / 100) * 100), basis: revCagr == null ? "—" : `${revCagr.toFixed(1)}%/半年期` },
    { name: "利润成长\n(净利CAGR)", raw: npCagr, value: npCagr == null ? null : clamp(((npCagr + 50) / 100) * 100), basis: npCagr == null ? "—" : `${npCagr.toFixed(1)}%/半年期` },
    { name: "盈利能力\n(毛利率)", raw: gm, value: gm == null ? null : clamp((gm / 60) * 100), basis: gm == null ? "—" : `${gm.toFixed(1)}%` },
    { name: "股东回报\n(ROE)", raw: roe, value: roe == null ? null : clamp((roe / 30) * 100), basis: roe == null ? "—" : `${roe.toFixed(1)}%` },
    { name: "业绩稳定\n(ROE波动)", raw: roeStd, value: roeStd == null ? null : clamp(100 - roeStd * 5), basis: roeStd == null ? "—" : `σ=${roeStd.toFixed(1)}` },
  ];
  return dims;
}

export default function RadarCard({ secid, isIndex }: { secid: string; isIndex: boolean }) {
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isIndex) return;
    let alive = true;
    setTrend(null);
    setErr("");
    fetch(`/api/stock/finance-trend?secid=${secid}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok && Array.isArray(j.trend) && j.trend.length) setTrend(j.trend);
        else setErr(j?.error ?? "财报数据暂不可用");
      })
      .catch(() => alive && setErr("财报数据暂不可用"));
    return () => {
      alive = false;
    };
  }, [secid, isIndex]);

  const dims = useMemo(() => (trend ? radarFromTrend(trend) : null), [trend]);

  const option = useMemo<EChartsOption>(() => {
    if (!dims) return {};
    return {
      animation: false,
      radar: {
        indicator: dims.map((d) => ({ name: d.name, max: 100 })),
        radius: "62%",
        center: ["50%", "52%"],
        axisName: { fontSize: 10, color: "var(--muted)" },
        splitArea: { areaStyle: { color: ["rgba(128,128,128,0.03)", "rgba(128,128,128,0.06)"] } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: dims.map((d) => d.value ?? 0),
              name: "财务质量",
              areaStyle: { color: "rgba(200,16,46,0.18)" },
              lineStyle: { color: "var(--primary)", width: 2 },
              itemStyle: { color: "var(--primary)" },
            },
          ],
        },
      ],
    };
  }, [dims]);

  if (isIndex) {
    return (
      <p className="text-sm text-muted py-8 text-center leading-relaxed">
        指数无个别企业财报，本模块仅适用于 A 股个股。
        <br />
        切换到个股标的（如 600519 贵州茅台）即可查看财务雷达。
      </p>
    );
  }
  if (err) return <p className="text-sm text-muted py-8 text-center">{err}</p>;
  if (!trend || !dims) return <p className="text-sm text-muted py-8 text-center">财报数据加载中…</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
      <EChart option={option} height={280} />
      <div className="space-y-2">
        {dims.map((d) => (
          <div key={d.name} className="flex items-center gap-3 text-xs">
            <span className="text-muted w-24 shrink-0 whitespace-pre-line leading-tight">{d.name.replace("\n", " ")}</span>
            <div className="flex-1 h-2 rounded-full bg-border/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${d.value ?? 0}%` }}
              />
            </div>
            <span className="font-mono tabular-nums w-10 text-right font-medium">{Math.round(d.value ?? 0)}</span>
            <span className="text-muted font-mono tabular-nums w-20 text-right" title="原始值">
              {d.basis}
            </span>
          </div>
        ))}
        <p className="text-[11px] text-muted pt-1 leading-relaxed">
          评分 = 归一化后的相对刻度（0-100），仅用于教学对比，不构成评级。原始值见右侧灰字。
        </p>
      </div>
    </div>
  );
}
