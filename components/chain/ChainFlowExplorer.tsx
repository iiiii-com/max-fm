"use client";

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import ChainFlowArcs, { type FlowNode } from "./ChainFlowArcs";

/**
 * 产业链浏览器：链选择（横向 chip）+ 分层流向图
 *
 * 替换原先「<select> 下拉 + 力导向图」的组合：
 *   - 下拉需两次操作才能切换，chip 一次即可，且当前选中一目了然、可横向扫视；
 *   - 力导向图位置随机漂移，改为弧形流线图后位置固定（详见 ChainFlowArcs 注释）。
 */
export default function ChainFlowExplorer({
  chains,
  nodes,
}: {
  chains: Array<{ id: string; name: string }>;
  nodes: Array<{ id: string; chainId: string | null; name: string; level?: string | null; description?: string | null; companies?: string | null }>;
}) {
  // 默认选中节点最多的一条链：它是内容最丰富、最能说明「产业链长什么样」的样本，
  // 而不是原实现里的「数组第一条」（对用户是随机的）
  const defaultId = useMemo(() => {
    let best = chains[0]?.id ?? "";
    let bestCount = -1;
    for (const c of chains) {
      const n = nodes.filter((x) => x.chainId === c.id).length;
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
    for (const n of nodes) if (n.chainId) m[n.chainId] = (m[n.chainId] ?? 0) + 1;
    return m;
  }, [nodes]);

  const current = chains.find((c) => c.id === active);
  const currentNodes: FlowNode[] = useMemo(
    () => nodes.filter((n) => n.chainId === active),
    [nodes, active]
  );

  return (
    <div className="space-y-3">
      {/* 链选择：横向可滚动 chip */}
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
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
                className={`shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs transition-colors duration-150 ${
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
        <ChainFlowArcs nodes={currentNodes} title={current.name} />
      ) : (
        <p className="py-8 text-center text-sm text-muted">请选择一条产业链</p>
      )}
    </div>
  );
}
