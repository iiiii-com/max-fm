/**
 * 统一入口：第三批补入库的 6 条链（synbio / gpu-cloud / innov-device /
 * pet-food / satellite-internet / sodium-battery）并入各内容表。
 *
 * 调用方（ChainInsightPanel / ChainDeepDivePanel / ChainNodeDetailPanel）
 * 一律从这里取，不必知道内容分几批写。
 */
import { CHAIN_INSIGHTS } from "@/lib/data/chainInsights";
import { EXTRA_CHAIN_INSIGHTS } from "@/lib/data/chainInsightsExtra";
import { BATCH3_CHAIN_INSIGHTS } from "@/lib/data/chainBatch3";
import type { ChainInsight } from "@/lib/data/chainInsights";

export type { ChainInsight };

export const ALL_CHAIN_INSIGHTS: Record<string, ChainInsight> = {
  ...CHAIN_INSIGHTS,
  ...EXTRA_CHAIN_INSIGHTS,
  ...BATCH3_CHAIN_INSIGHTS,
};

export function hasChainInsight(slug: string): boolean {
  return Boolean(ALL_CHAIN_INSIGHTS[slug]?.economics);
}

export function getChainInsight(slug: string): ChainInsight | undefined {
  return ALL_CHAIN_INSIGHTS[slug];
}