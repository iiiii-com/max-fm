/**
 * 产业链层级 —— 全站唯一事实来源。
 *
 * 此前「上游 / 中游 / 下游」在四处各写一遍（ChainSchematic、ChainFlow、
 * industry/[id]/page 的 ROLE_ORDER 与 groups），任何一处改动都会和其他处漂移。
 * 更严重的是 `关联：XXX` 节点曾被写成 `level:"下游"`，
 * 于是概览卡（已过滤）显示 6 个环节、头部（未过滤）显示 9 个，同屏自相矛盾。
 *
 * 约定：
 *  - LEVELS 是「环节层级」，只包含真正的产业链环节；
 *  - LINK_LEVEL 是「跨链关联」，语义上不是环节，绝不参与层级统计与排序；
 *  - 消费方一律用 isRealLevel() 判断，不要用 `!name.startsWith("关联：")`
 *    这种字符串前缀判断（换一种命名就失效）。
 */

/** 真正的产业链环节层级，按阅读顺序 */
export const LEVELS = ["上游", "中游", "下游"] as const;
export type ChainLevel = (typeof LEVELS)[number];

/** 跨链关联的伪层级标记。它不是环节，不进层级统计 */
export const LINK_LEVEL = "关联";

/** 全部出现过的 level 值（含伪层级） */
export const ALL_LEVELS = [...LEVELS, LINK_LEVEL] as const;

export function isRealLevel(v: unknown): v is ChainLevel {
  return typeof v === "string" && (LEVELS as readonly string[]).includes(v);
}

/** 把任意 level 值排序；伪层级永远排在最后 */
export function levelOrder(v: unknown): number {
  const i = (LEVELS as readonly string[]).indexOf(String(v));
  return i === -1 ? LEVELS.length : i;
}

/** 从节点列表里筛出真正的环节（排除跨链关联） */
export function realNodes<T extends { name?: string | null; level?: string | null }>(nodes: T[]): T[] {
  return nodes.filter((n) => !isLinkNode(n));
}

/** 是否为「关联：XXX」这类伪节点 —— 仅用于展示时的兜底，统计请用 realNodes() */
export function isLinkNode(n: { name?: string | null; level?: string | null }): boolean {
  return !isRealLevel(n.level) || String(n.name ?? "").startsWith("关联：");
}
