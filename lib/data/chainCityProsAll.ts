/**
 * 产业链的代表城市与优缺点 —— 统一入口。
 *
 * 内容分两处：chainCities.ts / chainProsCons.ts（原有 25 + 第 3 批 6 条）
 * 与 chainCityProsExtra.ts（第 2 批 9 条）。调用方一律从这里取。
 *
 * 城市名的硬约束：必须与站内城市清单（lib/data/regions）完全一致，
 * 否则链接到不存在的页面。scripts/verify-chain-content.ts 会逐个核对。
 */
import { CHAIN_CITIES, type ChainCity } from "@/lib/data/chainCities";
import { EXTRA_CHAIN_CITIES } from "@/lib/data/chainCityProsExtra";
import { CHAIN_PROS_CONS, type ChainProsCons } from "@/lib/data/chainProsCons";
import { EXTRA_PROS_CONS } from "@/lib/data/chainCityProsExtra";

export type { ChainCity, ChainProsCons };

export const ALL_CHAIN_CITIES: Record<string, ChainCity[]> = {
  ...CHAIN_CITIES,
  ...EXTRA_CHAIN_CITIES,
};

export const ALL_PROS_CONS: Record<string, ChainProsCons> = {
  ...CHAIN_PROS_CONS,
  ...EXTRA_PROS_CONS,
};