/**
 * 产业链深度解读的统一入口（利润地图、趋势、职业岗位）。
 *
 * 内容分三处：chainEconomics.ts / chainCareers.ts 原有 25 条，
 * chainEconomicsExtra.ts / chainCareersExtra.ts 补入库的第 2 批 9 条，
 * chainBatch3.ts 补入库的第 3 批 6 条。
 */
import { CHAIN_ECONOMICS } from "@/lib/data/chainEconomics";
import { EXTRA_CHAIN_ECONOMICS } from "@/lib/data/chainEconomicsExtra";
import { CHAIN_CAREERS } from "@/lib/data/chainCareers";
import { EXTRA_CHAIN_CAREERS } from "@/lib/data/chainCareersExtra";
import {
  BATCH3_CHAIN_ECONOMICS,
  BATCH3_CHAIN_CAREERS,
} from "@/lib/data/chainBatch3";
import type { ChainEconomics } from "@/lib/data/chainEconomics";
import type { ChainCareer } from "@/lib/data/chainCareers";

export type { ChainEconomics, ChainCareer };

export const ALL_CHAIN_ECONOMICS: Record<string, ChainEconomics> = {
  ...CHAIN_ECONOMICS,
  ...EXTRA_CHAIN_ECONOMICS,
  ...BATCH3_CHAIN_ECONOMICS,
};

export const ALL_CHAIN_CAREERS: Record<string, ChainCareer> = {
  ...CHAIN_CAREERS,
  ...EXTRA_CHAIN_CAREERS,
  ...BATCH3_CHAIN_CAREERS,
};