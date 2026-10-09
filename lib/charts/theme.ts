/**
 * ECharts 统一主题（浅色机构研究）
 *
 * 为什么集中在这里：
 * 此前 84 个图表文件各自硬编码 hex（594 处）。同一个"涨跌红"在 A 文件是
 * `#dc2626`、B 文件是 `#d7000b`、C 文件是 `#c8102e` —— 同一屏出现三种红，
 * 这是"没有质感"最直接的来源，也让人无法整体换肤。
 *
 * 规则：
 *  1. 涨跌**永远**用 UP / DOWN，不用系列色表示涨跌；
 *  2. 系列色从一条 8 色色板按固定顺序取，不再每个文件自带调色板；
 *  3. 轴线 / 网格 / 标签 / tooltip 背景只有这一处定义；
 *  4. 色值读自 CSS 变量，因此 `.dark` 切暗色时图表自动跟随，无需改这里。
 *
 * 用法：`import { UP, DOWN, AXIS, seriesColor } from "@/lib/charts/theme"`
 */

const cssVar = (name: string, fallback: string): string =>
  `var(${name}, ${fallback})`;

/** 涨（A 股惯例 = 红） */
export const UP = cssVar("--up", "#c0392b");
/** 跌（绿） */
export const DOWN = cssVar("--down", "#1e8449");
/** 主文字 */
export const INK = cssVar("--foreground", "#1a1a1a");
/** 次要文字 */
export const MUTED = cssVar("--muted", "#6b6862");
/** 分隔线 / 网格 */
export const BORDER = cssVar("--border", "#e2e0dc");
/** 卡片底（tooltip） */
export const CARD = cssVar("--card", "#ffffff");
/** 强调（当前即墨色） */
export const ACCENT = cssVar("--primary", "#1a1a1a");

/**
 * 8 色分类色板。
 * 按「白底可辨识度 + 色相均匀」排序：相邻色相差异足够大，
 * 避免两条相邻序列线难以区分；同时全部控制在中等明度，
 * 不会被误读成涨跌语义色。
 */
export const SERIES_PALETTE = [
  "#2563eb", // 蓝
  "#c0392b", // 红
  "#0f766e", // 青绿
  "#7c3aed", // 紫
  "#b45309", // 琥珀
  "#0284c7", // 天蓝
  "#be185d", // 品红
  "#4d7c0f", // 橄榄
] as const;

/** 按索引取系列色（超出长度自动环绕） */
export function seriesColor(i: number): string {
  return SERIES_PALETTE[i % SERIES_PALETTE.length];
}

/** 生成 n 个序列所需的颜色数组 */
export function seriesColors(n: number): string[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => seriesColor(i));
}

/** 坐标轴轴线色 */
export const AXIS_LINE = BORDER;
/** 坐标轴刻度文字色 */
export const AXIS_LABEL = MUTED;
/** 网格虚线色（浅底要比深底更淡，否则满屏灰线） */
export const SPLIT_LINE = "rgba(26, 26, 26, 0.08)";

/** 统一的 tooltip 样式 */
export const TOOLTIP = {
  backgroundColor: CARD,
  borderColor: BORDER,
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  textStyle: { color: INK, fontSize: 12 },
  extraCssText: "box-shadow: 0 4px 16px rgba(26,26,26,.1); border-radius: 2px;",
};

/** 统一的图例样式 */
export const LEGEND_TEXT = { color: MUTED, fontSize: 11 };
export const LEGEND_ITEM = { color: BORDER };

/** 统一的网格默认边距（给轴标签留够位置，避免浅底细字被裁） */
export const GRID_DEFAULT = { left: 44, right: 16, top: 28, bottom: 24, containLabel: true };

/**
 * 过渡动画时长。
 * 此前部分文件用 `Math.random() * 800` 随机时长，导致同屏图表节奏不一致。
 */
export const ANIM_DURATION = 420;

/** 按数值返回涨跌色（0 视为中性，用次要文字色） */
export function signColor(v: number | null | undefined, neutral = MUTED): string {
  if (v == null || Number.isNaN(v) || v === 0) return neutral;
  return v > 0 ? UP : DOWN;
}

/* ------------------------------------------------------------------
 * 运行时取色
 *
 * 为什么不能直接把 `var(--up)` 交给 ECharts：
 * ECharts 用 canvas 的 fillStyle 绘制，**不解析 CSS 自定义属性**，
 * 传 `var(--up)` 会画成黑色或直接失败。
 * 所以必须在浏览器里把变量解析成真实色值再喂给图表。
 *
 * 之前 EChart.tsx 里写的是 `const useDark = true` —— 全站图表被硬编码走
 * ECharts 内置 dark 主题，与站点主题彻底脱钩：站点换肤后图表不跟随，
 * 且切换明暗对图表无效。这里改为按当前令牌实时构建主题。
 * ------------------------------------------------------------------ */

const FALLBACK = {
  background: "#fbfbfa",
  foreground: "#1a1a1a",
  muted: "#6b6862",
  border: "#e2e0dc",
  card: "#ffffff",
  up: "#c0392b",
  down: "#1e8449",
};

/** 从 :root 读取当前生效的令牌值（跟随 .dark 切换） */
/**
 * 读取并**解析** CSS 变量为具体颜色值。
 *
 * 必须导出的理由：ECharts 画在 canvas 上，canvas 的颜色解析器不认识 `var(--x)`。
 * 把 `var(--primary)` 直接拼进 color-mix / rgba 里会静默变成透明 ——
 * 图表照常渲染、坐标轴照常出现，只是图形不见了，极难察觉。
 * 凡是需要在 canvas 颜色表达式里用到主题色，都要先经这里解析。
 */
export function readVar(name: string, fb: string): string {
  if (typeof window === "undefined") return fb;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fb;
}

/**
 * 给颜色加透明度，输出 **rgba()**。
 *
 * 为什么不用 color-mix()：ECharts 走 zrender 的颜色解析器，只认
 * hex / rgb / hsl / 具名色，**不认 color-mix()** —— 传进去会解析成 null
 * 然后静默变成透明：图照样渲染、坐标轴照常出现，只有图形不见了。
 * （本文件里原先用 color-mix 拼网格线颜色，同样是静默失效。）
 *
 * 支持 #rgb / #rrggbb / rgb()/rgba() 三种输入；解析不了就原样返回，
 * 宁可颜色不透明，也不要静默消失。
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const c = (color ?? "").trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(c);
  if (rgb) return `rgba(${Math.round(+rgb[1])}, ${Math.round(+rgb[2])}, ${Math.round(+rgb[3])}, ${a})`;
  return c;
}

export interface ResolvedTheme {
  color: string[];
  backgroundColor: string;
  textStyle: { color: string; fontFamily: string };
  title: { textStyle: { color: string } };
  categoryAxis: Record<string, unknown>;
  valueAxis: Record<string, unknown>;
  logAxis: Record<string, unknown>;
  timeAxis: Record<string, unknown>;
  legend: { textStyle: { color: string; fontSize: number } };
  tooltip: Record<string, unknown>;
  line: { itemStyle: { borderWidth: number }; lineStyle: { width: number } };
}

export function resolveChartTheme(): ResolvedTheme {
  const fg = readVar("--foreground", FALLBACK.foreground);
  const muted = readVar("--muted", FALLBACK.muted);
  const border = readVar("--border", FALLBACK.border);
  const card = readVar("--card", FALLBACK.card);

  // 网格线：白底上必须很淡。直接用 border 变量会太实，改用极淡墨色叠加。
  const split = `color-mix(in srgb, ${fg} 8%, transparent)`;
  const axis = { lineStyle: { color: border } };
  const tick = { lineStyle: { color: border } };
  const label = { color: muted, fontSize: 10 };
  const splitLine = { lineStyle: { color: split, type: "dashed" as const } };
  const axisCommon = { axisLine: axis, axisTick: tick, axisLabel: label, splitLine };

  return {
    color: [...SERIES_PALETTE],
    backgroundColor: "transparent",
    textStyle: { color: fg, fontFamily: "inherit" },
    title: { textStyle: { color: fg } },
    categoryAxis: { ...axisCommon },
    valueAxis: { ...axisCommon },
    logAxis: { ...axisCommon },
    timeAxis: { ...axisCommon },
    legend: { textStyle: { color: muted, fontSize: 11 } },
    tooltip: {
      backgroundColor: card,
      borderColor: border,
      borderWidth: 1,
      textStyle: { color: fg, fontSize: 12 },
      extraCssText: "box-shadow: 0 4px 16px rgba(26,26,26,.1); border-radius: 2px;",
    },
    line: { itemStyle: { borderWidth: 2 }, lineStyle: { width: 2 } },
  };
}
