"use client";

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import ChainSwimlane from "./ChainSwimlane";
import { LEVELS, levelOrder, isRealLevel } from "@/lib/data/chainLevels";
import type { ValidMetric } from "@/lib/data/chainMetrics";

/**
 * 产业链浏览器：链选择（横向 chip）+ 分层泳道
 *
 * 替换原先「<select> 下拉 + 力导向图 / 弧形布线图」的组合：
 *   - 下拉需两次操作才能切换，chip 一次即可；
 *   - 力导向图位置随机漂移；
 *   - 弧形布线图画了 9 条无数据支撑的连线，会断言不存在的供给关系（见 ChainSwimlane 注释）。
 *
 * chip 上的角标是**真实环节数**，不再是节点行数 —— 后者包含跨链关联，
 * 会让这里显示 9 而详情页显示 6。
 */
export default function ChainFlowExplorer({
  chains,
  nodes,
  metrics = [],
}: {
  chains: Array<{ id: string; name: string; slug?: string | null }>;
  nodes: Array<{ id: string; chainId: string | null; name: string; level?: string | null; description?: string | null; companies?: string | null }>;
  metrics?: ValidMetric[];
}) {
  // 默认选中节点最多的一条链：它是内容最丰富、最能说明「产业链长什么样」的样本，
  // 而不是原实现里的「数组第一条」（对用户是随机的）
  const defaultId = useMemo(() => {
    let best = chains[0]?.id ?? "";
    let bestCount = -1;
    for (const c of chains) {
      const n = nodes.filter((x) => x.chainId === c.id && isRealLevel(x.level)).length;
      if (n > bestCount) {
        bestCount = n;
        best = c.id;
      }
    }
    return best;
  }, [chains, nodes]);

  const [active, setActive] = useState<string>(defaultId);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of nodes) {
      if (!n.chainId || !isRealLevel(n.level)) continue;
      m[n.chainId] = (m[n.chainId] ?? 0) + 1;
    }
    return m;
  }, [nodes]);

  const current = chains.find((c) => c.id === active);
  const currentNodes = useMemo(
    () => nodes.filter((n) => n.chainId === active && isRealLevel(n.level)),
    [nodes, active]
  );
  const bands = useMemo(
    () =>
      LEVELS.map((role) => ({
        role,
        nodes: [...currentNodes]
          .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
          .filter((n) => n.level === role),
      })),
    [currentNodes]
  );

  return (
    <div className="space-y-3">
      {/* 链选择：横向可滚动 chip */}
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] tracking-widest text-muted">
          <Layers className="h-3.5 w-3.5" />
          产业链
        </span>
        <div
          className="flex flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="产业链选择"
        >
          {chains.map((c) => {
            const on = c.id === active;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(c.id)}
                className={`shrink-0 whitespace-nowrap border px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
                  on
                    ? "border-primary bg-primary-soft font-medium text-primary"
                    : "border-border text-muted hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {c.name.replace(/产业链$/, "")}
                <span className="ml-1 text-[10px] opacity-70">{counts[c.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {current ? (
        <ChainSwimlane
          bands={bands}
          metrics={current?.slug ? metrics.filter((m) => m.slug === current.slug) : []}
        />
      ) : (
        <p className="py-8 text-center text-sm text-muted">请选择一条产业链</p>
      )}
    </div>
  );
}
