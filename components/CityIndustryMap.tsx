"use client";

import { useMemo, useRef, useState } from "react";
import type { EChartsOption } from "@/components/charts/echarts";
import { echarts } from "@/components/charts/echarts";
import ChinaMap from "@/components/charts/ChinaMap";
import { Badge, Card } from "@/components/ui";
import { STATIC_REGIONS } from "@/lib/data/regions";

/** 核心城市经纬度（省会/直辖市 + 重点经济城市，公开地理坐标） */
export const CITY_COORDS: Record<string, [number, number]> = {
  北京: [116.405285, 39.904989],
  上海: [121.472644, 31.231706],
  广州: [113.264385, 23.129112],
  深圳: [114.057868, 22.543099],
  杭州: [120.153576, 30.287459],
  南京: [118.796877, 32.060255],
  苏州: [120.585316, 31.298886],
  成都: [104.066541, 30.572269],
  重庆: [106.551556, 29.563009],
  武汉: [114.305393, 30.593099],
  西安: [108.939842, 34.341574],
  天津: [117.190182, 39.125596],
  长沙: [112.938814, 28.228209],
  郑州: [113.625368, 34.7466],
  合肥: [117.227239, 31.820586],
  福州: [119.296494, 26.074508],
  厦门: [118.089425, 24.479833],
  济南: [117.120098, 36.651216],
  青岛: [120.382639, 36.067082],
  沈阳: [123.431474, 41.805698],
  大连: [121.614682, 38.914003],
  长春: [125.323544, 43.817071],
  哈尔滨: [126.534967, 45.803775],
  南昌: [115.858197, 28.682892],
  太原: [112.548879, 37.87059],
  贵阳: [106.630153, 26.647661],
  昆明: [102.832891, 24.880095],
  南宁: [108.366543, 22.817002],
  呼和浩特: [111.74918, 40.842585],
  兰州: [103.834303, 36.061089],
  乌鲁木齐: [87.616848, 43.825592],
  海口: [110.198293, 20.044412],
  银川: [106.230909, 38.487193],
  西宁: [101.778228, 36.617144],
  拉萨: [91.140856, 29.645554],
  东莞: [113.751799, 23.020673],
  佛山: [113.121926, 23.021548],
  宁波: [121.550327, 29.874556],
  无锡: [120.31191, 31.491169],
  珠海: [113.553986, 22.224979],
  泉州: [118.675675, 24.874132],
  温州: [120.699366, 27.994267],
  宁德: [119.547932, 26.665791],
  宜宾: [104.643215, 28.751768],
  淄博: [118.054722, 36.813182],
  宜昌: [111.286417, 30.691896],
  株洲: [113.133884, 27.827948],
  包头: [109.840403, 40.657467],
  常州: [119.974062, 31.811226],
  南通: [120.89447, 31.981154],
  惠州: [114.415603, 23.111092],
  石家庄: [114.514064, 38.042805],
  赣州: [114.935, 25.831092],
  桂林: [110.290184, 25.273552],
  烟台: [121.447935, 37.463822],
  唐山: [118.180193, 39.630867],
  徐州: [117.284124, 34.205768],
  遵义: [106.92739, 27.725654],
  绵阳: [104.679004, 31.467459],
  襄阳: [112.122552, 32.008905],
  洛阳: [112.453926, 34.620202],
  柳州: [109.428743, 24.325404],
};

export interface CityIndustry {
  name: string;
  coords: [number, number];
  province: string;
  gdp: string;
  pillar: string[];
  advantage: string[];
  companies: string[];
}

/** 从 regions.ts 汇总城市产业数据 + 经纬度 */
export function buildCityIndustries(): CityIndustry[] {
  const out: CityIndustry[] = [];
  for (const region of STATIC_REGIONS) {
    for (const c of region.cities) {
      const coord = CITY_COORDS[c.name];
      if (!coord) continue; // 仅标注有坐标的核心城市
      out.push({
        name: c.name,
        coords: coord,
        province: region.province,
        gdp: c.gdp,
        pillar: c.pillar,
        advantage: c.advantage,
        companies: c.companies,
      });
    }
  }
  return out;
}

/** 解析 GDP 字符串（"3.6万亿" / "1.2万" → 数字，用于排序与规模） */
export function gdpToNum(gdp: string): number {
  const m = gdp.match(/([\d.]+)\s*(万亿|亿|万)?/);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  const unit = m[2] ?? "";
  if (unit.includes("万亿")) return v * 10000;
  if (unit.includes("亿")) return v * 1;
  if (unit.includes("万")) return v / 10000;
  return v;
}

/** 缩放级别 → 标签显示密度（全局/区域/城市三级） */
function labelDensity(zoom: number, total: number): number {
  if (zoom >= 3) return total; // 城市级：全部
  if (zoom >= 1.8) return Math.min(45, total); // 区域级：主要城市
  return Math.min(20, total); // 全局：一线/头部城市
}

export default function CityIndustryMap() {
  const [selected, setSelected] = useState<CityIndustry | null>(null);
  const [zoom, setZoom] = useState(1.1);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const cities = useMemo(() => buildCityIndustries(), []);
  const [filter, setFilter] = useState<string>("全部");

  const zones = ["全部", "东部", "中部", "西部", "东北"];
  const visible = filter === "全部" ? cities : cities.filter((c) => {
    const region = STATIC_REGIONS.find((r) => r.province === c.province);
    return region?.zone === filter;
  });

  // 按 GDP 排序（标签优先级：大城市在前）
  const sorted = useMemo(() => [...visible].sort((a, b) => gdpToNum(b.gdp) - gdpToNum(a.gdp)), [visible]);
  const labelCount = labelDensity(zoom, visible.length);
  const labeled = useMemo(() => new Set(sorted.slice(0, labelCount).map((c) => c.name)), [sorted, labelCount]);

  const option = useMemo<EChartsOption>(() => {
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#cbd5e1",
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: "#1e293b", fontSize: 12 },
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px",
        formatter: (params: any) => {
          const d = params?.data as { name?: string; province?: string; gdp?: string; pillar?: string[]; advantage?: string[]; companies?: string[] } | undefined;
          if (!d?.name) return "";
          const rows = [
            d.province ? `<div style="color:#64748b;font-size:11px;margin-bottom:4px">${d.province} · GDP ${d.gdp ?? "—"}</div>` : "",
            d.pillar?.length ? `<div style="margin-bottom:2px"><span style="color:#64748b">🏭 支柱产业</span>：<b>${d.pillar.join("、")}</b></div>` : "",
            d.advantage?.length ? `<div style="margin-bottom:2px"><span style="color:#64748b">🚀 产业优势</span>：${d.advantage.join("、")}</div>` : "",
            d.companies?.length ? `<div style="margin-bottom:2px"><span style="color:#64748b">🏢 代表企业</span>：${d.companies.join("、")}</div>` : "",
            `<div style="color:#64748b;font-size:11px;margin-top:4px">产业 ${d.pillar?.length ?? 0} 项 · 代表企业 ${d.companies?.length ?? 0} 家 · 优势 ${d.advantage?.length ?? 0} 项</div>`,
          ];
          return `<b style="font-size:13px">${d.name}</b>${rows.join("")}`;
        },
      },
      geo: {
        map: "china",
        roam: true,
        zoom: 1.1,
        itemStyle: { areaColor: "rgba(99,102,241,0.06)", borderColor: "#64748b", borderWidth: 0.6 },
        emphasis: { itemStyle: { areaColor: "rgba(99,102,241,0.12)" }, label: { show: false } },
        label: { show: false },
        // 分层渲染：geo 背景层静态、气泡层独立，缩放时只重绘气泡
        silent: false,
      },
      series: [
        {
          name: "核心城市",
          type: "effectScatter",
          coordinateSystem: "geo",
          data: sorted.map((c) => ({
            name: c.name,
            value: [...c.coords, 1],
            province: c.province,
            gdp: c.gdp,
            pillar: c.pillar,
            advantage: c.advantage,
            companies: c.companies,
          })),
          symbolSize: (val: any, params: any) => {
            const name = params?.name;
            return selected?.name === name ? 22 : 12;
          },
          rippleEffect: { brushType: "stroke", scale: 3, period: 4 },
          label: {
            show: true,
            formatter: (p: any) => (labeled.has(p.name) ? p.name : ""),
            position: "right",
            fontSize: 10,
            color: "#475569",
            textBorderColor: "rgba(255,255,255,0.9)",
            textBorderWidth: 2,
          },
          itemStyle: { color: "#c8102e", shadowBlur: 6, shadowColor: "rgba(200,16,46,0.4)" },
          emphasis: {
            scale: 1.4,
            itemStyle: { color: "#e11d48" },
            label: { show: true, fontSize: 12, color: "#c8102e", fontWeight: "bold", textBorderWidth: 3 },
          },
        },
      ],
    };
  }, [sorted, selected, labeled]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {zones.map((z) => (
          <button
            key={z}
            onClick={() => setFilter(z)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${filter === z ? "bg-primary text-white border-primary" : "border-border text-muted hover:border-primary/50"}`}
          >
            {z}
          </button>
        ))}
        <span className="text-[10px] text-muted ml-auto">
          地图标注 {visible.length} 个核心城市 · 悬停看产业规模/企业 · 点击查看产业图谱 · 缩放自适应标签密度
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Card className="p-3">
          <ChinaMap
            option={option}
            height={520}
            onReady={(c) => {
              chartRef.current = c;
              // 读取初始 zoom
              try {
                const opt = c.getOption() as any;
                const z = opt?.geo?.[0]?.zoom;
                if (typeof z === "number") setZoom(z);
              } catch { /* ignore */ }
            }}
            onEvents={{
              click: (params: any) => {
                const d = params?.data as CityIndustry | undefined;
                if (d?.name) setSelected(d);
              },
              georoam: () => {
                // 缩放/平移后读取 geo zoom，自适应标签密度
                const c = chartRef.current;
                if (!c) return;
                try {
                  const opt = c.getOption() as any;
                  const z = opt?.geo?.[0]?.zoom;
                  if (typeof z === "number") setZoom(z);
                } catch { /* ignore */ }
              },
            }}
          />
          <p className="text-[10px] text-muted mt-2">
            缩放提示：全局视图仅标注头部城市（<b>{Math.min(20, visible.length)}</b> 个标签）；放大到区域级显示主要城市；城市级全部显示。
          </p>
        </Card>

        {/* 产业图谱详情（点击浮层） */}
        <div className="space-y-3">
          {selected ? (
            <Card className="p-5 border-l-4 border-l-primary">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{selected.name}</h3>
                <Badge tone="blue">{selected.province}</Badge>
              </div>
              <p className="text-xs text-muted mb-3">
                GDP {selected.gdp} · 经纬度 {selected.coords[0].toFixed(2)}E, {selected.coords[1].toFixed(2)}N
                <span className="ml-2">· {selected.pillar.length} 项产业 · {selected.companies.length} 家代表企业</span>
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-muted mb-1.5">🏭 支柱产业</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.pillar.map((p) => <Badge key={p} tone="red">{p}</Badge>)}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted mb-1.5">🚀 产业优势</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.advantage.map((a) => <Badge key={a} tone="blue">{a}</Badge>)}
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
              </div>
            </Card>
          ) : (
            <Card className="p-5 text-center text-sm text-muted">
              点击地图上的红色气泡（核心城市），查看该城市的支柱产业、产业优势与代表企业；悬停气泡可快速查看产业规模与企业数量。
            </Card>
          )}

          <Card className="p-5">
            <h4 className="font-bold text-sm mb-3">核心城市产业速览（{visible.length}）</h4>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {sorted.slice(0, 60).map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSelected(c)}
                  className="w-full text-left rounded-lg border border-border px-3 py-2 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="text-[10px] text-muted">{c.gdp}</span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 truncate">
                    {c.pillar.join(" · ")}
                    {c.advantage.length > 0 && ` · 优势：${c.advantage.join("、")}`}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
