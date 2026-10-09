"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { readVar } from "@/lib/charts/theme";

interface TrendPoint {
  period: string;
  date: string;
  revenue: number | null;
  netProfit: number | null;
  grossMargin: number | null;
  roe: number | null;
  eps: number | null;
}

/**
 * 财务质量 5 维雷达（基于真实财报，归一化口径公开）
 *
 * 修复的两个口径错误：
 *
 * 1. **取错了期**：`/api/stock/finance-trend` 返回的 trend 是**按日期倒序**（index 0 = 最新一期）。
 *    旧代码 `[...t].reverse().find(...)` 反转后取第一个非空值，拿到的是**最旧一期**。
 *    表现为贵州茅台显示毛利率 91.5% / ROE 26.1%（那是 2024 三季报），
 *    而最新一期（2026 中报）实际是 89.6% / 16.8%。
 *
 * 2. **拿累计口径当环比/跨期比较**：财报的 revenue / netProfit / roe 都是「年初至今累计」，
 *    中报(6个月) 与年报(12个月) 不可直接比较。因此：
 *    - 成长性改为**同口径同比增速**（中报比中报、年报比年报），而不是对累计值做 CAGR；
 *    - ROE 只在**同类型报告期**之间比较（累计 ROE 的可比口径）。
 *
 * 归一化：成长 [-50%,50%]→[0,100]；毛利率 [0,60%]→[0,100]；ROE [0,30%]→[0,100]；稳定性 100−5σ。
 */
function radarFromTrend(raw: TrendPoint[]) {
  // 统一按日期倒序（最新在前），不依赖上游返回顺序
  const t = [...raw].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!t.length) return null;

  /** 报告期类型：年报 / 中报 / 一季报 / 三季报（决定累计口径是否可比） */
  const kindOf = (period: string): string => {
    if (/年报|annual/i.test(period)) return "年报";
    if (/中报|半年/i.test(period)) return "中报";
    if (/三季|q3/i.test(period)) return "三季报";
    return "一季报";
  };
  /** 同类型、且早约一年的一期 */
  const yearAgoOf = (p: TrendPoint): TrendPoint | undefined => {
    const y = Number(p.date.slice(0, 4)) - 1;
    return t.find((q) => q.date.startsWith(String(y)) && kindOf(q.period) === kindOf(p.period));
  };
  const yoy = (p: TrendPoint, key: "revenue" | "netProfit"): number | null => {
    const prev = yearAgoOf(p);
    const a = p[key];
    const b = prev?.[key];
    if (a == null || b == null || !(b > 0)) return null;
    return ((a - b) / b) * 100;
  };

  const latest = t[0];
  const gm = latest.grossMargin;
  const roe = latest.roe;

  const revYoy = yoy(latest, "revenue");
  const npYoy = yoy(latest, "netProfit");

  // 业绩稳定性：取所有能算出同比的 ROE 同比序列的波动（可比口径）
  const roeYoySeries = t
    .map((p) => {
      const prev = yearAgoOf(p);
      if (p.roe == null || prev?.roe == null || !(prev.roe > 0)) return null;
      return ((p.roe - prev.roe) / prev.roe) * 100;
    })
    .filter((v): v is number => v != null && Number.isFinite(v));
  const roeStd =
    roeYoySeries.length > 1
      ? Math.sqrt(
          roeYoySeries.reduce((a, v) => a + (v - roeYoySeries.reduce((x, y) => x + y, 0) / roeYoySeries.length) ** 2, 0) /
            roeYoySeries.length
        )
      : null;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const dims = [
    {
      name: "成长性\n(营收同比)",
      raw: revYoy,
      value: revYoy == null ? null : clamp(((revYoy + 50) / 100) * 100),
      basis: revYoy == null ? "—" : `${revYoy >= 0 ? "+" : ""}${revYoy.toFixed(1)}%`,
    },
    {
      name: "利润成长\n(净利同比)",
      raw: npYoy,
      value: npYoy == null ? null : clamp(((npYoy + 50) / 100) * 100),
      basis: npYoy == null ? "—" : `${npYoy >= 0 ? "+" : ""}${npYoy.toFixed(1)}%`,
    },
    { name: "盈利能力\n(毛利率)", raw: gm, value: gm == null ? null : clamp((gm / 60) * 100), basis: gm == null ? "—" : `${gm.toFixed(1)}%` },
    { name: "股东回报\n(ROE)", raw: roe, value: roe == null ? null : clamp((roe / 30) * 100), basis: roe == null ? "—" : `${roe.toFixed(1)}%` },
    {
      name: "业绩稳定\n(ROE同比波动)",
      raw: roeStd,
      value: roeStd == null ? null : clamp(100 - Math.abs(roeStd) * 5),
      basis: roeStd == null ? "—" : `σ=${roeStd.toFixed(1)}%`,
    },
  ];
  return { dims, latest };
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

  const radar = useMemo(() => (trend ? radarFromTrend(trend) : null), [trend]);
  const dims = radar?.dims ?? null;

  /**
   * canvas 不解析 CSS 变量：var(--x) 直接进 ECharts 会静默失效（轴名变默认色、系列线画不出）。
   * 服务端渲染时 readVar 返回兜底色，客户端解析成真实令牌值 —— 两者都是合法颜色，
   * 且 option 不进 DOM，因此不产生 hydration 差异。
   */
  const option = useMemo<EChartsOption>(() => {
    if (!dims) return {};
    const muted = readVar("--muted", "#6b6862");
    const accent = readVar("--primary", "#1a1a1a");
    return {
      animation: false,
      radar: {
        indicator: dims.map((d) => ({ name: d.name, max: 100 })),
        radius: "62%",
        center: ["50%", "52%"],
        axisName: { fontSize: 10, color: muted },
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
              lineStyle: { color: accent, width: 2 },
              itemStyle: { color: accent },
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
  if (!trend || !dims || !radar) return <p className="text-sm text-muted py-8 text-center">财报数据加载中…</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
      <EChart option={option} height={280} />
      <div className="space-y-2">
        {dims.map((d) => (
          <div key={d.name} className="flex items-center gap-3 text-xs">
            <span className="text-muted w-24 shrink-0 whitespace-pre-line leading-tight">{d.name.replace("\n", " ")}</span>
            <div className="flex-1 h-2 rounded-full bg-border/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/80 transition-colors"
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
        <p className="text-[11px] text-muted leading-relaxed">
          数据期：<span className="font-mono">{radar.latest.date}</span>（{radar.latest.period}）。
          财报为<b>年初至今累计</b>口径，成长性与稳定性均按<b>同报告期同比</b>计算，不跨口径比较。
        </p>
      </div>
    </div>
  );
}
