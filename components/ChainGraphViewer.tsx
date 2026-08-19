"use client";

import { useMemo, useState } from "react";
import ChainGraph from "./charts/ChainGraph";

export default function ChainGraphViewer({
  chains,
  nodes,
  links,
}: {
  chains: Array<{ id: string; name: string }>;
  nodes: Array<{ id: string; chainId: string | null; name: string }>;
  links: Array<{ source: string; target: string }>;
}) {
  const [focus, setFocus] = useState<string>("all");

  const filtered = useMemo(() => {
    if (focus === "all") return { nodes, links };
    const chainId = focus;
    const names = new Set(nodes.filter((n) => n.chainId === chainId).map((n) => n.name));
    return {
      nodes: nodes.filter((n) => names.has(n.name)),
      links: links.filter((l) => names.has(l.source) && names.has(l.target)),
    };
  }, [focus, nodes, links]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
        <span className="text-xs text-muted">聚焦产业链：</span>
        <select
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          className="px-2.5 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-primary/60"
        >
          <option value="all">全部（{chains.length} 条链）</option>
          {chains.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted">
          {focus === "all"
            ? `共 ${filtered.nodes.length} 个环节 · ${filtered.links.length} 条上下游关系`
            : `${chains.find((c) => c.id === focus)?.name ?? ""}：${filtered.nodes.length} 个环节`}
        </span>
      </div>
      <ChainGraph nodes={filtered.nodes as any} links={filtered.links} />
    </div>
  );
}