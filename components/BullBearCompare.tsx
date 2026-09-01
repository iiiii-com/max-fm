"use client";

import { useMemo, useState } from "react";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { useTheme } from "@/components/theme-provider";
import EChart from "@/components/charts/EChart";
import { Badge, Card } from "@/components/ui";
import {
  BULL_BEAR_CYCLES,
  BULL_BEAR_STATS,
  BULL_BEAR_SOURCES,
  VOLUME_PATTERNS,
} from "@/lib/data/bullbear";

function fmtVolHand(n: number | null) {
  if (n == null) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿手`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万手`;
  return `${n.toFixed(0)}手`;
}

function fmtPct(v: number, digits = 1) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export default function BullBearCompare() {
  const { theme } = useTheme();
  const [view, setView] = useState<"table" | "chart">("table");

  const chartOption = useMemo<EChartsOption>(() => {
    const bulls = BULL_BEAR_CYCLES.filter((c) => c.phase === "bull");
    const bears = BULL_BEAR_CYCLES.filter((c) => c.phase === "bear");
    const all = BULL_BEAR_CYCLES;
    const drawdown = (c: (typeof all)[0]) => Math.round(((c.low - c.high) / c.high) * 1000) / 10;
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          return arr
            .map((p: any) => {
              const c = all[p.dataIndex];
              if (!c) return "";
              const label = p.seriesName === "阶段涨幅" ? c.changePct : p.seriesName === "区间回撤" ? drawdown(c) : p.seriesName === "量比(倍)" ? c.volRatio : null;
              return `${p.marker}${p.seriesName}: ${label == null ? "—" : p.seriesName === "量比(倍)" ? `${label}×` : `${label}%`}`;
            })
            .join("<br/>");
        },
      },
      legend: { top: 4, textStyle: { fontSize: 11 } },
      grid: { left: 52, right: 20, top: 34, bottom: 60 },
      xAxis: {
        type: "category",
        data: all.map((c) => c.period),
        axisLabel: { fontSize: 9, rotate: 45, interval: 0 },
      },
      yAxis: [
        {
          type: "value",
          name: "涨跌幅 %",
          nameTextStyle: { fontSize: 10 },
          axisLabel: { fontSize: 9 },
          splitLine: { lineStyle: { color: "#292929", type: "dashed" } },
        },
        {
          type: "value",
          name: "量比",
          nameTextStyle: { fontSize: 10 },
          axisLabel: { fontSize: 9 },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 14, bottom: 24 },
      ],
      series: [
        {
          name: "阶段涨幅",
          type: "bar",
          data: all.map((c) => ({
            value: c.changePct,
            itemStyle: {
              color: c.phase === "bull" ? "#dc2626" : "#16a34a",
              borderRadius: [2, 2, 0, 0],
            },
          })),
          label: { show: false },
        },
        {
          name: "区间回撤",
          type: "bar",
          data: all.map((c) => ({
            value: drawdown(c),
            itemStyle: {
              color: c.phase === "bull" ? "rgba(220,38,38,0.25)" : "rgba(22,163,74,0.25)",
            },
          })),
        },
        {
          name: "量比(倍)",
          type: "line",
          yAxisIndex: 1,
          data: all.map((c) => c.volRatio),
          smooth: true,
          showSymbol: true,
          symbolSize: 4,
          lineStyle: { color: "#f59e0b", width: 1.5 },
          itemStyle: { color: "#f59e0b" },
        },
      ],
    };
  }, []);

  const bullStats = BULL_BEAR_STATS;
  const stats = [
    { label: "牛市轮次", value: `${bullStats.bullCount} 轮`, tone: "red" },
    { label: "熊市轮次", value: `${bullStats.bearCount} 轮`, tone: "green" },
    { label: "牛市平均涨幅", value: fmtPct(bullStats.bullAvgChg), tone: "red" },
    { label: "熊市平均跌幅", value: fmtPct(bullStats.bearAvgChg, 0), tone: "green" },
    { label: "牛市最长", value: `${bullStats.bullMedMonths} 月中位数`, tone: "gray" },
    { label: "熊市最长", value: `${bullStats.bearMedMonths} 月中位数`, tone: "gray" },
  ];

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <p className="text-[10px] text-muted mb-1">{s.label}</p>
            <p className={`text-lg font-bold font-mono ${s.tone === "red" ? "up" : s.tone === "green" ? "down" : ""}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          <button
            onClick={() => setView("table")}
            className={`px-2.5 py-1 ${view === "table" ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
          >
            逐轮对照表
          </button>
          <button
            onClick={() => setView("chart")}
            className={`px-2.5 py-1 ${view === "chart" ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
          >
            涨幅/回撤/量比图
          </button>
        </div>
        <span className="text-[10px] text-muted">红=牛市 绿=熊市 · 悬停看详情 · 可缩放平移</span>
      </div>

      {view === "chart" ? (
        <Card className="p-4">
          <EChart option={chartOption} height={420} />
          <p className="text-[11px] text-muted mt-2 leading-relaxed">
            阶段涨幅 = 该阶段起止收盘涨跌；区间回撤 = 阶段内最高点至最低点跌幅（衡量波动剧烈度）；量比 = 阶段天量 / 地量（倍数，对数感受：数值越高波动越大）。
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pr-3 pl-4 font-medium">阶段</th>
                <th className="text-right px-2 font-medium">起</th>
                <th className="text-right px-2 font-medium">止</th>
                <th className="text-right px-2 font-medium">时长(月)</th>
                <th className="text-right px-2 font-medium">涨跌幅</th>
                <th className="text-right px-2 font-medium">高点/低点</th>
                <th className="text-right px-2 font-medium">天量(手)</th>
                <th className="text-right px-2 font-medium">地量(手)</th>
                <th className="text-right px-2 font-medium">量比</th>
                <th className="text-left px-2 font-medium">估值 PE 区间</th>
              </tr>
            </thead>
            <tbody>
              {BULL_BEAR_CYCLES.map((c) => {
                const isBull = c.phase === "bull";
                const dd = Math.round(((c.low - c.high) / c.high) * 1000) / 10;
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 align-top">
                    <td className="py-2 pr-3 pl-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isBull ? "bg-red-500" : "bg-green-500"}`} />
                        <span className="font-medium whitespace-nowrap">{c.period}</span>
                        <Badge tone={isBull ? "red" : "green"}>{isBull ? "牛" : "熊"}</Badge>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-muted whitespace-nowrap">{c.from}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs text-muted whitespace-nowrap">{c.to}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">{c.months}</td>
                    <td className={`py-2 px-2 text-right font-mono font-semibold whitespace-nowrap ${isBull ? "up" : "down"}`}>{fmtPct(c.changePct)}</td>
                    <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">
                      {c.high.toFixed(0)} <span className="text-muted">/</span> {c.low.toFixed(0)}
                      <span className="block text-[10px] text-muted">回撤 {fmtPct(dd)}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">
                      {fmtVolHand(c.maxVolHand)}
                      <span className="block text-[10px] text-muted">{c.maxVolDate || ""}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">
                      {fmtVolHand(c.minVolHand)}
                      <span className="block text-[10px] text-muted">{c.minVolDate || ""}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">
                      {c.volRatio != null ? `${c.volRatio}×` : "—"}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted whitespace-nowrap max-w-[180px]">{c.peRange ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* 天量地量特征 */}
      <Card className="p-5">
        <h3 className="font-bold mb-3">成交量天量 / 地量特征（真实数据统计）</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {VOLUME_PATTERNS.map((p) => (
            <div key={p.title} className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold mb-1">{p.title}</p>
              <p className="text-xs text-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 数据来源 */}
      <Card className="p-5">
        <h3 className="font-bold mb-2 text-sm">数据来源与口径说明</h3>
        <ul className="text-[11px] text-muted space-y-1.5 list-disc pl-4">
          {BULL_BEAR_SOURCES.map((s, i) => (
            <li key={i} className="leading-relaxed">{s}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
