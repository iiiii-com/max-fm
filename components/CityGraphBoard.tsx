"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "@/components/charts/echarts";
import EChart from "@/components/charts/EChart";
import { Badge, Card } from "@/components/ui";
import {
  buildCityGraphNodes, buildCityGraphEdges, buildCityGraphStats,
  INDUSTRY_CATS, INDUSTRY_COLORS, TIER_ORDER,
  type CityGraphNode, type IndustryCat, type Tier,
} from "@/lib/data/city-graph";

const TIER_TONE: Record<Tier, "red" | "blue" | "gray" | "amber"> = {
  一线: "red",
  新一线: "blue",
  二线: "amber",
  三线: "gray",
};

const TIER_STYLE: Record<Tier, { size: number }> = {
  一线: { size: 54 },
  新一线: { size: 44 },
  二线: { size: 34 },
  三线: { size: 26 },
};

/** 城市产业图谱：力导向图 + 筛选 + 详情 + 区域对比 */
export default function CityGraphBoard() {
  const nodes = useMemo(() => buildCityGraphNodes(), []);
  const edges = useMemo(() => buildCityGraphEdges(nodes), [nodes]);
  const stats = useMemo(() => buildCityGraphStats(nodes), [nodes]);

  const [catFilter, setCatFilter] = useState<"全部" | IndustryCat>("全部");
  const [tierFilter, setTierFilter] = useState<"全部" | Tier>("全部");
  const [selected, setSelected] = useState<CityGraphNode | null>(null);
  const [hovered, setHovered] = useState<CityGraphNode | null>(null);

  const visibleNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (catFilter === "全部" || n.cat === catFilter) &&
          (tierFilter === "全部" || n.tier === tierFilter)
      ),
    [nodes, catFilter, tierFilter]
  );
  const visibleNames = useMemo(() => new Set(visibleNodes.map((n) => n.name)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleNames.has(e.source) && visibleNames.has(e.target)),
    [edges, visibleNames]
  );

  const option = useMemo<EChartsOption>(() => {
    const graphNodes = visibleNodes.map((n) => {
      const tierSize = TIER_STYLE[n.tier].size;
      // 产业规模修正：size 基于 GDP，等级加成
      const size = Math.round(tierSize * (0.7 + n.size / 80));
      return {
        id: n.name,
        name: n.name,
        value: n.size,
        category: n.cat,
        symbolSize: size,
        itemStyle: {
          color: INDUSTRY_COLORS[n.cat],
          shadowBlur: selected?.name === n.name ? 18 : 6,
          shadowColor: INDUSTRY_COLORS[n.cat] + "88",
          borderColor: "#fff",
          borderWidth: selected?.name === n.name ? 2 : 1,
        },
        label: { show: true, fontSize: 10, color: "#64748b", position: "bottom", distance: 4 },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: "bold", color: INDUSTRY_COLORS[n.cat] } },
        tooltip: {
          formatter: () =>
            `<b>${n.name}</b>（${n.province}·${n.zone}）<br/>等级：${n.tier}<br/>主导产业：${n.cat}<br/>支柱：${n.pillars.join("、")}<br/>GDP：${n.gdp}${n.companies.length ? `<br/>代表企业：${n.companies.join("、")}` : ""}`,
        },
        // 自定义数据供点击
        _data: n,
      };
    });
    const graphLinks = visibleEdges.map((e) => ({
      source: e.source,
      target: e.target,
      lineStyle: { width: 1.5, color: "#94a3b8", opacity: 0.55, curveness: 0.08 },
    }));
    const gNodes = graphNodes as any[];
    return {
      tooltip: { trigger: "item" },
      legend: {
        data: INDUSTRY_CATS.map((c) => ({ name: c, itemStyle: { color: INDUSTRY_COLORS[c] } })),
        top: 0, left: 8, textStyle: { fontSize: 11 }, type: "scroll",
      },
      series: [
        {
          type: "graph",
          layout: "force",
          data: gNodes,
          links: graphLinks,
          categories: INDUSTRY_CATS.map((c) => ({ name: c, itemStyle: { color: INDUSTRY_COLORS[c] } })),
          roam: true,
          draggable: true,
          force: {
            repulsion: 320,
            edgeLength: [70, 140],
            gravity: 0.08,
            friction: 0.6,
            layoutAnimation: true,
          },
          label: { show: true },
          emphasis: { focus: "adjacency", lineStyle: { width: 2.5, opacity: 0.9 } },
          lineStyle: { color: "#94a3b8", opacity: 0.55, curveness: 0.08 },
          animationDurationUpdate: 300,
        },
      ],
    };
  }, [visibleNodes, visibleEdges, selected]);

  return (
    <div className="space-y-4">
      {/* 筛选器 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted shrink-0">产业：</span>
        <div className="flex flex-wrap gap-1">
          {(["全部", ...INDUSTRY_CATS] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                catFilter === c ? "bg-primary text-white border-primary" : "border-border text-muted hover:border-primary/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted ml-3 shrink-0">等级：</span>
        <div className="flex flex-wrap gap-1">
          {(["全部", ...TIER_ORDER] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                tierFilter === t ? "bg-primary text-white border-primary" : "border-border text-muted hover:border-primary/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted ml-auto">节点大小=产业规模 · 颜色=产业类型 · 连线=产业关联 · 拖动/缩放</span>
      </div>

      {/* 图谱 + 详情 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
        <Card className="p-3">
          <EChart
            option={option}
            height={560}
            onReady={(chart) => {
              chart.on("click", (params: any) => {
                const d = params?.data as any;
                if (d?._data) setSelected(d._data);
              });
            }}
          />
          <p className="text-[10px] text-muted mt-1.5">
            展示 {visibleNodes.length}/{nodes.length} 个城市 · {visibleEdges.length} 条产业关联 · 悬停看详情，点击节点展开产业图谱
          </p>
        </Card>

        {/* 右侧：选中城市详情 + 关联城市 */}
        <div className="space-y-3">
          {selected ? (
            <Card className="p-5 border-l-4 border-l-primary">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{selected.name}</h3>
                <Badge tone={TIER_TONE[selected.tier]}>{selected.tier}</Badge>
                <Badge tone="blue">{selected.zone}</Badge>
              </div>
              <p className="text-xs text-muted mb-3">{selected.province} · GDP {selected.gdp}</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-muted mb-1.5">🏭 支柱产业</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.pillars.map((p) => <Badge key={p} tone="red">{p}</Badge>)}
                  </div>
                </div>
                {selected.companies.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1.5">🏢 代表企业</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.companies.map((co) => <Badge key={co} tone="gray">{co}</Badge>)}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-muted mb-1.5">🔗 产业关联城市（{selected.cat}）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nodes
                      .filter((n) => n.name !== selected.name && n.cat === selected.cat)
                      .slice(0, 10)
                      .map((n) => (
                        <button
                          key={n.name}
                          onClick={() => setSelected(n)}
                          className="px-2 py-0.5 rounded-full border border-border text-[11px] hover:border-primary/50 hover:text-primary"
                        >
                          {n.name}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-5 text-center text-sm text-muted">
              点击图谱中的城市节点，查看其主导产业、代表企业与同产业关联城市。
            </Card>
          )}

          {/* 区域对比视图 */}
          <Card className="p-5">
            <h4 className="font-bold text-sm mb-3">区域对比 · 核心城市分布</h4>
            <div className="space-y-3">
              {(["东部", "中部", "西部", "东北"] as const).map((zone) => {
                const zoneNodes = nodes.filter((n) => n.zone === zone);
                const zoneCats = new Map<IndustryCat, number>();
                for (const n of zoneNodes) zoneCats.set(n.cat, (zoneCats.get(n.cat) ?? 0) + 1);
                return (
                  <div key={zone} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">{zone}</span>
                      <span className="text-[10px] text-muted">{zoneNodes.length} 城 · 主导：{[...zoneCats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}</span>
                    </div>
                    {/* 产业分布堆叠条 */}
                    <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                      {[...zoneCats.entries()].map(([cat, cnt]) => (
                        <div key={cat} style={{ width: `${(cnt / Math.max(zoneNodes.length, 1)) * 100}%`, backgroundColor: INDUSTRY_COLORS[cat] }} title={`${cat} ${cnt} 城`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {zoneNodes.slice(0, 8).map((n) => (
                        <button
                          key={n.name}
                          onClick={() => setSelected(n)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 hover:bg-primary/10 hover:text-primary"
                        >
                          {n.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
