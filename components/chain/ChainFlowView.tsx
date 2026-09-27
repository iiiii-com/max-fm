"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Factory, Package, ShoppingCart } from "lucide-react";
import { CHAIN_LEVEL_COLORS } from "@/components/charts/palette";
import { safeJsonArray } from "@/lib/utils";

/**
 * 产业链分层流向图（上游 → 中游 → 下游）
 *
 * ── 为什么弃用原来的力导向图 ──
 * 原实现用 ECharts `layout: "force"` 渲染，但它承载的数据有两个特点：
 *   1. 连线由页面按「节点数组顺序依次相连」合成，本质是一条 上游→中游→下游 的**线性流向**，
 *      并非真实的多元供需网络；
 *   2. 单条链只有 5–11 个**文字型**节点。
 * 力导向布局作用于路径型数据，必然导致节点每次渲染位置随机、来回漂移（原代码还关掉了
 * `layoutAnimation`，于是表现为突然跳变），这正是「交互不流畅」的根源；
 * 同时 5–11 个文字节点用 canvas 绘制，既无法选中文字、也不利于读屏。
 *
 * ── 现在的做法 ──
 * 按数据本身的真实结构呈现：三层泳道，节点纵向等距**固定排布**（位置确定 → 零抖动），
 * 用 HTML/CSS 而非 canvas —— 文字可选中、可被读屏读取、移动端天然可堆叠为单列。
 * 不额外制造并不存在的「供需连线」，避免误导。
 */

const LEVELS = ["上游", "中游", "下游"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_META: Record<Level, { icon: typeof Factory; hint: string }> = {
  上游: { icon: Package, hint: "原材料 · 设备 · 核心部件" },
  中游: { icon: Factory, hint: "制造 · 加工 · 集成" },
  下游: { icon: ShoppingCart, hint: "应用 · 终端 · 渠道" },
};

export interface FlowNode {
  id?: string;
  name: string;
  level?: string | null;
  description?: string | null;
  companies?: string | null;
}

/** 单个节点卡片 */
function NodeCard({ node, color }: { node: FlowNode; color: string }) {
  const [open, setOpen] = useState(false);
  const companies = useMemo(() => safeJsonArray<string>(node.companies).slice(0, 8), [node.companies]);
  const desc = (node.description ?? "").trim();
  const hasMore = !!desc || companies.length > 0;

  return (
    <div
      className="rounded-lg border bg-card transition-colors duration-150 hover:border-border-strong"
      style={{ borderColor: open ? color : undefined, borderLeftWidth: 3, borderLeftColor: color }}
    >
      <button
        type="button"
        onClick={() => hasMore && setOpen((v) => !v)}
        aria-expanded={hasMore ? open : undefined}
        className={`flex w-full items-center gap-2 px-2.5 py-2 text-left ${hasMore ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{node.name}</span>
        {hasMore && (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {open && hasMore && (
        <div className="space-y-1.5 border-t border-border/60 px-2.5 py-2">
          {desc && <p className="text-[11px] leading-relaxed text-muted">{desc}</p>}
          {companies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {companies.map((c) => (
                <span key={c} className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChainFlowView({
  nodes,
  /** 无链选择器时（详情页）可传链名用于标题 */
  title,
  className,
}: {
  nodes: FlowNode[];
  title?: string;
  className?: string;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, FlowNode[]> = { 上游: [], 中游: [], 下游: [], 其他: [] };
    for (const n of nodes) {
      const lv = (n.level ?? "") as Level;
      (g[lv] ?? g["其他"]).push(n);
    }
    return g;
  }, [nodes]);

  const cols = LEVELS.map((lv) => ({ level: lv, items: grouped[lv] }));
  const hasOther = grouped["其他"].length > 0;
  const total = nodes.length;

  return (
    <div className={className}>
      {title && <p className="mb-3 text-sm font-bold">{title}</p>}

      {/* 桌面：三列泳道；移动：单列堆叠 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cols.map(({ level, items }, idx) => {
          const color = CHAIN_LEVEL_COLORS[level] ?? "#6b7280";
          const Icon = LEVEL_META[level].icon;
          return (
            <div key={level} className="relative">
              {/* 列头 */}
              <div
                className="mb-2 flex items-center gap-2 rounded-md px-2.5 py-1.5"
                style={{ background: `${color}14` }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                <span className="text-xs font-bold" style={{ color }}>
                  {level}
                </span>
                <span className="text-[10px] text-muted">{items.length} 环节</span>
                <span className="ml-auto hidden text-[10px] text-muted/70 lg:inline">{LEVEL_META[level].hint}</span>
              </div>

              {/* 节点 */}
              <div className="space-y-1.5">
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/60 px-2.5 py-3 text-center text-[11px] text-muted/60">
                    该层暂无环节
                  </p>
                ) : (
                  items.map((n) => <NodeCard key={n.id ?? n.name} node={n} color={color} />)
                )}
              </div>

              {/* 列间流向指示（仅移动端以下不显示，桌面端放在两列之间） */}
              {idx < cols.length - 1 && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 sm:block"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" className="text-border-strong">
                    <path d="M2 7h8M7 3.5 10.5 7 7 10.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasOther && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold text-muted">未分层环节（{grouped["其他"].length}）</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {grouped["其他"].map((n) => (
              <NodeCard key={n.id ?? n.name} node={n} color="#6b7280" />
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-muted">
        共 {total} 个环节，按「上游 → 中游 → 下游」分层排布（数据来自 chain_nodes.level）。
        点击环节卡片可展开说明与相关公司。
      </p>
    </div>
  );
}
