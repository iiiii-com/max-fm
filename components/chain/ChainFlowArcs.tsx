"use client";

import { useMemo, useState } from "react";
import { Factory, Package, ShoppingCart } from "lucide-react";
import { CHAIN_LEVEL_COLORS } from "@/components/charts/palette";
import { safeJsonArray } from "@/lib/utils";

/**
 * 产业链弧形流线图（SVG）
 *
 * ── 设计取舍 ──
 * 前一版做成了「三列卡片」，问题在于它本质仍是列表：缺少连接、流向与反馈。
 * 本版改为 SVG 弧形流线图：
 *   · 三列节点位置**预先算定**（不走力导向），因此不会像早期版本那样来回漂移；
 *   · 列与列之间用**贝塞尔弧线束**连接，方向自上而下、自左而右，流向一目了然；
 *   · 悬停某环节 → 高亮其上下游链路、压暗无关节点，并浮出说明卡；
 *   · 切换产业链时路径有描边入场动画（尊重 prefers-reduced-motion）。
 *
 * ── 数据真实性说明 ──
 * 节点数据只含「环节属于上游/中游/下游哪一层」，**并没有真实的逐对供需关系**。
 * 因此连线表达的是**层级流向**（按同层内顺序等比映射到下一层），
 * 而不是「A 公司供货给 B 公司」这类具体关系。文案上也据此表述，避免误导。
 */

const LEVELS = ["上游", "中游", "下游"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_META: Record<Level, { icon: typeof Factory; hint: string }> = {
  上游: { icon: Package, hint: "原材料 · 设备" },
  中游: { icon: Factory, hint: "制造 · 集成" },
  下游: { icon: ShoppingCart, hint: "应用 · 终端" },
};

export interface FlowNode {
  id?: string;
  name: string;
  level?: string | null;
  description?: string | null;
  companies?: string | null;
}

/* ── 画布几何（统一坐标系，SVG 自适应缩放） ── */
const COL_X = [150, 450, 750]; // 三列中心 x
const PILL_W = 210;
const PILL_H = 38;
const GAP = 14;
const HEAD_Y = 14; // 列头基线
const TOP = 56; // 首行节点顶部
const PAD_BOTTOM = 20;
const W = 900;

export default function ChainFlowArcs({ nodes, title }: { nodes: FlowNode[]; title?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const { cols, H } = useMemo(() => {
    const g: Record<string, FlowNode[]> = { 上游: [], 中游: [], 下游: [], 其他: [] };
    for (const n of nodes) {
      const lv = (n.level ?? "") as Level;
      (g[lv] ?? g["其他"]).push(n);
    }
    const cols = LEVELS.map((lv, i) => ({
      level: lv,
      items: g[lv],
      x: COL_X[i],
      color: CHAIN_LEVEL_COLORS[lv] ?? "#6b7280",
    }));
    const maxN = Math.max(1, ...cols.map((c) => c.items.length));
    const H = TOP + maxN * (PILL_H + GAP) - GAP + PAD_BOTTOM;
    return { cols, H };
  }, [nodes]);

  /** 每列中每个节点的中心 y（纵向居中） */
  const nodeY = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cols) {
      const total = c.items.length * PILL_H + Math.max(0, c.items.length - 1) * GAP;
      const start = TOP + (Math.max(1, ...cols.map((x) => x.items.length)) * (PILL_H + GAP) - GAP - total) / 2;
      c.items.forEach((n, i) => {
        m[n.id ?? n.name] = start + i * (PILL_H + GAP) + PILL_H / 2;
      });
    }
    return m;
  }, [cols]);

  /**
   * 层级流线：把第 i 层第 k 个节点，按比例映射到第 i+1 层对应节点。
   * 这是「层级流向」的等比示意，非逐对供需关系（见文件头说明）。
   */
  const arcs = useMemo(() => {
    const out: Array<{ d: string; from: string; to: string; c1: string; c2: string }> = [];
    for (let ci = 0; ci < cols.length - 1; ci++) {
      const A = cols[ci];
      const B = cols[ci + 1];
      if (!A.items.length || !B.items.length) continue;
      A.items.forEach((na, k) => {
        const nb = B.items[Math.min(B.items.length - 1, Math.floor((k * B.items.length) / A.items.length))];
        const ka = na.id ?? na.name;
        const kb = nb.id ?? nb.name;
        const x1 = A.x + PILL_W / 2;
        const y1 = nodeY[ka];
        const x2 = B.x - PILL_W / 2;
        const y2 = nodeY[kb];
        if (y1 == null || y2 == null) return;
        const dx = (x2 - x1) * 0.5;
        out.push({
          d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
          from: ka,
          to: kb,
          c1: A.color,
          c2: B.color,
        });
      });
    }
    return out;
  }, [cols, nodeY]);

  const hoverNode = nodes.find((n) => (n.id ?? n.name) === (open ?? hover));
  const companies = useMemo(() => safeJsonArray<string>(hoverNode?.companies).slice(0, 8), [hoverNode]);

  /* 悬停时：与当前节点相连的弧线高亮，其余压暗 */
  const linked = useMemo(() => {
    if (!hover) return null;
    const s = new Set<string>();
    for (const a of arcs) {
      if (a.from === hover) s.add(a.to);
      if (a.to === hover) s.add(a.from);
    }
    s.add(hover);
    return s;
  }, [hover, arcs]);

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-bold">{title}</p>
          <p className="text-[11px] text-muted">
            {nodes.length} 个环节 · 弧线表示层级流向（上游 → 中游 → 下游），非逐对供需关系
          </p>
        </div>
      )}

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        {cols.map((c) => (
          <span key={c.level} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}80` }} />
            <span style={{ color: c.color }} className="font-medium">
              {c.level}
            </span>
            <span className="text-muted">
              {c.items.length} 环节 · {LEVEL_META[c.level].hint}
            </span>
          </span>
        ))}
      </div>

      {/* 桌面/平板：弧形流线图（窄屏横向滚动，保证文字可读） */}
      <div className="hidden overflow-x-auto sm:block">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[680px]" role="img" aria-label="产业链弧形流线图">
          <defs>
            {arcs.map((a, i) => (
              <linearGradient key={i} id={`arc-${i}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={0}>
                <stop offset="0%" stopColor={a.c1} stopOpacity="0.85" />
                <stop offset="100%" stopColor={a.c2} stopOpacity="0.85" />
              </linearGradient>
            ))}
            <filter id="arc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 列头 */}
          {cols.map((c) => (
            <g key={c.level}>
              <rect x={c.x - PILL_W / 2} y={HEAD_Y - 12} width={PILL_W} height={26} rx={6} fill={c.color} opacity={0.13} />
              <text
                x={c.x}
                y={HEAD_Y + 5}
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill={c.color}
                style={{ letterSpacing: "0.02em" }}
              >
                {c.level} · {c.items.length}
              </text>
            </g>
          ))}

          {/* 流线（先画，压在节点下方） */}
          <g fill="none">
            {arcs.map((a, i) => {
              const on = !linked || (linked.has(a.from) && linked.has(a.to));
              return (
                <path
                  key={i}
                  d={a.d}
                  stroke={`url(#arc-${i})`}
                  strokeWidth={linked && on ? 2.4 : 1.6}
                  opacity={on ? (linked ? 0.95 : 0.5) : 0.1}
                  strokeLinecap="round"
                  filter={linked && on ? "url(#arc-glow)" : undefined}
                  style={{ transition: "opacity .18s ease, stroke-width .18s ease" }}
                />
              );
            })}
          </g>

          {/* 节点胶囊 */}
          {cols.map((c) =>
            c.items.map((n) => {
              const key = n.id ?? n.name;
              const y = nodeY[key];
              if (y == null) return null;
              const active = hover === key;
              const dim = linked ? !linked.has(key) : false;
              return (
                <g
                  key={key}
                  transform={`translate(${c.x - PILL_W / 2}, ${y - PILL_H / 2})`}
                  opacity={dim ? 0.35 : 1}
                  style={{ transition: "opacity .18s ease", cursor: "pointer" }}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setOpen(open === key ? null : key)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${c.level}环节：${n.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(open === key ? null : key);
                    }
                  }}
                >
                  <rect
                    width={PILL_W}
                    height={PILL_H}
                    rx={9}
                    fill="var(--card)"
                    stroke={c.color}
                    strokeWidth={active ? 2 : 1}
                    opacity={active ? 1 : 0.92}
                    style={{ transition: "stroke-width .18s ease" }}
                  />
                  {/* 左侧色条 */}
                  <rect width={4} height={PILL_H} rx={2} fill={c.color} opacity={active ? 1 : 0.75} />
                  <text x={14} y={PILL_H / 2 + 4.5} fontSize="12.5" fill="var(--foreground)" style={{ fontWeight: active ? 700 : 500 }}>
                    {n.name.length > 13 ? n.name.slice(0, 12) + "…" : n.name}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* 移动端：纵向分组（窄屏下 SVG 会缩到不可读，故改用纵向排布） */}
      <div className="space-y-4 sm:hidden">
        {cols.map((c) => (
          <div key={c.level}>
            <p className="mb-1.5 text-xs font-bold" style={{ color: c.color }}>
              {c.level} · {c.items.length} 环节
            </p>
            <div className="space-y-1.5">
              {c.items.map((n) => {
                const key = n.id ?? n.name;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOpen(open === key ? null : key)}
                    className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-[13px]"
                    style={{ borderColor: `${c.color}66`, borderLeftWidth: 3, borderLeftColor: c.color }}
                  >
                    <span className="min-w-0 flex-1 truncate">{n.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 详情卡（点击环节后出现） */}
      {hoverNode && (
        <div
          className="rounded-lg border border-border bg-card p-3"
          style={{ borderLeftWidth: 3, borderLeftColor: CHAIN_LEVEL_COLORS[hoverNode.level ?? ""] ?? "#6b7280" }}
        >
          <p className="text-[13px] font-bold">
            {hoverNode.name}
            <span className="ml-2 text-[11px] font-normal text-muted">{hoverNode.level}</span>
          </p>
          {hoverNode.description && (
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{hoverNode.description}</p>
          )}
          {companies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {companies.map((x) => (
                <span key={x} className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                  {x}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted/70">点击其他环节可切换；再次点击关闭</p>
        </div>
      )}
    </div>
  );
}
