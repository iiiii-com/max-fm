/**
 * 省级经济区域划分与集中度分析。
 *
 * 区域划分采用国家统计局「四大地区」标准口径（东部 10 / 中部 6 / 西部 12 / 东北 3），
 * 合计 31 个省级行政区，覆盖完整、无重复。
 *
 * ⚠ 已移除外贸依存度与财政自给率两个派生指标。
 * 这两个指标依赖 province_stats.trade 与 .fiscalRevenue，而这两个字段此前是
 * seed.ts 用 rng() 生成的**纯随机数**（trade = gdp × (0.25 + rng()×0.4)），
 * 已在 scripts/fix-province-fake-data.ts 中置空。
 * 基于随机数算出的"外贸依存度"排名与真实情况完全相反（广东垫底、甘肃第二），
 * 比没有这个指标危险得多 —— 数字精确、量级合理，读者无从怀疑。
 * 在有可核验的逐年公开数据之前不重建这两个指标。
 *
 * 保留的派生指标只有「占 31 省合计」：分子分母同为 31 省口径，比例有效。
 * 刻意不提供「占全国 X 成」—— 分母（全国 GDP）站内没有，用 31 省加总代替是错的。
 */

export type RegionKey = "east" | "central" | "west" | "northeast";

export const REGIONS: Record<RegionKey, { label: string; short: string; provinces: string[] }> = {
  east: {
    label: "东部地区",
    short: "东部",
    provinces: ["北京", "天津", "河北", "上海", "江苏", "浙江", "福建", "山东", "广东", "海南"],
  },
  central: {
    label: "中部地区",
    short: "中部",
    provinces: ["山西", "安徽", "江西", "河南", "湖北", "湖南"],
  },
  west: {
    label: "西部地区",
    short: "西部",
    provinces: [
      "内蒙古", "广西", "重庆", "四川", "贵州", "云南",
      "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
    ],
  },
  northeast: {
    label: "东北地区",
    short: "东北",
    provinces: ["辽宁", "吉林", "黑龙江"],
  },
};

export const REGION_ORDER: RegionKey[] = ["east", "central", "west", "northeast"];

/** 省名（短名，如"广东"）→ 所属区域 */
const PROVINCE_TO_REGION: Record<string, RegionKey> = (() => {
  const m: Record<string, RegionKey> = {};
  for (const k of REGION_ORDER) for (const p of REGIONS[k].provinces) m[p] = k;
  return m;
})();

/** "内蒙古自治区" / "广西壮族自治区" → "内蒙古" / "广西" */
export function shortProvinceName(full: string): string {
  return full.replace(/(省|市|自治区|壮族|回族|维吾尔|特别行政区)/g, "");
}

export function regionOf(province: string): RegionKey | null {
  return PROVINCE_TO_REGION[shortProvinceName(province)] ?? null;
}

/** 结构自检：四个区域必须恰好覆盖 31 省且无重复 */
export function regionCoverage(): { total: number; unique: number; ok: boolean } {
  const all = REGION_ORDER.flatMap((k) => REGIONS[k].provinces);
  return { total: all.length, unique: new Set(all).size, ok: all.length === 31 && new Set(all).size === 31 };
}

export interface ProvinceEconomyRow {
  /** 短名，如"广东"（regionOf 会自动归一化，也接受全名） */
  name: string;
  gdp: number;
  growth: number;
  perCapitaGdp: number;
  population: number;
}

export interface RegionAggregate {
  key: RegionKey;
  label: string;
  short: string;
  count: number;
  gdp: number;
  population: number;
  /** 区域内人均 GDP（万元/人）。gdp 单位万亿 ÷ population 单位亿 = 万元/人，无需再乘 */
  perCapitaGdp: number;
  /** 区域 GDP 简单算术均值增速（非加权） */
  avgGrowth: number;
  /** 占 31 省 GDP 合计的比重（%）—— 分母与分子同源，非全国 GDP */
  gdpShare: number | null;
}

/**
 * 区域汇总。
 * 两个口径差异已在页面上明确标注：
 *  - avgGrowth 是**算术均值**（与概览卡口径一致），不是 GDP 加权增速。
 *    加权增速需上年各省 GDP 作权重，口径不同，不在此混用。
 *  - perCapitaGdp 用「区域 GDP ÷ 区域人口」重算，与各省人均 GDP 的算术平均
 *    不相等（后者会被小人口省份拉高）。这里用重算值，区域口径更自洽。
 *    单位：gdp(万亿) / population(亿) = 万亿元 / 亿人 = 1e4 元/人 = 万元/人。
 */
export function aggregateRegions(rows: ProvinceEconomyRow[]): RegionAggregate[] {
  const total = rows.reduce((a, r) => a + (r.gdp || 0), 0);
  const r1 = (v: number) => Math.round(v * 10) / 10;

  return REGION_ORDER.map((key) => {
    const meta = REGIONS[key];
    const members = rows.filter((r) => regionOf(r.name) === key);
    const sum = (f: (r: ProvinceEconomyRow) => number) =>
      members.reduce((a, r) => a + (f(r) || 0), 0);

    const gdp = sum((r) => r.gdp);
    const population = sum((r) => r.population);

    return {
      key,
      label: meta.label,
      short: meta.short,
      count: members.length,
      gdp: r1(gdp),
      population: r1(population),
      perCapitaGdp: population > 0 ? r1(gdp / population) : 0,
      avgGrowth: members.length ? r1(sum((r) => r.growth) / members.length) : 0,
      gdpShare: total > 0 ? r1((gdp / total) * 100) : null,
    };
  });
}

export interface ConcentrationResult {
  /** 31 省 GDP 合计（万亿） */
  total: number;
  /** 各省按 GDP 降序 */
  ranked: ProvinceEconomyRow[];
  /** 前 N 名占 31 省合计的比重（%） */
  top5Share: number;
  top3Share: number;
  top10Share: number;
  /** 前 5 名省份短名 */
  top5Names: string[];
}

/**
 * 集中度分析。
 * 这里的比例是「前 N 省合计 / 31 省合计」—— 分子分母**同为 31 省口径**，
 * 因此比例有效，不需要全国 GDP。与"占全国 X 成"是两回事，页面文案已区分。
 */
export function concentration(rows: ProvinceEconomyRow[]): ConcentrationResult | null {
  const total = rows.reduce((a, r) => a + (r.gdp || 0), 0);
  if (total <= 0) return null;
  const ranked = [...rows].sort((a, b) => (b.gdp || 0) - (a.gdp || 0));
  const share = (n: number) => Math.round((ranked.slice(0, n).reduce((a, r) => a + (r.gdp || 0), 0) / total) * 1000) / 10;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    total: r1(total),
    ranked,
    top5Share: share(5),
    top3Share: share(3),
    top10Share: share(10),
    top5Names: ranked.slice(0, 5).map((r) => r.name),
  };
}

export interface DivergencePair {
  label: string;
  unit: string;
  desc: string;
  high: { name: string; value: number };
  low: { name: string; value: number };
}

/**
 * 两极分化对比：同一指标下最高与最低的省份。
 * 这是"分布"最直接的读法 —— 地图看的是空间，两极看的是强度。
 */
export function divergence(rows: ProvinceEconomyRow[]): DivergencePair[] {
  const pick = (
    label: string,
    unit: string,
    desc: string,
    get: (r: ProvinceEconomyRow) => number | null
  ): DivergencePair | null => {
    const valid = rows.map((r) => ({ name: r.name, v: get(r) })).filter(
      (x): x is { name: string; v: number } => x.v !== null && Number.isFinite(x.v)
    );
    if (valid.length < 2) return null;
    const sorted = [...valid].sort((a, b) => b.v - a.v);
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return {
      label,
      unit,
      desc,
      high: { name: sorted[0].name, value: r2(sorted[0].v) },
      low: { name: sorted[sorted.length - 1].name, value: r2(sorted[sorted.length - 1].v) },
    };
  };

  // 只用 gdp / perCapitaGdp / growth / population —— 全部来自手写基值或由基值推出。
  // 增速排名差异有限（各省增速集中在个位数），故只列前三项以免稀释信息量。
  return [
    pick("人均 GDP", "万元/人", "经济发展水平的核心差异指标", (r) => r.perCapitaGdp),
    pick("GDP 总量", "万亿", "经济体量的绝对差异", (r) => r.gdp),
    pick("人口", "亿", "人均指标的分母，也是公共服务压力的来源", (r) => r.population),
  ].filter((x): x is DivergencePair => x !== null);
}

/**
 * 规模-增速错配。
 * 高增速 + 小体量 = 追赶型；低增速 + 大体量 = 拖累型。
 * 这两组省份决定了全国经济的中期走势，比单看增速榜更有决策价值。
 */
export function mismatchGroups(rows: ProvinceEconomyRow[]): {
  chasers: ProvinceEconomyRow[];
  draggers: ProvinceEconomyRow[];
  medianGdp: number;
} {
  const sorted = [...rows].sort((a, b) => (b.gdp || 0) - (a.gdp || 0));
  const medianGdp = sorted[Math.floor(sorted.length / 2)]?.gdp ?? 0;
  const big = sorted.filter((r) => (r.gdp || 0) >= medianGdp);
  const small = sorted.filter((r) => (r.gdp || 0) < medianGdp);

  const byGrowth = (a: ProvinceEconomyRow, b: ProvinceEconomyRow) => (b.growth || 0) - (a.growth || 0);
  return {
    chasers: small.sort(byGrowth).slice(0, 5),
    draggers: big.sort(byGrowth).slice(-5).reverse(),
    medianGdp: Math.round(medianGdp * 10) / 10,
  };
}
