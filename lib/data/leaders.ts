/**
 * 热门板块龙头代表 & 热门主题 ETF
 * 供个股行情 / ETF 专区一键直达真实 K 线分析。
 */

export interface LeaderStock {
  name: string;
  code: string;
  secid: string;
}

export interface SectorLeaders {
  sector: string;
  stocks: LeaderStock[];
}

/** 热门板块 → 龙头代表（每板块 1-2 只） */
export const SECTOR_LEADERS: SectorLeaders[] = [
  {
    sector: "白酒",
    stocks: [
      { name: "贵州茅台", code: "600519", secid: "1.600519" },
      { name: "五粮液", code: "000858", secid: "0.000858" },
    ],
  },
  {
    sector: "银行",
    stocks: [
      { name: "招商银行", code: "600036", secid: "1.600036" },
      { name: "工商银行", code: "601398", secid: "1.601398" },
    ],
  },
  {
    sector: "半导体",
    stocks: [
      { name: "中芯国际", code: "688981", secid: "1.688981" },
      { name: "北方华创", code: "002371", secid: "0.002371" },
    ],
  },
  {
    sector: "AI 算力",
    stocks: [
      { name: "海光信息", code: "688041", secid: "1.688041" },
      { name: "寒武纪", code: "688256", secid: "1.688256" },
    ],
  },
  {
    sector: "新能源车",
    stocks: [
      { name: "宁德时代", code: "300750", secid: "0.300750" },
      { name: "比亚迪", code: "002594", secid: "0.002594" },
    ],
  },
  {
    sector: "光伏",
    stocks: [
      { name: "隆基绿能", code: "601012", secid: "1.601012" },
      { name: "阳光电源", code: "300274", secid: "0.300274" },
    ],
  },
  {
    sector: "医药",
    stocks: [
      { name: "恒瑞医药", code: "600276", secid: "1.600276" },
      { name: "药明康德", code: "603259", secid: "1.603259" },
    ],
  },
  {
    sector: "券商",
    stocks: [
      { name: "中信证券", code: "600030", secid: "1.600030" },
      { name: "东方财富", code: "300059", secid: "0.300059" },
    ],
  },
  {
    sector: "军工",
    stocks: [
      { name: "中航沈飞", code: "600760", secid: "1.600760" },
      { name: "航发动力", code: "600893", secid: "1.600893" },
    ],
  },
  {
    sector: "家电",
    stocks: [
      { name: "美的集团", code: "000333", secid: "0.000333" },
      { name: "格力电器", code: "000651", secid: "0.000651" },
    ],
  },
  {
    sector: "消费电子",
    stocks: [
      { name: "立讯精密", code: "002475", secid: "0.002475" },
      { name: "工业富联", code: "601138", secid: "1.601138" },
    ],
  },
];

export interface ThemeEtf {
  name: string;
  code: string;
  secid: string;
  cat: "宽基" | "行业" | "跨境";
}

/** 热门主题 ETF（宽基 / 行业 / 跨境） */
export const THEME_ETFS: ThemeEtf[] = [
  { name: "沪深300ETF", code: "510300", secid: "1.510300", cat: "宽基" },
  { name: "创业板ETF", code: "159915", secid: "0.159915", cat: "宽基" },
  { name: "科创50ETF", code: "588000", secid: "1.588000", cat: "宽基" },
  { name: "半导体ETF", code: "512480", secid: "1.512480", cat: "行业" },
  { name: "芯片ETF", code: "159995", secid: "0.159995", cat: "行业" },
  { name: "白酒ETF", code: "512690", secid: "1.512690", cat: "行业" },
  { name: "证券ETF", code: "512880", secid: "1.512880", cat: "行业" },
  { name: "医药ETF", code: "512010", secid: "1.512010", cat: "行业" },
  { name: "新能源车ETF", code: "515030", secid: "1.515030", cat: "行业" },
  { name: "光伏ETF", code: "515790", secid: "1.515790", cat: "行业" },
  { name: "黄金ETF", code: "518880", secid: "1.518880", cat: "跨境" },
  { name: "纳指ETF", code: "513100", secid: "1.513100", cat: "跨境" },
];

/** ETF 分类徽章配色 */
export const ETF_CAT_TONE: Record<ThemeEtf["cat"], string> = {
  宽基: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  行业: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  跨境: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};
