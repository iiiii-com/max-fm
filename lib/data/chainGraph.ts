/**
 * 跨链关系图谱的纯计算层。
 *
 * 数据来源是 lib/data/chains.ts 里每条链的 `relates` 字段（有向）。
 * 现状是：38 条链、161 条有向边，但力导向图只画 23 个节点，
 * 而且在去重时**把方向丢掉了** —— 79 条非对称边（A 指向 B 而 B 不指向 A）
 * 所表达的"谁依赖谁"就此消失。力导向超过 30 节点也会挤成毛线团。
 *
 * 所以这一层提供两件力导向做不到的事：
 *   1) 关系矩阵：38×38 一次看全，保留方向（双向 / 单向 / 无）
 *   2) 度数统计：谁是枢纽、谁只有单向依赖
 * 全部是纯函数，不依赖 DB 与网络，可直接跑断言。
 */

import type { StaticChain } from "./chains";

export type RelKind = "mutual" | "oneway" | "none";

export interface GraphNode {
  id: string;
  name: string;
  /** 无向度数（去重后与它相连的链数） */
  degree: number;
  /** 出度：它指向别人的条数 */
  out: number;
  /** 入度：别人指向它的条数 */
  in: number;
}

export interface ChainGraph {
  nodes: GraphNode[];
  /** 去重后的无向边数 */
  undirectedCount: number;
  /** 原始有向边数（含重复方向） */
  directedCount: number;
  /** 双向对数：A→B 且 B→A */
  mutualCount: number;
  /** 单向对数：只有一边指向另一边 */
  onewayCount: number;
  /** 引用了不存在链 id 的坏边（数据错误，必须暴露而不是静默丢弃） */
  danglingRefs: string[];
}

export function buildChainGraph(chains: StaticChain[]): ChainGraph {
  const ids = new Set(chains.map((c) => c.id));
  const out = new Map<string, Set<string>>();
  for (const c of chains) out.set(c.id, new Set((c.relates ?? []).filter((r) => ids.has(r))));

  const danglingRefs: string[] = [];
  for (const c of chains) {
    for (const r of c.relates ?? []) {
      if (!ids.has(r)) danglingRefs.push(`${c.id} → ${r}`);
    }
  }

  const nodes: GraphNode[] = chains.map((c) => {
    const o = out.get(c.id)!;
    const inn = chains.filter((x) => out.get(x.id)!.has(c.id)).map((x) => x.id);
    // 无向邻居 = 出边 ∪ 入边（去掉自环）
    const neighbors = new Set([...o, ...inn].filter((x) => x !== c.id));
    return { id: c.id, name: c.name, degree: neighbors.size, out: o.size, in: inn.length };
  });

  let directedCount = 0;
  for (const c of chains) directedCount += out.get(c.id)!.size;

  /**
   * 双向 / 单向必须**按无向边逐条判定**。
   * 之前的写法是遍历有向边、只在 `c.id < r` 时计数，于是源 id 排序在后的
   * 单向边被整条漏掉（75 vs 真实 119）—— 这类错不会报错，只会让统计偏小。
   */
  const pairKeys = new Set<string>();
  for (const c of chains) for (const r of out.get(c.id)!) pairKeys.add([c.id, r].sort().join("|"));

  let mutualCount = 0;
  let onewayCount = 0;
  for (const key of pairKeys) {
    const [a, b] = key.split("|");
    if (out.get(a)!.has(b) && out.get(b)!.has(a)) mutualCount++;
    else onewayCount++;
  }

  return {
    nodes,
    undirectedCount: pairKeys.size,
    directedCount,
    mutualCount,
    onewayCount,
    danglingRefs,
  };
}

/**
 * 关系矩阵（N×N）。取值语义：
 *   2 = 双向（A→B 且 B→A），1 = A 单向指向 B，0 = 无关系，对角线 = -1（自身，渲染时空出）
 * 保留方向是本矩阵相对力导向图的核心增量。
 */
export function relationMatrix(chains: StaticChain[]): { ids: string[]; matrix: number[][] } {
  const ids = chains.map((c) => c.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const set = new Map(chains.map((c) => [c.id, new Set((c.relates ?? []).filter((r) => idx.has(r)))]));
  const n = ids.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = -1;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const ab = set.get(ids[i])!.has(ids[j]);
      const ba = set.get(ids[j])!.has(ids[i]);
      matrix[i][j] = ab && ba ? 2 : ab ? 1 : 0;
    }
  }
  return { ids, matrix };
}

/** 枢纽榜：按无向度数降序 */
export function hubs(graph: ChainGraph, limit = 8): GraphNode[] {
  return [...graph.nodes].sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id)).slice(0, limit);
}

/**
 * 单向依赖：A→B 但 B 不→A，即"这条链把对方当作上游/下游，对方没有反向标注"。
 * 注意口径 —— 这是**标注不对称**，不等于产业上真的单向：
 * 可能只是另一条链的 relates 没写全。所以 UI 上要说明这是"标注差异"，
 * 不能直接断言成"B 不依赖 A"。
 */
export function onewayPairs(chains: StaticChain[], limit = 10): Array<{ from: string; to: string }> {
  const ids = new Set(chains.map((c) => c.id));
  const set = new Map(chains.map((c) => [c.id, new Set((c.relates ?? []).filter((r) => ids.has(r)))]));
  const pairs: Array<{ from: string; to: string }> = [];
  for (const c of chains) {
    for (const r of set.get(c.id)!) {
      if (!set.get(r)!.has(c.id)) pairs.push({ from: c.id, to: r });
    }
  }
  return pairs.slice(0, limit);
}

/** 双向强关联：互相标注的链对 */
export function mutualPairs(chains: StaticChain[]): Array<{ a: string; b: string }> {
  const ids = new Set(chains.map((c) => c.id));
  const set = new Map(chains.map((c) => [c.id, new Set((c.relates ?? []).filter((r) => ids.has(r)))]));
  const out: Array<{ a: string; b: string }> = [];
  for (const c of chains) {
    for (const r of set.get(c.id)!) {
      if (c.id < r && set.get(r)!.has(c.id)) out.push({ a: c.id, b: r });
    }
  }
  return out;
}