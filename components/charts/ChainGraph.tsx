"use client";

import { useMemo } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";
import type { ChainNode } from "@/lib/db/schema";

const CATEGORY_COLORS: Record<string, string> = {
  上游: "#0891b2", 中游: "#c8102e", 下游: "#4f46e5",
};

export default function ChainGraph({ nodes, links }: { nodes: ChainNode[]; links: Array<{ source: string; target: string }> }) {
  const graphData = useMemo(() => {
    const seen = new Set<string>();
    const dedup = nodes.filter((n) => (seen.has(n.name ?? "") ? false : (seen.add(n.name ?? ""), true)));
    const nodesWithColor = dedup.map((n) => ({
      name: n.name ?? "", value: n.description ?? "",
      category: n.level || "中游",
      symbolSize: (n.level || "中游") === "下游" ? 46 : (n.level || "中游") === "中游" ? 38 : 30,
      itemStyle: { color: CATEGORY_COLORS[n.level || "中游"] || "#6b7280" },
    }));
    const valid = new Set(nodesWithColor.map((n) => n.name));
    const edges = links
      .filter((l) => valid.has(l.source) && valid.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));
    return { nodes: nodesWithColor, edges };
  }, [nodes, links]);

  const option: EChartsOption = {
    tooltip: {
      formatter: (p: any) => {
        if (p.dataType === "edge") return `${p.data.source} → ${p.data.target}`;
        return `<b>${p.name}</b><br/>${p.value || "—"}`;
      },
    },
    legend: {
      data: [
        { name: "上游", itemStyle: { color: CATEGORY_COLORS.上游 } },
        { name: "中游", itemStyle: { color: CATEGORY_COLORS.中游 } },
        { name: "下游", itemStyle: { color: CATEGORY_COLORS.下游 } },
      ],
      top: 4, left: 8, textStyle: { fontSize: 11 },
    },
    series: [{
      type: "graph",
      layout: "force",
      data: graphData.nodes,
      links: graphData.edges,
      categories: [{ name: "上游" }, { name: "中游" }, { name: "下游" }],
      roam: true,
      draggable: true,
      label: { show: true, position: "bottom", fontSize: 11, color: "#555" },
      force: { repulsion: 220, gravity: 0.08, edgeLength: [90, 180], layoutAnimation: false },
      emphasis: { focus: "adjacency", lineStyle: { width: 3 } },
      lineStyle: { color: "#c9c9c0", width: 1.5, curveness: 0.08 },
    }],
  };

  return (
    <div className="space-y-3">
      <EChart option={option} height={520} />
      <p className="text-xs text-muted">节点 = 产业链环节；连线 = 上下游关系；支持拖拽、缩放。悬停查看环节说明。</p>
    </div>
  );
}