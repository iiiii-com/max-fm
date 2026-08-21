/**
 * 编辑风图表色板（Design Tokens）
 *
 * 全站图表统一的「人文编辑风」配色：以站点主红 #c8102e 为轴，
 * 辅以纸质刊物质感的中低饱和色系，避免 Tailwind 默认蓝等 AI 模板色。
 *
 * 用法：
 *  - 单指标图：MACRO_METRIC_COLORS[type] ?? CHART_COLORS[0]
 *  - 多序列对比：CHART_COLORS[i % CHART_COLORS.length]
 *  - 公共样式：EDITORIAL.gridLine / EDITORIAL.axisLabel 等
 */

export const EDITORIAL = {
  /** 主红（站点品牌色，兼涨色） */
  primary: "#c8102e",
  /** 墨黑（正文/主序列） */
  ink: "#171717",
  /** 墨灰（次级文字/坐标轴） */
  muted: "#6b6b64",
  /** 浅灰（网格线，浅色主题） */
  gridLine: "#e5e5e0",
  /** 虚线灰（均值线等） */
  faint: "#a3a3a3",
  /** 涨 / 跌（中国习惯红涨绿跌） */
  up: "#c8102e",
  down: "#0f8a5f",
} as const;

/** 多序列图（对比 / 多指标）用色——克制、区分度清晰 */
export const CHART_COLORS = [
  "#c8102e", // 主红
  "#1f3a5f", // 普鲁士蓝
  "#2f7d6b", // 松绿
  "#b45309", // 金褐
  "#7c3aed", // 绛紫
  "#0e7490", // 灰青
  "#c2410c", // 陶土
  "#4d7c0f", // 灰绿
  "#9d174d", // 玫红
  "#52525b", // 墨灰
] as const;

/**
 * 宏观指标语义色：各指标在仪表盘中固定的标识色。
 * 跟随编辑色系轮换，并保留语义直觉（物价偏红、金融偏蓝、外贸偏紫…）。
 */
export const MACRO_METRIC_COLORS: Record<string, string> = {
  gdp: "#1f3a5f",
  cpi: "#c8102e",
  ppi: "#c2410c",
  pmi: "#0e7490",
  m2: "#1f3a5f",
  tsf: "#2f7d6b",
  lpr: "#7c3aed",
  fx: "#0e7490",
  ind: "#4d7c0f",
  retail: "#c2410c",
  invest: "#7c3aed",
  realestate: "#c8102e",
  fin: "#2f7d6b",
  export: "#7c3aed",
  import: "#9d174d",
  unemp: "#b45309",
  houseprice: "#c8102e",
  yield10y: "#52525b",
  usdcny: "#c2410c",
  m1: "#1f3a5f",
  tsfstock: "#2f7d6b",
  loans: "#1f3a5f",
  gold: "#b45309",
  carsales: "#4d7c0f",
};

/** 产业链层级色（上游 / 中游 / 下游） */
export const CHAIN_LEVEL_COLORS: Record<string, string> = {
  上游: "#2f7d6b",
  中游: "#c8102e",
  下游: "#1f3a5f",
};
