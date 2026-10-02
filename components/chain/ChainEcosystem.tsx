"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { STATIC_CHAINS } from "@/lib/data/chains";
import { resolveChartTheme, TOOLTIP, ANIM_DURATION, INK, BORDER, signColor } from "@/lib/charts/theme";

/**
 * 画进这张关系图的链。
 *
 * 不是全部 34 条都画 —— 力导向图在 30 个节点以上会挤成一团、连边交叉到
 * 不可读（这正是此前只画 15 条的原因）。选取标准是「有实际跨链供需关系」：
 * 每个入选 id 至少要与其他入选链在 relates 里互相指向。
 * 覆盖度由 ECOSYSTEM_COVERAGE 导出，页面必须如实标注图上画了几条、
 * 站内共有几条 —— 不让读者误以为这就是全部。
 */
const HOT_IDS = [
  "semiconductor", "nev", "ai", "solar", "lowaltitude", "robot", "computing",
  "pharma", "baijiu", "consumer", "telecom", "storage", "hydrogen", "defense",
  "commercial-space",
  // 补入库的 9 条里有跨链关系的：这些链与既有链存在真实的供需或替代关系
  // （如核电↔风电储能、工程机械↔钢铁与机器人、大家电↔地产与消费电子），
  // 不画会让"关系图"看起来比真实的产业联系更稀疏。
  "nuclear", "intelligent-driving", "machinery", "homeappliance", "logistics",
  "medical-service", "shipbuilding", "media-game",
];

/** 本图只画有跨链关联的节点，因此实际覆盖度低于站内链总数；由调用方标注 */
export const ECOSYSTEM_COVERAGE = { total: STATIC_CHAINS.length, drawn: HOT_IDS.length };

const THEME_NAME = "mx-site";

export default function ChainEcosystem({ height = 520 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!ref.current) return;
    // 与全站其余图表走同一套主题。此前这里是 `theme === "dark" ? "dark" : undefined`，
    // 即浅色档落回 ECharts 内置默认主题（白底黑边默认样式、默认字号），
    // tooltip 与卡片、轴标签、图例全都不一致 —— 而 lib/charts/theme.ts
    // 正是为消灭这个模式才建的。
    echarts.registerTheme(THEME_NAME, resolveChartTheme());
    const chart = echarts.init(ref.current, THEME_NAME);
    chartRef.current = chart;

    const byId = new Map(STATIC_CHAINS.map((c) => [c.id, c]));
    const nodes = HOT_IDS.map((id) => byId.get(id)).filter(Boolean).map((c) => ({
      id: c!.id,
      name: c!.name.replace(/产业链$/, ""),
      symbolSize: 18,
    }));
    const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name;
    const seen = new Set<string>();
    const edges: Array<{ source: string; target: string }> = [];
    for (const c of STATIC_CHAINS) {
      if (!HOT_IDS.includes(c.id)) continue;
      for (const r of c.relates) {
        if (!HOT_IDS.includes(r)) continue;
        const key = [c.id, r].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const s = nameOf(c.id);
        const t = nameOf(r);
        if (s && t) edges.push({ source: s, target: t });
      }
    }

    const esc = (s: unknown) =>
      String(s ?? "").replace(/[&<>"']/g, (m) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string)
      );

    const option: EChartsOption = {
      // 主题已提供轴线/标签/网格/tooltip 基线，这里只补图特有的部分
      tooltip: {
        ...TOOLTIP,
        trigger: "item",
        // nameOf 未来可能接 DB，formatter 拼 HTML 前必须转义，否则成为注入面
        formatter: (p: any) => `<b>${esc(p?.data?.name ?? p?.name)}</b><br/><span style="color:var(--muted)">点击查看产业链详情</span>`,
      },
      series: [{
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        animationDuration: ANIM_DURATION,
        data: nodes,
        links: edges,
        label: { show: true, position: "bottom", fontSize: 10, color: INK },
        lineStyle: { color: "source", curveness: 0.18, opacity: 0.45, width: 1 },
        // 描边用分隔线色而非纯白：深色模式下纯白描边会在深底上糊成一团
        itemStyle: { color: signColor(0, INK), borderColor: BORDER, borderWidth: 1 },
        emphasis: { focus: "adjacency" },
        force: { repulsion: 420, edgeLength: 110, gravity: 0.08 },
      }],
    };
    chart.setOption(option);
    chart.on("click", (params: any) => {
      const id = params?.data?.id;
      if (id) router.push(`/industry?tab=chains&chain=${encodeURIComponent(id)}`);
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [router]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}