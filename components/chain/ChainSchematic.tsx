"use client";

import { useMemo, useState } from "react";
import { CHAIN_LEVEL_COLORS } from "@/components/charts/palette";
import { safeJsonArray } from "@/lib/utils";

/**
 * 产业链布线图（终端风格 · 第四版）
 *
 * ── 沿革与每一版解决什么 ──
 * v1 力导向图：节点每次渲染位置漂移 → 「交互不流畅」
 * v2 三列卡片：稳了但本质是列表，且 rx=9 圆角 + 辉光 + 糖果色与站点设计系统冲突
 *              （globals.css：圆角 1px 硬边、阴影极淡靠 1px 边框、主色琥珀）→ 「劣质无质感」
 * v3 终端布线图：回到站点语言，但颜色压得过狠显得发灰，且三列各自居中导致顶部参差
 * v4（本版）针对 v3 的具体粗糙点改进：
 *   · 列顶部对齐（节点多的列向下延伸），顶部一条水平基准线，观感更整齐
 *   · 连线直角处加小圆角过渡，并在末端加箭头，方向一眼可辨
 *   · 层级色回归但克制：列底 5% 淡染 + 3px 色条 + 标签着色，不是大面积铺色
 *   · 节点用 --shadow-sm 做极淡层次，悬停时描边转琥珀并轻微上浮
 *   · 排版细化：等宽 + tabular-nums + 字距，与站点行情数字一致
 *
 * 节点位置全部预计算（不走力导向），不会有漂移。
 * 数据真实性：节点只含「属于哪一层」，无真实逐对供需关系，
 * 因此连线表达的是**层级流向**（按同层顺序等比映射到下一层），非具体供需对。
 */

const LEVELS = ["上游", "中游", "下游"] as const;
type Level = (typeof LEVELS)[number];

export interface FlowNode {
  id?: string;
  name: string;
  level?: string | null;
  description?: string | null;
  companies?: string | null;
}

/* 画布几何 */
const COL_X = [150, 450, 750];
const BOX_W = 212;
const BOX_H = 44;
const GAP = 14;
const TOP = 84; // 节点区起始 y
const BOTTOM_PAD = 30;
const W = 900;
const RAIL_TOP = 62; // 列导轨起点

export default function ChainSchematic({ nodes, title }: { nodes: FlowNode[]; title?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const { cols, H } = useMemo(() => {
    const g: Record<string, FlowNode[]> = { 上游: [], 中游: [], 下游: [], 其他: [] };
    for (const n of nodes) {
      const lv = (n.level ?? "") as Level;
      (g[lv] ?? g["其他"]).push(n);
    }
    const cols = LEVELS.map((lv, i) => ({ level: lv, items: g[lv], x: COL_X[i] }));
    const maxN = Math.max(1, ...cols.map((c) => c.items.length));
    const H = TOP + maxN * (BOX_H + GAP) - GAP + BOTTOM_PAD;
    return { cols, H };
  }, [nodes]);

  /** 节点中心 y：**顶对齐**（第 k 个节点在所有列都从同一起点向下排），使列顶整齐 */
  const nodeY = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cols) {
      c.items.forEach((n, i) => {
        m[n.id ?? n.name] = TOP + i * (BOX_H + GAP) + BOX_H / 2;
      });
    }
    return m;
  }, [cols]);

  /** 层级连线：直角布线 + 转角圆角，末端带箭头 */
  const links = useMemo(() => {
    const R = 8; // 转角半径
    const out: Array<{ d: string; from: string; to: string }> = [];
    for (let ci = 0; ci < cols.length - 1; ci++) {
      const A = cols[ci];
      const B = cols[ci + 1];
      if (!A.items.length || !B.items.length) continue;
      A.items.forEach((na, k) => {
        const nb = B.items[Math.min(B.items.length - 1, Math.floor((k * B.items.length) / A.items.length))];
        const ka = na.id ?? na.name;
        const kb = nb.id ?? nb.name;
        const y1 = nodeY[ka];
        const y2 = nodeY[kb];
        if (y1 == null || y2 == null) return;
        const x1 = A.x + BOX_W / 2;
        const x2 = B.x - BOX_W / 2 - 7; // 留出箭头位置
        const mx = (x1 + x2) / 2;
        const same = Math.abs(y1 - y2) < 0.5;
        // 转角处用二次曲线过渡，避免生硬直角
        const d = same
          ? `M ${x1} ${y1} L ${x2} ${y2}`
          : y2 > y1
            ? `M ${x1} ${y1} L ${mx - R} ${y1} Q ${mx} ${y1} ${mx} ${y1 + R} L ${mx} ${y2 - R} Q ${mx} ${y2} ${mx + R} ${y2} L ${x2} ${y2}`
            : `M ${x1} ${y1} L ${mx - R} ${y1} Q ${mx} ${y1} ${mx} ${y1 - R} L ${mx} ${y2 + R} Q ${mx} ${y2} ${mx + R} ${y2} L ${x2} ${y2}`;
        out.push({ d, from: ka, to: kb });
      });
    }
    return out;
  }, [cols, nodeY]);

  const linked = useMemo(() => {
    if (!hover) return null;
    const s = new Set<string>([hover]);
    for (const l of links) {
      if (l.from === hover) s.add(l.to);
      if (l.to === hover) s.add(l.from);
    }
    return s;
  }, [hover, links]);

  const active = nodes.find((n) => (n.id ?? n.name) === (open ?? hover));
  const companies = useMemo(() => safeJsonArray<string>(active?.companies).slice(0, 8), [active]);

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-sm font-bold tracking-wide">{title}</span>
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {nodes.length} NODES · {cols.map((c) => `${c.level} ${c.items.length}`).join(" / ")}
          </span>
        </div>
      )}

      <div className="hidden overflow-x-auto border border-border bg-background p-3 sm:block">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[700px]"
          role="img"
          aria-label="产业链布线图"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <defs>
            {/* 箭头：普通灰 / 高亮琥珀，两种分别定义以便切换颜色 */}
            <marker id="lk-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--border-strong)" />
            </marker>
            <marker id="lk-arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--primary)" />
            </marker>
          </defs>

          {/* 每列：淡染底色 + 左右导轨，营造终端分栏的秩序感 */}
          {cols.map((c) => {
            const color = CHAIN_LEVEL_COLORS[c.level] ?? "#6b6862";
            return (
              <g key={c.level}>
                <rect x={c.x - BOX_W / 2 - 12} y={RAIL_TOP} width={BOX_W + 24} height={H - RAIL_TOP - 10} fill={color} opacity={0.05} />
                <line x1={c.x - BOX_W / 2 - 12} y1={RAIL_TOP} x2={c.x - BOX_W / 2 - 12} y2={H - 10} stroke="var(--border)" strokeWidth="1" />
                <line x1={c.x + BOX_W / 2 + 12} y1={RAIL_TOP} x2={c.x + BOX_W / 2 + 12} y2={H - 10} stroke="var(--border)" strokeWidth="1" />
              </g>
            );
          })}

          {/* 列头 */}
          {cols.map((c) => {
            const color = CHAIN_LEVEL_COLORS[c.level] ?? "#6b6862";
            return (
              <g key={c.level}>
                <rect x={c.x - BOX_W / 2} y={26} width={BOX_W} height={30} rx={2} fill="var(--surface)" stroke="var(--border)" />
                <rect x={c.x - BOX_W / 2} y={26} width={3} height={30} fill={color} />
                <text x={c.x - BOX_W / 2 + 14} y={46} fontSize="12.5" fontWeight="700" fill={color} style={{ letterSpacing: "0.2em" }}>
                  {c.level}
                </text>
                <text
                  x={c.x + BOX_W / 2 - 12}
                  y={46}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--muted)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {c.items.length}
                </text>
                {/* 列头与节点区之间的水平基准线 */}
                <line x1={c.x - BOX_W / 2} y1={66} x2={c.x + BOX_W / 2} y2={66} stroke={color} strokeWidth="1" opacity="0.5" />
              </g>
            );
          })}

          {/* 连线（在节点下方） */}
          <g fill="none">
            {links.map((l, i) => {
              const on = !linked || (linked.has(l.from) && linked.has(l.to));
              const isActive = !!linked && on;
              return (
                <path
                  key={i}
                  d={l.d}
                  stroke={isActive ? "var(--primary)" : "var(--border-strong)"}
                  strokeWidth={isActive ? 1.4 : 1}
                  opacity={on ? (linked ? 1 : 0.85) : 0.16}
                  markerEnd={isActive ? "url(#lk-arrow-on)" : "url(#lk-arrow)"}
                  style={{ transition: "opacity .16s ease, stroke .16s ease" }}
                />
              );
            })}
          </g>

          {/* 节点 */}
          {cols.map((c) =>
            c.items.map((n) => {
              const key = n.id ?? n.name;
              const y = nodeY[key];
              if (y == null) return null;
              const isOn = hover === key || open === key;
              const dim = linked ? !linked.has(key) : false;
              const color = CHAIN_LEVEL_COLORS[c.level] ?? "#6b6862";
              return (
                <g
                  key={key}
                  transform={`translate(${c.x - BOX_W / 2}, ${y - BOX_H / 2})`}
                  opacity={dim ? 0.26 : 1}
                  style={{ transition: "opacity .16s ease, transform .16s ease", cursor: "pointer" }}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setOpen(open === key ? null : key)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${c.level}：${n.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(open === key ? null : key);
                    }
                  }}
                >
                  <rect
                    width={BOX_W}
                    height={BOX_H}
                    rx={2}
                    fill={isOn ? "var(--surface)" : "var(--card)"}
                    stroke={isOn ? "var(--primary)" : "var(--border)"}
                    strokeWidth="1"
                    style={{ transition: "stroke .16s ease, fill .16s ease", filter: isOn ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,.5))" }}
                  />
                  {/* 左侧 3px 层级色条 */}
                  <rect width={3} height={BOX_H} fill={color} />
                  <text
                    x={15}
                    y={BOX_H / 2 + 0.5}
                    fontSize="12.5"
                    fill="var(--foreground)"
                    style={{ fontWeight: isOn ? 700 : 500, letterSpacing: "0.02em" }}
                    dominantBaseline="middle"
                  >
                    {n.name.length > 12 ? n.name.slice(0, 11) + "…" : n.name}
                  </text>
                  {/* 右侧层级角标（着色，作为唯一的层级提示） */}
                  <text
                    x={BOX_W - 11}
                    y={BOX_H / 2 + 0.5}
                    textAnchor="end"
                    fontSize="10"
                    fill={color}
                    opacity="0.85"
                    dominantBaseline="middle"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    {c.level}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* 移动端：纵向分组 */}
      <div className="space-y-4 sm:hidden">
        {cols.map((c) => {
          const color = CHAIN_LEVEL_COLORS[c.level] ?? "#6b6862";
          return (
            <div key={c.level}>
              <div className="mb-1.5 flex items-center gap-2 border-b border-border pb-1">
                <span className="h-3 w-0.5" style={{ background: color }} />
                <span className="text-xs font-bold tracking-widest" style={{ color }}>
                  {c.level}
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-muted">{c.items.length}</span>
              </div>
              <div className="space-y-1.5">
                {c.items.map((n) => {
                  const key = n.id ?? n.name;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setOpen(open === key ? null : key)}
                      className="flex w-full items-center gap-2 border border-border bg-card px-3 py-2 text-left font-mono text-[13px]"
                      style={{ borderLeftWidth: 3, borderLeftColor: color }}
                    >
                      <span className="min-w-0 flex-1 truncate">{n.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 详情 */}
      {active && (
        <div
          className="border border-border bg-card p-3"
          style={{ borderLeftWidth: 3, borderLeftColor: CHAIN_LEVEL_COLORS[active.level ?? ""] ?? "#6b6862" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold">{active.name}</span>
            <span
              className="font-mono text-[10px] tracking-widest"
              style={{ color: CHAIN_LEVEL_COLORS[active.level ?? ""] ?? "#6b6862" }}
            >
              {active.level}
            </span>
          </div>
          {active.description && <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{active.description}</p>}
          {companies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {companies.map((x) => (
                <span key={x} className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  {x}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
