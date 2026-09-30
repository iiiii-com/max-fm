/**
 * 产业链 ↔ 个股 ↔ 板块 的关联索引。
 *
 * 背景（B11「整合各板块，加强数据互通」）：
 * 站内 25 条产业链、161 个环节、375 家公司名、31 省经济数据、成千上万只个股，
 * 彼此之间**没有任何关联表**。industry_chains.code 字段全为 NULL ——
 * schema 预留了与东财板块 BK code 的映射位，但从未填过。
 * 实际后果：
 *   - 打开某条产业链，看不到它当下在板块资金流里的表现（需自己知道该看哪个板块）
 *   - 打开某只个股的详情页，看不到它属于哪条产业链、在链上的哪个环节
 *   - 打开某个板块，看不到它对应哪些产业链
 *
 * 本模块用**已有数据**建立索引，不引入任何新标识：
 *   产业链 → 环节 → companies（DB 中已存的 375 个公司名）
 * 个股侧：链上环节公司名 → 站内个股行情（个股代码来自行情接口，不硬编码）
 * 板块侧：chain_slug → 东财 BK code 的映射**留空待补**，
 *   因为 BK code 无法在无网络时可靠确定；宁可留空也不要写一个猜的 code ——
 *   猜错的 code 会让「板块资金流」显示成另一个板块的数据，比没有更危险。
 *   补齐方式见 scripts/fix-chain-sector-codes.ts。
 */

import { LEVELS, realNodes } from "./chainLevels";

/** 环节层级，用于在个股详情页说明「该股在链上的位置」 */
export interface ChainNodeRef {
  chainSlug: string;
  chainName: string;
  nodeId: string;
  nodeName: string;
  level: string;
}

export interface StockChainRef extends ChainNodeRef {
  /** 该环节列出的全部公司（便于在个股页展示同环节其他标的） */
  peers: string[];
}

export interface ChainIndexRow {
  chainSlug: string;
  chainName: string;
  nodeId: string;
  nodeName: string;
  level: string;
  companies: string[];
}

function safeParse(v: unknown): string[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(String(v));
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  } catch {
    return [];
  }
}

export interface ChainSourceNode {
  id: string;
  name: string;
  level: string;
  companies: string | null;
}

/**
 * 把按 chainId 分组的节点摊平成索引行。
 * 调用方负责传入 chainSlug（DB 里 chain_nodes.chain_id 与 industry_chains.id 对应，
 * 而 slug 是另一个字段，两者不能混用）。
 */
export function buildChainIndex(
  chains: Array<{ slug: string; name: string }>,
  nodesByChain: Map<string, ChainSourceNode[]>
): ChainIndexRow[] {
  const nameBySlug = new Map(chains.map((c) => [c.slug, c.name]));
  const out: ChainIndexRow[] = [];
  for (const [chainSlug, nodes] of nodesByChain) {
    for (const n of nodes) {
      const companies = safeParse(n.companies);
      if (!companies.length) continue;
      out.push({
        chainSlug,
        chainName: nameBySlug.get(chainSlug) ?? chainSlug,
        nodeId: n.id,
        nodeName: n.name,
        level: n.level,
        companies,
      });
    }
  }
  return out;
}

/**
 * 公司名 → 它所在的全部环节。
 * 一家公司常同时出现在多条链（如"中际旭创"同时属于 CPO 光模块、AI、通信设备），
 * 因此返回数组而不是单值 —— 这正是跨链分析需要的输入。
 */
export function indexByCompany(rows: ChainIndexRow[]): Map<string, StockChainRef[]> {
  const m = new Map<string, StockChainRef[]>();
  for (const r of rows) {
    for (const c of r.companies) {
      const list = m.get(c) ?? [];
      list.push({
        chainSlug: r.chainSlug,
        chainName: r.chainName,
        nodeId: r.nodeId,
        nodeName: r.nodeName,
        level: r.level,
        peers: r.companies,
      });
      m.set(c, list);
    }
  }
  return m;
}

/** 环节 id → 环节（用于按 nodeId 直查） */
export function indexByNode(rows: ChainIndexRow[]): Map<string, ChainIndexRow> {
  return new Map(rows.map((r) => [r.nodeId, r]));
}

/**
 * 链上「公司名 → 环节」的一维索引，供产业链详情页快速渲染。
 * key 用公司名，value 是该公司在本链中的环节名。
 */
export function companiesOfChain(rows: ChainIndexRow[], chainSlug: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) {
    if (r.chainSlug !== chainSlug) continue;
    for (const c of r.companies) {
      const list = m.get(c) ?? [];
      list.push(r.nodeName);
      m.set(c, list);
    }
  }
  return m;
}

/**
 * 已建立的板块映射（chain_slug → 东财 BK code）。
 * 当前为空：BK code 无法离线可靠确定。
 * 补齐前，产业解读页不展示「该链板块资金流」入口，而不是跳到一个错误板块。
 */
export const CHAIN_SECTOR_CODES: Record<string, string> = {};

/** 该链是否已有可靠的板块映射（未补齐则不展示资金流入口） */
export function hasSectorCode(chainSlug: string): boolean {
  return Boolean(CHAIN_SECTOR_CODES[chainSlug]);
}

export { LEVELS, realNodes };
