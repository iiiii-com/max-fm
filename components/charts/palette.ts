/**
 * 图表色板（浅色机构研究）
 *
 * 此前这份色板是为**深色终端底**调的：青 #4dd0e1、黄绿 #a3e635、亮红 #ff8a8c
 * 这类高亮度荧光色在黑底上才够醒目。切到白底后它们会显得刺眼且彼此难分，
 * 于是 /macro 的 24 张图呈现出「每张一个随机荧光色」的效果——这是"没有质感"的主要来源。
 *
 * 两条改法（均已落地）：
 *  1. 整体换成白底可读的分类色板，色相均匀、明度接近，不再有荧光色；
 *  2. 宏观指标**按分组着色**而非按指标着色——同一组的 4~7 张图共用一色，
 *     颜色开始承载信息（看颜色就知道是价格还是货币），而不是随机装饰。
 *     涨跌另有语义红绿，不与色板混用。
 *
 * 用法：
 *  - 单指标图：MACRO_METRIC_COLORS[type] ?? GROUP_COLORS[0]
 *  - 多序列对比：CHART_COLORS[i % CHART_COLORS.length]
 *  - 公共样式：EDITORIAL.gridLine / axisLabel 等
 */

export const EDITORIAL = {
  /** 强调：墨色（研究类版式不用彩色主色） */
  primary: "#1a1a1a",
  /** 主文字 */
  ink: "#1a1a1a",
  /** 次要文字 / 坐标轴 */
  muted: "#6b6862",
  /** 网格线：白底上必须很淡，否则满屏灰线 */
  gridLine: "rgba(26, 26, 26, 0.08)",
  /** 虚线灰（均值线等） */
  faint: "#8a867e",
  /** 涨 / 跌（A 股惯例红涨绿跌；白底需更深才够对比） */
  up: "#c0392b",
  down: "#1e8449",
} as const;

/**
 * 多序列图（对比 / 多指标）用色。
 * 按色相均匀排列：相邻色相差足够大，两条相邻序列线不会难分；
 * 全部控制在中等明度，不会被误读成涨跌语义色。
 */
export const CHART_COLORS = [
  "#2563eb", // 蓝
  "#c0392b", // 红
  "#0f766e", // 青绿
  "#7c3aed", // 紫
  "#b45309", // 琥珀
  "#0284c7", // 天蓝
  "#be185d", // 品红
  "#4d7c0f", // 橄榄
] as const;

/** 四大分组的标识色——与 /macro 的 Tab 分组一一对应 */
export const GROUP_COLORS: Record<string, string> = {
  总量景气: "#2563eb", // 蓝：经济总量
  价格: "#c0392b", // 红：价格与通胀
  货币金融: "#0f766e", // 青绿：货币与利率
  需求外贸: "#7c3aed", // 紫：内需与外需
};

/**
 * 宏观指标色 = 其所属分组的色。
 * 不再逐指标指定颜色：24 个指标各配一色既无信息量又制造视觉噪音。
 */
import { MACRO_INDICATORS } from "@/lib/data/macro-indicators";

export const MACRO_METRIC_COLORS: Record<string, string> = Object.fromEntries(
  MACRO_INDICATORS.map((i) => [i.type, GROUP_COLORS[i.group] ?? CHART_COLORS[0]])
);

/** 产业链层级色（上游 / 中游 / 下游）——改用同一套分类色板 */
export const CHAIN_LEVEL_COLORS: Record<string, string> = {
  上游: CHART_COLORS[2],
  中游: CHART_COLORS[0],
  下游: CHART_COLORS[3],
};
