/**
 * 产业链环节结构化维度的统一入口。
 *
 * 内容分两处：chainNodeDetails.ts（原有 25 条）与
 * chainNodeDetailsExtra.ts（补入库的 9 条）。调用方一律从这里取。
 */
import {
  CHAIN_NODE_DETAILS,
  type ChainNodeDetail,
} from "@/lib/data/chainNodeDetails";
import { EXTRA_CHAIN_NODE_DETAILS } from "@/lib/data/chainNodeDetailsExtra";

export type { ChainNodeDetail };

export const ALL_CHAIN_NODE_DETAILS: Record<
  string,
  Record<string, ChainNodeDetail>
> = {
  ...CHAIN_NODE_DETAILS,
  ...EXTRA_CHAIN_NODE_DETAILS,
};

/** 取某条链某环节的结构化维度；缺失返回 undefined */
export function nodeDetail(
  slug: string,
  nodeName: string
): ChainNodeDetail | undefined {
  return ALL_CHAIN_NODE_DETAILS[slug]?.[nodeName];
}