"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { echarts, type EChartsOption } from "@/components/charts/echarts";
import { useTheme } from "@/components/theme-provider";
import { STATIC_CHAINS } from "@/lib/data/chains";

const HOT_IDS = [
  "semiconductor", "nev", "ai", "solar", "lowaltitude", "robot", "computing",
  "pharma", "baijiu", "consumer", "telecom", "storage", "hydrogen", "defense",
  "commercial-space",
];

export default function ChainEcosystem({ height = 520 }: { height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, theme === "dark" ? "dark" : undefined);
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

    const option: EChartsOption = {
      tooltip: { trigger: "item", formatter: (p: any) => `<b>${p.data?.name ?? p.name}</b><br/>点击查看产业链详情` },
      series: [{
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        data: nodes,
        links: edges,
        label: { show: true, position: "bottom", fontSize: 10 },
        lineStyle: { color: "source", curveness: 0.18, opacity: 0.5 },
        itemStyle: { color: "#c8102e", borderColor: "#fff", borderWidth: 1 },
        emphasis: { focus: "adjacency", itemStyle: { color: "#f0abfc" } },
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
  }, [theme, router]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}