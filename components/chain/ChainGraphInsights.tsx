import Link from "next/link";
import { Card } from "@/components/ui";
import { STATIC_CHAINS, getStaticChain } from "@/lib/data/chains";
import { buildChainGraph, hubs, onewayPairs, mutualPairs } from "@/lib/data/chainGraph";

/**
 * 跨链关系的**结论层**：力导向图能画关系，但回答不了"谁是枢纽"、
 * "哪些链只被单方标注"。这两问都要先算度数，再排序。
 *
 * 口径纪律：
 *  - 「枢纽」= 无向度数（去重后相连的链数），不是"重要性" —— 度数高只说明
 *    这条链在站内图谱里被标注得最多，不代表产业上最核心。文案必须写清楚。
 *  - 「单向关联」= 标注不对称，不等于产业上真的单向。很可能是另一条链的
 *    relates 没写全。因此定性为"标注差异"，不下"B 不依赖 A"的断言。
 */
export default function ChainGraphInsights() {
  const graph = buildChainGraph(STATIC_CHAINS);
  const top = hubs(graph, 8);
  const oneway = onewayPairs(STATIC_CHAINS, 10);
  const mutual = mutualPairs(STATIC_CHAINS);
  const name = (id: string) => getStaticChain(id)?.name ?? id;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <Card className="p-4">
        <h3 className="font-bold text-sm mb-1">枢纽链（按关联数）</h3>
        <p className="text-[11px] text-muted leading-relaxed mb-3">
          与最多条链存在标注关系的链。<b className="text-foreground">关联数只说明站内图谱标注的密度，
          不代表产业地位</b> —— 标注少可能是整理不足，不一定是联系少。
        </p>
        <ol className="space-y-1.5">
          {top.map((n, i) => (
            <li key={n.id} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-muted tabular-nums text-[10px]">{i + 1}</span>
              <Link href={`/industry/${n.id}`} className="flex-1 truncate hover:text-primary">
                {n.name}
              </Link>
              <span className="font-mono text-[10px] text-muted tabular-nums" title={`出 ${n.out} / 入 ${n.in}`}>
                {n.degree}
              </span>
              <span className="w-24 h-1 rounded-full bg-border overflow-hidden shrink-0" aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(n.degree / top[0].degree) * 100}%`, background: "var(--primary)", opacity: 0.55 }}
                />
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-sm mb-1">单向关联（标注不对称）</h3>
        <p className="text-[11px] text-muted leading-relaxed mb-3">
          A 标注了 B，但 B 没有反向标注。这是<b className="text-foreground">图谱整理的不对称</b>，
          不等于产业上真的单向依赖 —— 更可能是另一条链的关联没写全。
        </p>
        <ul className="space-y-1.5">
          {oneway.map((p) => (
            <li key={`${p.from}-${p.to}`} className="flex items-center gap-1.5 text-xs">
              <Link href={`/industry/${p.from}`} className="truncate hover:text-primary max-w-[45%]">
                {name(p.from)}
              </Link>
              <span className="text-muted shrink-0" aria-label="指向">→</span>
              <Link href={`/industry/${p.to}`} className="truncate hover:text-primary max-w-[45%]">
                {name(p.to)}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-muted mt-3 border-t border-border/60 pt-2">
          全站共 {graph.onewayCount} 条单向关联、{graph.mutualCount} 对双向关联
          （{graph.directedCount} 条有向标注 / 去重后 {graph.undirectedCount} 条无向边）
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-sm mb-1">双向强关联</h3>
        <p className="text-[11px] text-muted leading-relaxed mb-3">
          双方都标注了对方，是图谱里最确定的跨链联系（{mutual.length} 对）。
        </p>
        <ul className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {mutual.map((p) => (
            <li key={`${p.a}-${p.b}`} className="flex items-center gap-1.5 text-xs">
              <Link href={`/industry/${p.a}`} className="truncate hover:text-primary max-w-[45%]">
                {name(p.a)}
              </Link>
              <span className="text-muted shrink-0" aria-hidden>⇄</span>
              <Link href={`/industry/${p.b}`} className="truncate hover:text-primary max-w-[45%]">
                {name(p.b)}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}