/**
 * 终端风图表色板（Design Tokens）
 *
 * 全站图表统一「终端」配色：黑底可读的中高亮度色系，
 * 以站点主琥珀 #F28C00 为轴，避免荧光刺眼与 AI 模板默认蓝。
 *
 * 用法：
 *  - 单指标图：MACRO_METRIC_COLORS[type] ?? CHART_COLORS[0]
 *  - 多序列对比：CHART_COLORS[i % CHART_COLORS.length]
 *  - 公共样式：EDITORIAL.gridLine / EDITORIAL.axisLabel 等
 */

export const EDITORIAL = {
  /** 琥珀（站点主色，兼强调） */
  primary: "#f28c00",
  /** 亮灰白（正文/主序列） */
  ink: "#d7d7d7",
  /** 中灰（次级文字/坐标轴） */
  muted: "#8a8a8a",
  /** 深灰（网格线，深色主题） */
  gridLine: "#292929",
  /** 虚线灰（均值线等） */
  faint: "#6e6e6e",
  /** 涨 / 跌（中国习惯红涨绿跌，终端亮度） */
  up: "#ff4d4f",
  down: "#00c176",
} as const;

/** 多序列图（对比 / 多指标）用色——黑底可读、区分度清晰、克制不荧光 */
export const CHART_COLORS = [
  "#f28c00", // 琥珀（主）
  "#4dd0e1", // 青
  "#ff8a8c", // 亮红
  "#4ade80", // 绿
  "#b39ddb", // 紫
  "#fbbf24", // 金
  "#67d8e8", // 天青
  "#f48fb1", // 粉
  "#a3e635", // 黄绿
  "#8a8a8a", // 中灰
] as const;

/**
 * 宏观指标语义色：各指标在仪表盘中固定的标识色。
 * 跟随终端色系轮换，并保留语义直觉（物价偏红、金融偏蓝青、外贸偏紫…）。
 */
export const MACRO_METRIC_COLORS: Record<string, string> = {
  gdp: "#4dd0e1",
  cpi: "#ff8a8c",
  ppi: "#f48fb1",
  pmi: "#67d8e8",
  m2: "#4dd0e1",
  tsf: "#4ade80",
  lpr: "#b39ddb",
  fx: "#67d8e8",
  ind: "#a3e635",
  retail: "#f48fb1",
  invest: "#b39ddb",
  realestate: "#ff8a8c",
  fin: "#4ade80",
  export: "#b39ddb",
  import: "#f48fb1",
  unemp: "#fbbf24",
  houseprice: "#ff8a8c",
  yield10y: "#8a8a8a",
  usdcny: "#f48fb1",
  m1: "#4dd0e1",
  tsfstock: "#4ade80",
  loans: "#4dd0e1",
  gold: "#fbbf24",
  carsales: "#a3e635",
};

/** 产业链层级色（上游 / 中游 / 下游）——终端亮度版 */
export const CHAIN_LEVEL_COLORS: Record<string, string> = {
  上游: "#4ade80",
  中游: "#ff8a8c",
  下游: "#4dd0e1",
};
