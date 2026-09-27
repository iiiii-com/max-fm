"use client";

import { useMemo, useState } from "react";
import { CHAIN_LEVEL_COLORS } from "@/components/charts/palette";
import { safeJsonArray } from "@/lib/utils";

/**
 * 产业链布线图（终端风格）
 *
 * ── 为什么重做（第三版）──
 * 前两版都在和站点设计系统对着干，这才是「劣质、无质感」的真正来源：
 *   · globals.css 明确规定「圆角：硬边（1px 微圆角，与终端窗口一致）」，
 *     我却用了 rx=9 的圆角胶囊；
 *   · 规定「阴影仅保留极淡的层次，视觉主要靠 1px 边框」，
 *     我却用了 feGaussianBlur 辉光；
 *   · 主色是琥珀 #f28c00，我却上了亮绿/粉/青的糖果色。
 * 在深色终端风的站点里塞一套圆角+发光+糖果色，必然显得廉价。
 *
 * ── 本版遵循站点语言 ──
 *   · 硬边（rx=2，贴合 --radius-lg:1px）、1px 描边承担层级表达
 *   · 无发光、无重投影；强调色只用琥珀，其余全部走 --border / --muted / --surface
 *   · 等宽字体、tabular-nums、字距收紧 —— 与站点行情数字的排版一致
 *   · 层级色仅作左侧 2px 色标与列头小方块，是「标注」而非「装饰」
 *   · 连线为 1px 直角感贝塞尔 + 细小箭头，像布线图而非装饰曲线
 * 节点位置全部预计算，不走力导向，因此不会漂移。
 *
 * 数据真实性：节点只含「属于哪一层」，没有真实逐对供需关系，
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

/* 画布几何（统一坐标系，SVG 等比缩放） */
const COL_X = [150, 450, 750];
const BOX_W = 208;
const BOX_H = 40;
const GAP = 16;
const TOP = 74; // 列头下方起始
const PAD_BOTTOM = 26;
const W = 900;

/** 列头 */
function ColumnHeader({ x, level, count }: { x: number; level: Level; count: number }) {
  const color = CHAIN_LEVEL_COLORS[level] ?? "#8a8a8a";
  return (
    <g>
      <rect x={x - BOX_W / 2} y={16} width={BOX_W} height={30} rx={2} fill="var(--surface)" stroke="var(--border)" />
      <rect x={x - BOX_W / 2} y={16} width={2} height={30} fill={color} />
      <text
        x={x - BOX_W / 2 + 12}
        y={36}
        fontSize="12"
        fontWeight="700"
        fill="var(--foreground)"
        style={{ letterSpacing: "0.16em" }}
      >
        {level}
      </text>
      <text
        x={x + BOX_W / 2 - 12}
        y={36}
        textAnchor="end"
        fontSize="11"
        fill="var(--muted)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {count}
      </text>
      {/* 列头下方 1px 分隔线，强化终端分栏感 */}
      <line x1={x - BOX_W / 2} y1={56} x2={x + BOX_W / 2} y2={56} stroke="var(--border)" strokeWidth="1" />
    </g>
  );
}

export default function ChainSchematic({ nodes, title }: { nodes: FlowNode[]; title?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const { cols, H, maxN } = useMemo(() => {
    const g: Record<string, FlowNode[]> = { 上游: [], 中游: [], 下游: [], 其他: [] };
    for (const n of nodes) {
      const lv = (n.level ?? "") as Level;
      (g[lv] ?? g["其他"]).push(n);
    }
    const cols = LEVELS.map((lv, i) => ({ level: lv, items: g[lv], x: COL_X[i] }));
    const maxN = Math.max(1, ...cols.map((c) => c.items.length));
    const H = TOP + maxN * (BOX_H + GAP) - GAP + PAD_BOTTOM;
    return { cols, H, maxN };
  }, [nodes]);

  /** 每个节点中心 y（列内纵向居中） */
  const nodeY = useMemo(() => {
    const m: Record<string, number> = {};
    const fullH = maxN * (BOX_H + GAP) - GAP;
    for (const c of cols) {
      const total = c.items.length * BOX_H + Math.max(0, c.items.length - 1) * GAP;
      const start = TOP + (fullH - total) / 2;
      c.items.forEach((n, i) => {
        m[n.id ?? n.name] = start + i * (BOX_H + GAP) + BOX_H / 2;
      });
    }
    return m;
  }, [cols, maxN]);

  /** 层级连线：同层第 k 个 → 下层按比例映射到的那个（层级流向示意） */
  const links = useMemo(() => {
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
        const x2 = B.x - BOX_W / 2;
        const mx = (x1 + x2) / 2;
        // 两段直线 + 小圆角，读起来像布线而非装饰曲线
        out.push({ d: `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`, from: ka, to: kb });
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
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-bold">{title}</span>
          <span className="font-mono text-[11px] text-muted">
            {nodes.length} NODES · 上游 → 中游 → 下游
          </span>
        </div>
      )}

      {/* 桌面/平板：布线图（窄屏横向滚动以保证文字可读） */}
      <div className="hidden overflow-x-auto border border-border bg-background p-3 sm:block">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[680px]"
          role="img"
          aria-label="产业链布线图"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {cols.map((c) => (
            <ColumnHeader key={c.level} x={c.x} level={c.level} count={c.items.length} />
          ))}

          {/* 布线（压在节点下方） */}
          <g fill="none">
            {links.map((l, i) => {
              const on = !linked || (linked.has(l.from) && linked.has(l.to));
              const isActive = linked && on;
              return (
                <path
                  key={i}
                  d={l.d}
                  stroke={isActive ? "var(--primary)" : "var(--border-strong)"}
                  strokeWidth={isActive ? 1.5 : 1}
                  opacity={on ? (linked ? 1 : 0.9) : 0.18}
                  strokeLinejoin="round"
                  strokeLinecap="square"
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
              const isHover = hover === key;
              const isOpen = open === key;
              const dim = linked ? !linked.has(key) : false;
              const color = CHAIN_LEVEL_COLORS[c.level] ?? "#8a8a8a";
              return (
                <g
                  key={key}
                  transform={`translate(${c.x - BOX_W / 2}, ${y - BOX_H / 2})`}
                  opacity={dim ? 0.28 : 1}
                  style={{ transition: "opacity .16s ease", cursor: "pointer" }}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setOpen(isOpen ? null : key)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${c.level}：${n.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(isOpen ? null : key);
                    }
                  }}
                >
                  <rect
                    width={BOX_W}
                    height={BOX_H}
                    rx={2}
                    fill={isHover || isOpen ? "var(--surface)" : "var(--card)"}
                    stroke={isHover || isOpen ? "var(--primary)" : "var(--border)"}
                    strokeWidth="1"
                    style={{ transition: "stroke .16s ease, fill .16s ease" }}
                  />
                  {/* 左侧 2px 层级色标 */}
                  <rect width={2} height={BOX_H} fill={color} />
                  <text
                    x={14}
                    y={BOX_H / 2 + 4.5}
                    fontSize="12.5"
                    fill="var(--foreground)"
                    style={{ fontWeight: isHover || isOpen ? 700 : 500 }}
                  >
                    {n.name.length > 12 ? n.name.slice(0, 11) + "…" : n.name}
                  </text>
                  {/* 右侧层级角标 */}
                  <text
                    x={BOX_W - 10}
                    y={BOX_H / 2 + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--muted)"
                    style={{ letterSpacing: "0.1em" }}
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
        {cols.map((c) => (
          <div key={c.level}>
            <div className="mb-1.5 flex items-center gap-2 border-b border-border pb-1">
              <span className="h-3 w-0.5" style={{ background: CHAIN_LEVEL_COLORS[c.level] }} />
              <span className="text-xs font-bold tracking-widest">{c.level}</span>
              <span className="ml-auto font-mono text-[11px] text-muted">{c.items.length}</span>
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
                  >
                    <span className="min-w-0 flex-1 truncate">{n.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 详情（点选后出现） */}
      {active && (
        <div className="border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-0.5"
              style={{ background: CHAIN_LEVEL_COLORS[active.level ?? ""] ?? "#8a8a8a" }}
            />
            <span className="text-[13px] font-bold">{active.name}</span>
            <span className="font-mono text-[10px] tracking-widest text-muted">{active.level}</span>
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
