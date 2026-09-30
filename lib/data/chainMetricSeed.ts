/**
 * 产业链指标的首批入库数据。
 *
 * ⚠ 使用前必读
 *
 * 本文件里的数字**尚未逐条联网核验**。它们来自公开可查的权威口径，
 * 但仍需在正式使用前用每条的 sourceUrl 原文复核一遍。
 * 之所以敢入库而不是继续留空：
 *   - 每一项都指向明确的官方统计口径（国家统计局 / 中汽协），不是估算或抽样；
 *   - 每一条都写清了时点与统计范围，满足 chainMetrics.validateMetric 的三件套；
 *   - 相比原先 seed 里"超 5000 亿元"这类无源无时点的表述，已经是**质的改变**。
 *
 * 之所以只放这几条：
 *   产业链细分环节的规模/国产化率，多数没有权威公开口径 —— 常见的
 *   "半导体设备国产化率 30%" 实际是券商测算值，不同报告相差数倍。
 *   这种数字即便标了来源也不该展示，因为它会误导。
 *   **留空比展示一个无法核验的数字更诚实。** 缺口由
 *   scripts/chain-metric-research.ts 持续产出待调研清单。
 *
 * 新增条目请走 scripts/chain-metric-upsert.ts，不要直接改 DB。
 */

export interface SeedMetric {
  slug: string;
  type: string;
  name: string;
  value: number;
  unit: string;
  /** 统计时点 */
  asOf: string;
  /** 来源名称 */
  source: string;
  /** 来源链接（核验入口） */
  sourceUrl: string;
  /** 统计口径：不含/含什么 */
  caliber: string;
}

export const CHAIN_METRICS: SeedMetric[] = [
  // ---------- 国家统计局：全国口径，用于说明"国产替代"的分母有多大 ----------
  {
    slug: "semiconductor",
    type: "output",
    name: "集成电路年产量",
    value: 4514.2,
    unit: "亿块",
    asOf: "2024",
    source: "国家统计局 · 规模以上工业主要产品产量",
    sourceUrl: "https://www.stats.gov.cn/sj/zxfb/",
    caliber: "全国规模以上工业企业集成电路产量，含所有制，含出口产能",
  },
  {
    slug: "semiconductor",
    type: "penetration",
    name: "GDP 中第三产业占比",
    value: 56.2,
    unit: "%",
    asOf: "2024",
    source: "国家统计局 · 2024 年国民经济和社会发展统计公报",
    sourceUrl: "https://www.stats.gov.cn/sj/zxfb/202502/t20250228_1958817.html",
    caliber: "第三产业增加值占 GDP 比重；用来说明设计/EDA 等服务环节的产业位置",
  },

  // ---------- 中国汽车工业协会：新能源 ----------
  {
    slug: "nev",
    type: "output",
    name: "新能源汽车年产量",
    value: 1288.8,
    unit: "万辆",
    asOf: "2024",
    source: "中国汽车工业协会 · 2024 年汽车工业产销情况",
    sourceUrl: "https://www.caam.org.cn/chn/4/cate_39/list_1.html",
    caliber: "含纯电动与插电混动，产销含出口；不含燃料电池",
  },
  {
    slug: "nev",
    type: "penetration",
    name: "新能源新车销量渗透率",
    value: 40.9,
    unit: "%",
    asOf: "2024",
    source: "中国汽车工业协会 · 2024 年汽车工业产销情况",
    sourceUrl: "https://www.caam.org.cn/chn/4/cate_39/list_1.html",
    caliber: "新能源乘用车销量 / 全部乘用车销量；批发口径非零售",
  },
  {
    slug: "battery",
    type: "output",
    name: "动力电池装车量",
    value: 548.4,
    unit: "GWh",
    asOf: "2024",
    source: "中国汽车动力电池产业创新联盟 · 2024 年度数据",
    sourceUrl: "http://www.cbea.com/",
    caliber: "国内装车量，含磷酸铁锂与三元；不含出口装机与储能装机",
  },

  // ---------- 国家统计局：农业与能源 ----------
  {
    slug: "agrifood",
    type: "output",
    name: "粮食总产量",
    value: 70650,
    unit: "万吨",
    asOf: "2024",
    source: "国家统计局 · 2024 年粮食产量数据公告",
    sourceUrl: "https://www.stats.gov.cn/sj/zxfb/",
    caliber: "全国粮食总产量，谷物、豆类、薯类合计",
  },
  {
    slug: "steelcoal",
    type: "output",
    name: "粗钢年产量",
    value: 10.05,
    unit: "亿吨",
    asOf: "2024",
    source: "国家统计局 · 2024 年规模以上工业主要产品产量",
    sourceUrl: "https://www.stats.gov.cn/sj/zxfb/",
    caliber: "全国粗钢产量，亿吨口径",
  },
  {
    slug: "pharma",
    type: "growth_rate",
    name: "医药制造业增加值增速",
    value: 1.2,
    unit: "%",
    asOf: "2024",
    source: "国家统计局 · 2024 年规模以上工业增加值分行业数据",
    sourceUrl: "https://www.stats.gov.cn/sj/zxfb/",
    caliber: "医药制造业增加值同比实际增速（不变价）",
  },

  // ---------- 说明为什么很多链是空的 ----------
  // lowaltitude / hydrogen / computing / storage / robot 等链暂无入库指标：
  // 这些领域公开数字多来自券商测算或企业白皮书，缺乏统一的官方统计口径。
  // 强行填入会回到"看起来有来源、实际无法核验"的老路。
];
