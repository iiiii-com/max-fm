/**
 * 产业链链级解读的统一入口。
 *
 * 内容分两处：chainInsights.ts（25 条）+ chainInsightsExtra.ts（9 条补入库的）。
 * 调用方一律从这里取，不必关心拆分。
 */
import { CHAIN_INSIGHTS, hasInsight } from "@/lib/data/chainInsights";
import { EXTRA_CHAIN_INSIGHTS } from "@/lib/data/chainInsightsExtra";
import type { ChainInsight } from "@/lib/data/chainInsights";

export type { ChainInsight };

export const ALL_CHAIN_INSIGHTS: Record<string, ChainInsight> = {
  ...CHAIN_INSIGHTS,
  ...EXTRA_CHAIN_INSIGHTS,
};

/** 判断某链是否已有链级解读 */
export function hasChainInsight(slug: string): boolean {
  return Boolean(ALL_CHAIN_INSIGHTS[slug]?.economics) || hasInsight(slug);
}

/** 取某链的链级解读，没有则返回 undefined */
export function getChainInsight(slug: string): ChainInsight | undefined {
  return ALL_CHAIN_INSIGHTS[slug] ?? CHAIN_INSIGHTS[slug];
}