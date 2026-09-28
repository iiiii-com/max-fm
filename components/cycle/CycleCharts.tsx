"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

/** 全站统一色（与 app/globals.css 令牌一致；涨红跌绿遵循 A 股惯例） */
const C = {
  up: "#c0392b",
  down: "#1e8449",
  primary: "#f28c00",
  muted: "#6b6862",
  border: "#e2e0dc",
  surface: "#f4f3f0",
  fg: "#d7d7d7",
};

const BASE_AXIS = {
  axisLine: { lineStyle: { color: C.border } },
  axisLabel: { color: C.muted, fontSize: 10 },
  splitLine: { lineStyle: { color: "rgba(41,41,41,0.5)" } },
};

/* ───────────── 1. 熊市「下跌时长 vs 修复时长」双向对照 ───────────── */

export interface CrashRow {
  peakDate: string;
  troughDate: string;
  drawdownPct: number;
  declineDays: number;
  recoveryDays: number | null;
  recovered: boolean;
  major: boolean;
}

export function CrashRecoveryChart({ rows, height = 420 }: { rows: CrashRow[]; height?: number }) {
  const option = useMemo<EChartsOption>(() => {
    const sorted = [...rows].sort((a, b) => (a.peakDate < b.peakDate ? -1 : 1));
    const labels = sorted.map((r) => `${r.peakDate.slice(0, 7)}`);
    // 左侧为下跌时长（取负值以便向左伸展），右侧为修复时长
    const decline = sorted.map((r) => -r.declineDays);
    // 未修复的用最大已有修复时长 + 一段占位，并在 tooltip 中标注「至今未修复」
    const maxRecovery = Math.max(...sorted.map((r) => r.recoveryDays ?? 0));
    const recovery = sorted.map((r) => (r.recovered ? (r.recoveryDays as number) : Math.round(maxRecovery * 1.12)));
    const recoveryReal = sorted.map((r) => r.recovered);

    return {
      animation: false,
      grid: { left: 78, right: 24, top: 34, bottom: 40 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(10,10,10,0.95)",
        borderColor: C.border,
        textStyle: { color: C.fg, fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const r = sorted[i];
          if (!r) return "";
          const rec = r.recovered ? `${r.recoveryDays} 自然日` : "至今未修复";
          return (
            `<div style="font-size:12px;line-height:1.7">` +
            `<b>${r.peakDate} → ${r.troughDate}</b><br/>` +
            `回撤 <span style="color:${C.down}">${r.drawdownPct.toFixed(1)}%</span>` +
            `${r.major ? "（大熊市）" : ""}<br/>` +
            `下跌 ${r.declineDays} 自然日<br/>` +
            `修复 ${rec}</div>`
          );
        },
      },
      legend: {
        data: ["下跌时长", "修复时长"],
        top: 0,
        textStyle: { color: C.muted, fontSize: 11 },
        itemWidth: 10,
        itemHeight: 8,
      },
      xAxis: {
        type: "value",
        name: "← 下跌（自然日）　　修复（自然日）→",
        nameLocation: "middle",
        nameGap: 26,
        nameTextStyle: { color: C.muted, fontSize: 10 },
        ...BASE_AXIS,
        axisLabel: { color: C.muted, fontSize: 10, formatter: (v: number) => `${Math.abs(v)}` },
      },
      yAxis: {
        type: "category",
        data: labels,
        ...BASE_AXIS,
        axisLabel: { color: C.muted, fontSize: 10 },
      },
      series: [
        {
          name: "下跌时长",
          type: "bar",
          stack: "t",
          data: decline,
          itemStyle: { color: C.down },
          barMaxWidth: 14,
        },
        {
          name: "修复时长",
          type: "bar",
          stack: "t",
          data: recovery.map((v, i) => ({ value: v, itemStyle: { color: recoveryReal[i] ? C.primary : C.muted, opacity: recoveryReal[i] ? 1 : 0.45 } })),
          barMaxWidth: 14,
        },
      ],
    };
  }, [rows]);

  return <EChart option={option} height={height} />;
}

/* ───────────── 2. 牛市「持续时长 × 累计涨幅」散点 ───────────── */

export interface BullRow {
  label?: string;
  from: string;
  to: string;
  days: number;
  changePct: number;
  annualizedPct: number;
}

export function BullScatterChart({ rows, height = 400 }: { rows: BullRow[]; height?: number }) {
  const option = useMemo<EChartsOption>(() => {
    const points = rows.map((r) => ({
      name: r.label ?? r.from,
      value: [Math.round((r.days / 30.44) * 10) / 10, r.changePct, r.days, r.annualizedPct],
    }));

    return {
      animation: false,
      grid: { left: 64, right: 28, top: 30, bottom: 48 },
      tooltip: {
        backgroundColor: "rgba(10,10,10,0.95)",
        borderColor: C.border,
        textStyle: { color: C.fg, fontSize: 12 },
        formatter: (p: any) => {
          const d = p.data;
          return (
            `<div style="font-size:12px;line-height:1.7"><b>${d.name}</b><br/>` +
            `持续 <b>${d.value[0]}</b> 个月（${d.value[2]} 自然日）<br/>` +
            `累计涨幅 <span style="color:${C.up}">+${d.value[1].toFixed(1)}%</span><br/>` +
            `年化 <b>${d.value[3].toFixed(1)}%</b></div>`
          );
        },
      },
      xAxis: {
        type: "value",
        name: "持续时长（月）",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: C.muted, fontSize: 10 },
        ...BASE_AXIS,
      },
      yAxis: {
        type: "value",
        name: "累计涨幅（%）",
        nameTextStyle: { color: C.muted, fontSize: 10 },
        ...BASE_AXIS,
      },
      series: [
        {
          type: "scatter",
          data: points,
          symbolSize: (v: number[]) => Math.max(14, Math.min(46, Math.sqrt(v[2]) * 1.7)),
          itemStyle: { color: C.up, opacity: 0.72, borderColor: "rgba(255,255,255,0.35)", borderWidth: 1 },
          label: {
            show: true,
            position: "top",
            distance: 6,
            color: C.muted,
            fontSize: 9,
            formatter: (p: any) => (p.data.name || "").replace(/^牛\d+-/, ""),
          },
        },
      ],
    };
  }, [rows]);

  return <EChart option={option} height={height} />;
}

/* ───────────── 3. 崩盘深度排序条形 ───────────── */

export function CrashDepthChart({ rows, height = 320 }: { rows: CrashRow[]; height?: number }) {
  const option = useMemo<EChartsOption>(() => {
    const sorted = [...rows].sort((a, b) => a.drawdownPct - b.drawdownPct); // 最深在前
    const labels = sorted.map((r) => r.peakDate.slice(0, 7));
    const data = sorted.map((r) => ({
      value: Number(r.drawdownPct.toFixed(1)),
      itemStyle: { color: r.major ? C.down : "rgba(0,193,118,0.5)" },
    }));

    return {
      animation: false,
      grid: { left: 78, right: 46, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(10,10,10,0.95)",
        borderColor: C.border,
        textStyle: { color: C.fg, fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const r = sorted[i];
          if (!r) return "";
          return (
            `<div style="font-size:12px;line-height:1.7"><b>${r.peakDate} → ${r.troughDate}</b><br/>` +
            `回撤 <b>${r.drawdownPct.toFixed(1)}%</b><br/>` +
            `${r.major ? "大熊市（≥30%）" : "中级调整"}<br/>` +
            `修复：${r.recovered ? r.recoveryDays + " 自然日" : "至今未修复"}</div>`
          );
        },
      },
      xAxis: { type: "value", max: 0, ...BASE_AXIS, axisLabel: { color: C.muted, fontSize: 10, formatter: (v: number) => `${v}%` } },
      yAxis: { type: "category", data: labels, ...BASE_AXIS, axisLabel: { color: C.muted, fontSize: 10 } },
      series: [
        {
          type: "bar",
          data,
          barMaxWidth: 14,
          label: { show: true, position: "left", color: C.muted, fontSize: 9, formatter: (p: any) => `${p.value}%` },
        },
      ],
    };
  }, [rows]);

  return <EChart option={option} height={height} />;
}

/* ───────────── 4. 口径敏感性：熊市次数随定义变化 ───────────── */

export interface SensitivityRow {
  entryPct: number;
  confirmPct: number;
  count: number;
  majorCount: number;
}

export function SensitivityChart({ rows, active, height = 240 }: { rows: SensitivityRow[]; active?: number; height?: number }) {
  const option = useMemo<EChartsOption>(() => {
    const labels = rows.map((r) => `反弹 ${r.confirmPct}%`);
    return {
      animation: false,
      grid: { left: 52, right: 24, top: 30, bottom: 34 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(10,10,10,0.95)",
        borderColor: C.border,
        textStyle: { color: C.fg, fontSize: 12 },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const r = rows[i];
          if (!r) return "";
          return `<div style="font-size:12px;line-height:1.7">入熊阈值 ${r.entryPct}%<br/>谷底确认（自低点反弹）${r.confirmPct}%<br/><b>检出 ${r.count} 次</b>熊市（其中 ≥30% 的 ${r.majorCount} 次）</div>`;
        },
      },
      xAxis: { type: "category", data: labels, ...BASE_AXIS },
      yAxis: { type: "value", name: "熊市次数", nameTextStyle: { color: C.muted, fontSize: 10 }, ...BASE_AXIS },
      series: [
        {
          type: "line",
          data: rows.map((r, i) => ({
            value: r.count,
            itemStyle: { color: r.confirmPct === active ? C.primary : C.muted },
            symbolSize: r.confirmPct === active ? 11 : 7,
          })),
          lineStyle: { color: C.primary, width: 2 },
          smooth: false,
          label: { show: true, position: "top", color: C.muted, fontSize: 10 },
          markLine: active
            ? {
                silent: true,
                symbol: "none",
                data: [{ xAxis: labels.findIndex((_, i) => rows[i].confirmPct === active), label: { show: false }, lineStyle: { color: C.primary, type: "dashed", width: 1 } }],
              }
            : undefined,
        },
      ],
    };
  }, [rows, active]);

  return <EChart option={option} height={height} />;
}
