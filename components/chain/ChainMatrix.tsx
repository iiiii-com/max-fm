"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { STATIC_CHAINS } from "@/lib/data/chains";
import { relationMatrix } from "@/lib/data/chainGraph";
import { resolveChartTheme, readVar, withAlpha, TOOLTIP, ANIM_DURATION } from "@/lib/charts/theme";

/**
 * 跨链关系矩阵（N×N）。
 *
 * 为什么需要它，力导向图不够吗：
 *   力导向图在 38 节点 / 160 条边时会挤成毛线团，所以现有实现只画 23 条链，
 *   而且在去重时**丢掉了方向** —— 78 条非对称边（A 指向 B 而 B 不指向 A）
 *   所表达的"谁依赖谁"就此消失。矩阵能一次看全所有边，并保留方向。
 *
 * 配色刻意**不用涨跌红绿**：关系类型是结构字段，占用语义色通道会让读者
 * 以为它在表达涨跌（站内已经在环节层级上踩过这个坑）。改用单一墨色的两档浓度：
 *   双向（互相标注）= 浓，单向（只有一方标注）= 淡，无关系 = 空白。
 */

const THEME_NAME = "mx-relation-matrix";

/** 去掉通用后缀，标签才放得下 */
function shortName(name: string): string {
  return name.replace(/产业链$|产业链条$|产业$|行业$|板块$/g, "");
}

export default function ChainMatrix({ height = 760 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const router = useRouter();

  const { ids, matrix, labels, stats } = useMemo(() => {
    const { ids, matrix } = relationMatrix(STATIC_CHAINS);
    const byId = new Map(STATIC_CHAINS.map((c) => [c.id, c]));
    const labels = ids.map((id) => shortName(byId.get(id)?.name ?? id));
    let mutual = 0;
    let oneway = 0;
    for (let i = 0; i < ids.length; i++)
      for (let j = 0; j < ids.length; j++) {
        if (matrix[i][j] === 2) mutual++;
        if (matrix[i][j] === 1) oneway++;
      }
    // 双向在矩阵里会成对出现，计数除以 2 才是"对数"
    return { ids, matrix, labels, stats: { mutual: mutual / 2, oneway } };
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    echarts.registerTheme(THEME_NAME, resolveChartTheme());
    const chart = echarts.init(ref.current, THEME_NAME);
    chartRef.current = chart;

    /**
     * canvas 的颜色解析器不认识 `var(--x)`：直接拼进去会静默变成透明 ——
     * 图表照常渲染、坐标轴照常出现，只是图形不见了。
     * 所以所有进 ECharts 的颜色都必须先经 readVar 解析成具体值。
     * （图例是 DOM 元素，可以直接用 var()，两者浓度一致因而视觉相同。）
     */
    const ink = readVar("--primary", "#1a1a1a");
    const fg = readVar("--foreground", "#1a1a1a");
    const muted = readVar("--muted", "#6b6862");
    const border = readVar("--border", "#e2e0dc");
    const card = readVar("--card", "#ffffff");

    const esc = (s: unknown) =>
      String(s ?? "").replace(/[&<>"']/g, (m) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string)
      );

    // 只画有关系的格：38×38 = 1444 格里绝大多数是空的，
    // 全画出来只是让 ECharts 白渲染 1000 多个透明矩形。
    //
    // 颜色不走 per-item itemStyle：ECharts 的 heatmap **强制要求 visualMap**
    // （缺了会直接抛 "Heatmap must use with visualMap"），所以两档浓度由
    // visualMap.inRange 给 —— 取值只有 1/2，色带两端正好就是那两种颜色。
    const data: Array<[number, number, number]> = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        const v = matrix[i][j];
        if (v === 2 || v === 1) data.push([j, i, v]);
      }
    }

    const option: EChartsOption = {
      animationDuration: ANIM_DURATION,
      tooltip: {
        ...TOOLTIP,
        trigger: "item",
        formatter: (p: any) => {
          const [j, i, v] = p.data.value as [number, number, number];
          const a = labels[i];
          const b = labels[j];
          const kind = v === 2 ? "双向关联（互相标注）" : "单向关联（仅一方标注）";
          const dir = v === 2 ? `${a} ⇄ ${b}` : `${a} → ${b}`;
          return `<b>${esc(dir)}</b><br/><span style="color:${muted}">${esc(kind)}</span><br/><span style="color:${muted};font-size:10px">点击查看 ${esc(b)}</span>`;
        },
      },
      grid: { left: 96, right: 24, top: 76, bottom: 96, containLabel: false },
      // heatmap 必需 visualMap；show:false 因为两档语义由图例（DOM）说明，
      // 连续色带反而会让人以为 1 和 2 之间还有中间态。
      visualMap: {
        show: false,
        type: "continuous",
        min: 1,
        max: 2,
        inRange: { color: [withAlpha(ink, 0.24), withAlpha(ink, 0.62)] },
      },
      xAxis: {
        type: "category",
        data: labels,
        splitArea: { show: false },
        axisLabel: { fontSize: 9, color: muted, rotate: 90, interval: 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: border } },
      },
      yAxis: {
        type: "category",
        data: labels,
        splitArea: { show: false },
        axisLabel: { fontSize: 9, color: muted, interval: 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: border } },
      },
      series: [
        {
          type: "heatmap",
          data,
          itemStyle: { borderColor: card, borderWidth: 1 },
          // 格子尺寸由数据量决定；38 格下每个约 16px，够点得到
          emphasis: { itemStyle: { borderColor: fg, borderWidth: 1.5 } },
        },
      ],
    };

    chart.setOption(option);
    chart.on("click", (params: any) => {
      const [j] = params?.data?.value ?? [];
      const id = ids[j];
      if (id) router.push(`/industry?tab=chains&chain=${encodeURIComponent(id)}`);
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [ids, matrix, labels, router]);

  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap px-3 pt-3 pb-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="inline-block w-3 h-3 rounded-[2px]"
            style={{ background: "color-mix(in srgb, var(--primary) 62%, transparent)" }}
          />
          双向关联（{stats.mutual} 对）
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span
            className="inline-block w-3 h-3 rounded-[2px]"
            style={{ background: "color-mix(in srgb, var(--primary) 24%, transparent)" }}
          />
          单向关联（{stats.oneway} 条）
        </span>
        <span className="text-[11px] text-muted">
          纵轴指向横轴；空白 = 未标注关联
        </span>
      </div>
      <div ref={ref} style={{ height, width: "100%" }} />
    </div>
  );
}