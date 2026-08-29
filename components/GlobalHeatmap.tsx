"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Map as MapIcon, RefreshCw } from "lucide-react";

interface HeatItem {
  code: string;
  name: string;
  region: string;
  drill: string;
  price: number | null;
  changePct: number | null;
  timestamp: string | null;
}
interface HeatGroup {
  market: string;
  flag: string;
  items: HeatItem[];
}

const UP = "#dc2626"; // 涨=红（A股惯例）
const DOWN = "#16a34a"; // 跌=绿
const FLAT = "#94a3b8";

/** 简化世界地图市场点位（x/y 为 viewBox 680×340 坐标） */
const MAP_POINTS: Array<{ name: string; x: number; y: number }> = [
  { name: "中国", x: 420, y: 158 },
  { name: "美国", x: 100, y: 120 },
  { name: "中国香港", x: 438, y: 168 },
  { name: "日本", x: 486, y: 138 },
  { name: "韩国", x: 460, y: 132 },
  { name: "中国台湾", x: 470, y: 162 },
  { name: "印度", x: 402, y: 200 },
  { name: "澳大利亚", x: 560, y: 250 },
  { name: "新加坡", x: 428, y: 210 },
  { name: "德国", x: 282, y: 118 },
  { name: "法国", x: 264, y: 130 },
  { name: "英国", x: 250, y: 100 },
];

/** 极简大陆轮廓（高度简化，仅示意） */
const CONTINENTS = [
  // 北美
  "M52,78 L120,40 L168,52 L178,96 L160,128 L148,168 L132,172 L120,140 L104,124 L88,128 L70,112 Z",
  // 南美
  "M158,186 L188,170 L212,196 L222,232 L210,282 L194,288 L186,262 L176,244 L164,228 Z",
  // 欧洲
  "M252,58 L286,44 L306,58 L300,86 L316,98 L300,118 L278,110 L268,128 L252,112 L244,88 Z",
  // 非洲
  "M286,138 L322,128 L348,144 L352,184 L336,226 L318,244 L300,226 L292,196 L282,168 Z",
  // 亚洲
  "M352,60 L430,52 L486,70 L506,96 L494,128 L472,150 L452,140 L438,162 L424,180 L402,188 L396,168 L384,146 L368,130 L360,104 L348,84 Z",
  // 澳洲
  "M540,238 L596,226 L622,248 L604,278 L562,290 L542,266 Z",
];

function colorOf(pct: number | null) {
  if (pct === null) return "#cbd5e1";
  if (pct > 0.05) return UP;
  if (pct < -0.05) return DOWN;
  return FLAT;
}

export default function GlobalHeatmap() {
  const [mode, setMode] = useState<"matrix" | "map">("matrix");
  const [data, setData] = useState<HeatGroup[] | null>(null);
  const [err, setErr] = useState("");
  const [updated, setUpdated] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await fetch("/api/global/heatmap", { cache: "no-store" });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? "加载失败");
      setData(j.groups);
      setUpdated(j.updated);
    } catch (e: any) {
      setErr(e?.message ?? "全球行情加载失败");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // 1 分钟自动刷新
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 地图模式：按市场聚合涨跌（取该市场首个指数）
  const mapStat = (name: string) => {
    if (!data) return null;
    const g = data.find((g) => g.market === name || (name === "中国台湾" && g.market === "亚太"));
    if (!g) return null;
    const first = g.items.find((i) => i.changePct !== null);
    return first;
  };

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            onClick={() => setMode("matrix")}
            className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${mode === "matrix" ? "bg-primary text-white" : "text-muted hover:bg-muted/30"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> 板块矩阵
          </button>
          <button
            onClick={() => setMode("map")}
            className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${mode === "map" ? "bg-primary text-white" : "text-muted hover:bg-muted/30"}`}
          >
            <MapIcon className="w-3.5 h-3.5" /> 世界地图
          </button>
        </div>
        <button onClick={load} className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors">
          <RefreshCw className="w-3 h-3" /> 刷新
        </button>
      </div>

      {err ? (
        <p className="text-sm text-destructive py-6 text-center">{err}（请刷新重试）</p>
      ) : !data ? (
        <p className="text-sm text-muted py-6 text-center">全球行情加载中…</p>
      ) : mode === "matrix" ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
          {data.map((g) => (
            <div key={g.market} className="rounded-lg border border-border overflow-hidden">
              <p className="text-[11px] font-bold px-2.5 py-1.5 bg-muted/30 border-b border-border">
                {g.flag} {g.market}
              </p>
              <div className="p-2 space-y-1">
                {g.items.map((it) => (
                  <Link
                    key={it.code}
                    href={`/market?tab=stocks&q=${encodeURIComponent(it.drill)}`}
                    className="flex items-center justify-between gap-1 rounded px-1.5 py-1 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-[11px] truncate">{it.name}</span>
                    {it.changePct === null ? (
                      <span className="text-[10px] text-muted shrink-0">受限</span>
                    ) : (
                      <span className="text-[11px] font-mono font-bold shrink-0" style={{ color: colorOf(it.changePct) }}>
                        {it.changePct > 0 ? "+" : ""}
                        {it.changePct.toFixed(2)}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox="0 0 680 320" className="w-full min-w-[520px] h-auto">
            {/* 大陆轮廓 */}
            {CONTINENTS.map((d, i) => (
              <path key={i} d={d} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
            ))}
            {/* 市场点位 */}
            {MAP_POINTS.map((p) => {
              const q = mapStat(p.name);
              const pct = q?.changePct ?? null;
              const c = colorOf(pct);
              return (
                <Link key={p.name} href={q ? `/market?tab=stocks&q=${encodeURIComponent(q.drill)}` : "#"}>
                  <g className="cursor-pointer group">
                    <circle cx={p.x} cy={p.y} r={12} fill={c} opacity={0.15} />
                    <circle cx={p.x} cy={p.y} r={6} fill={c} stroke="#fff" strokeWidth="1.5" />
                    <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="10" fontWeight={700} fill="#334155">
                      {p.name}
                    </text>
                    <text x={p.x} y={p.y + 20} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="monospace">
                      {pct === null ? "受限" : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
                    </text>
                    {/* hover 详情 */}
                    {q && (
                      <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <rect x={p.x - 46} y={p.y + 24} width={92} height={26} rx={5} fill="#0f172a" opacity={0.88} />
                        <text x={p.x} y={p.y + 42} textAnchor="middle" fontSize="9.5" fill="#fff">
                          {q.name} · {q.price?.toLocaleString() ?? "—"}
                        </text>
                      </g>
                    )}
                  </g>
                </Link>
              );
            })}
          </svg>
        </div>
      )}

      <figcaption className="text-[11px] text-muted mt-3 leading-relaxed border-t border-border/60 pt-2">
        <b className="text-foreground">图注</b>：全球主要市场指数与龙头股实时涨跌（红涨绿跌，A 股惯例）。板块矩阵按市场分组，世界地图按市场聚合（取该市场指数涨跌）。
        数据源：新浪行情（实时）· 东财（受限市场补充）；每 60 秒自动刷新{updated ? ` · 最近更新 ${new Date(updated).toLocaleTimeString("zh-CN", { hour12: false })}` : ""}。
        点击任意色块/点位可下钻查看 K 线；受限项为数据源暂时不可达（线上版本可用）。
      </figcaption>
    </figure>
  );
}
