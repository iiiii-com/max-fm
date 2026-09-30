/**
 * 70 城房价快照：读盘 + 与站内城市清单匹配。
 *
 * 存在的原因（部署可复现性）：
 * 城市房价数据入库靠 scripts/import-house-price.ts 手动执行，
 * 而 data/max.db 不进版本库。新环境 / 新部署若忘了跑导入，
 * city_house_price 是空表，接口就会返回空对象，前端什么也不显示 ——
 * 看起来像"这个功能没做"，而不是"数据没导入"。
 * 所以接口在空表时回退到已提交的 data/snapshots/house-price-70.json，
 * 保证任何环境下都能读到这份官方数据。
 *
 * 本模块只被服务端使用（API route 与命令行脚本），因为要用 node:fs。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STATIC_REGIONS } from "@/lib/data/regions";

export type HousePriceRow = {
  city: string;
  newMom: number;
  newYoy: number;
  usedMom: number;
  usedYoy: number;
};

export type HousePriceSnapshot = {
  period: string;
  sourceUrl: string;
  fetchedAt: string;
  rows: HousePriceRow[];
};

export type MatchedPrices = {
  period: string;
  sourceUrl: string;
  byCity: Map<string, Omit<HousePriceRow, "city">>;
  /** 站内城市清单，但不在统计局 70 城统计范围内 */
  unmatched: string[];
};

/** 站内城市清单（去重、短名），与导入脚本口径一致 */
export function siteCities(): string[] {
  return [...new Set(STATIC_REGIONS.flatMap((r) => r.cities.map((c) => c.name)))];
}

export function loadHousePriceSnapshot(): HousePriceSnapshot | null {
  try {
    const p = join(process.cwd(), "data", "snapshots", "house-price-70.json");
    return JSON.parse(readFileSync(p, "utf8")) as HousePriceSnapshot;
  } catch {
    return null;
  }
}

/**
 * 快照 → 站内城市。
 *
 * 匹配规则保守到只有一条：标准名完全相等。
 * 不做模糊匹配 —— 错配会把另一个城市的价格指数按到本城上，
 * 数字精确、量级合理，读者无从怀疑，比留空危险得多。
 * 匹配不上的城市由前端显式说明「不在 70 城统计范围」。
 */
export function matchSnapshot(snap: HousePriceSnapshot): MatchedPrices {
  const mine = siteCities();
  const byCity = new Map<string, Omit<HousePriceRow, "city">>();
  const unmatched: string[] = [];
  for (const c of mine) {
    const hit = snap.rows.find((r) => r.city === c);
    if (!hit) {
      unmatched.push(c);
      continue;
    }
    byCity.set(c, {
      newMom: hit.newMom,
      newYoy: hit.newYoy,
      usedMom: hit.usedMom,
      usedYoy: hit.usedYoy,
    });
  }
  return { period: snap.period, sourceUrl: snap.sourceUrl, byCity, unmatched };
}

/** 只读快照（不落库），供接口回退与校验脚本使用 */
export function pricesFromSnapshot(): MatchedPrices | null {
  const snap = loadHousePriceSnapshot();
  return snap ? matchSnapshot(snap) : null;
}
