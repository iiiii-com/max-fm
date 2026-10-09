"use client";

import { useEffect, useRef } from "react";
import { echarts, initResponsiveChart, type EChartsOption } from "@/components/charts/echarts";
import { resolveChartTheme, readVar, withAlpha, TOOLTIP, ANIM_DURATION } from "@/lib/charts/theme";

export interface StageRow {
  stage: string;
  ret: number;
  count: number;
  members: Array<{ secid: string; name: string; ret: number }>;
}

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

/**
 * 环节级拆解：上游 / 中游 / 下游各段的表现对比 + 由数据推出的结论。
 *
 * 为什么这个视图重要：整链涨 20% 可能是三段齐涨，也可能是中游涨 60% 而上游跌。
 * 这两种情况的含义完全不同，只看整链会把这个差别抹掉。
 *
 * 配色纪律：段间差异是**结构**信息，不是涨跌方向。所以柱体统一用墨色深浅，
 * 只在"收益正负"这一处用涨跌色（因为它确实是涨跌）。此前站内有过
 * 「结构字段占用语义色通道」的教训（环节层级被映射成涨跌红）。
 */
export default function ChainStagePanel({
  stages,
  chainRet,
  interpretation,
}: {
  stages: StageRow[];
  chainRet: number;
  interpretation: { points: string[]; insufficient: boolean };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    echarts.registerTheme("mx-chain-stage", resolveChartTheme());
    const { chart, dispose } = initResponsiveChart(ref.current, "mx-chain-stage");
    chartRef.current = chart;

    const muted = readVar("--muted", "#6b6862");
    const fg = readVar("--foreground", "#1a1a1a");
    const border = readVar("--border", "#e2e0dc");
    const up = readVar("--up", "#c0392b");
    const down = readVar("--down", "#1e8449");

    // 只画有效段（成员≥2），不足的段在下面用文字说明，不在图里画一根假的 0 柱
    const valid = stages.filter((s) => s.members.length >= 2);

    const option: EChartsOption = {
      animationDuration: ANIM_DURATION,
      tooltip: {
        ...TOOLTIP,
        trigger: "item",
        formatter: (p: any) => {
          const s = valid[p.dataIndex];
          if (!s) return "";
          const list = s.members
            .slice(0, 6)
            .map((m) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${m.name}</span><span>${pct(m.ret)}</span></div>`)
            .join("");
          const more = s.members.length > 6 ? `<div style="color:${muted}">…另 ${s.members.length - 6} 只</div>` : "";
          return `<b>${s.stage}</b>（${s.count} 只等权）<br/><span style="color:${muted}">段收益 ${pct(s.ret)}</span><div style="margin-top:6px">${list}${more}</div>`;
        },
      },
      grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: valid.map((s) => `${s.stage}\n${s.count} 只`),
        axisLabel: { color: muted, fontSize: 11, lineHeight: 14 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: border } },
      },
      yAxis: {
        type: "value",
        name: "区间收益 %",
        nameTextStyle: { color: muted, fontSize: 9 },
        axisLabel: { color: muted, fontSize: 9, formatter: "{value}%" },
        splitLine: { lineStyle: { color: withAlpha(fg, 0.08), type: "dashed" } },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 64,
          data: valid.map((s) => ({
            value: s.ret,
            // 只有"正负"用涨跌色；柱体本身是同一材质
            itemStyle: { color: withAlpha(s.ret >= 0 ? up : down, 0.72), borderRadius: [2, 2, 0, 0] },
          })),
          label: {
            show: true,
            position: "top",
            fontSize: 11,
            color: fg,
            formatter: (p: any) => pct(p.value),
          },
          // 整链基准线：让"这一段是强于还是弱于整链"一眼可见
          markLine: {
            silent: true,
            symbol: "none",
            data: [{ yAxis: chainRet, name: "整链" }],
            lineStyle: { color: muted, type: "dashed", width: 1 },
            label: { formatter: `整链 ${pct(chainRet)}`, color: muted, fontSize: 9, position: "insideEndTop" },
          },
        },
      ],
    };
    chart.setOption(option);
    return () => {
      dispose();
      chartRef.current = null;
    };
  }, [stages, chainRet]);

  const invalid = stages.filter((s) => s.members.length < 2);

  return (
    <div className="rounded-lg border border-border bg-border/20 p-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
        <p className="text-xs font-bold tracking-wide text-primary">环节级拆解（上游 / 中游 / 下游）</p>
        <p className="text-[10px] text-muted">段内等权，与整链同一共同窗口与基点口径</p>
      </div>

      {invalid.length > 0 && (
        <p className="text-[10px] text-amber-600 leading-relaxed mb-1">
          未纳入拆解：{invalid.map((s) => `${s.stage}（仅 ${s.count} 只有足够日线的成员，段内需 ≥2 只）`).join("；")}
        </p>
      )}

      <div ref={ref} style={{ height: 260, width: "100%" }} />

      {/* 由数据推出的结论：每一句都能在上图和成员表里逐项验算 */}
      <div className="mt-2 border-t border-border/60 pt-2">
        <p className="text-[10px] font-bold tracking-wider text-primary mb-1">从数据读出的结论</p>
        <ul className="space-y-1">
          {interpretation.points.map((p, i) => (
            <li key={i} className="text-[11px] text-muted leading-relaxed flex gap-1.5">
              <span className="text-primary shrink-0">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {!interpretation.insufficient && (
          <p className="text-[10px] text-muted leading-relaxed mt-1.5">
            以上为对上方柱状图的直接读数（段收益、分化度、与整链的接近程度），非预测或建议。
          </p>
        )}
      </div>
    </div>
  );
}