import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n > 0 ? "+" : ""}${fmt(n, 2)}%`;
}

export function fmtWan(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万亿`;
  return `${n.toFixed(1)}亿`;
}

/**
 * 日期展示（保留传入的日期字符串原样，仅在空值时返回「—」）。
 * 多数内容字段（政策发布日、财报期、文章发布日）本身就是 YYYY-MM-DD 文本，无需再格式化。
 */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return s;
}

/**
 * 时间戳 → 本地日期时间。
 *
 * 背景：本项目 `now()` 返回的是 **毫秒**（Date.now()），而历史上多处调用方又乘了 1000
 * 当作秒来用，导致「注册时间 / 建议时间」渲染成年份 58710 这样的荒谬值；
 * 另一些地方直接把 Date 对象或 ISO 字符串丢进页面，出现
 * `2026-09-28T04:45:35.295Z` 这样的原始 ISO 串。
 *
 * 本函数统一处理：接受 毫秒 / 秒 / Date / ISO 串，输出 `YYYY-MM-DD HH:mm`。
 * 传入无法解析的值返回「—」，不暴露原始串。
 */
export function fmtDateTime(input: unknown): string {
  const d = toDate(input);
  if (!d) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 时间戳 → YYYY-MM-DD */
export function fmtDateOnly(input: unknown): string {
  const d = toDate(input);
  if (!d) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 归一化指标日期标签。
 *
 * 上游季度指标曾返回 `2017-Q4.6666666666666666`（把"第 4 季度之后又过了 2/3 年"
 * 当成日期存了下来）。这类值此前只在卡片摘要里被 `cleanDate` 截断，
 * **图表 X 轴仍然直接渲染原始值**，于是坐标轴上出现一串浮点噪声。
 * 指标日期只用于排序和展示，不需要小数部分，这里统一截断。
 */
export function normalizeIndicatorDate(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  // 2024-03-15.666… → 2024-03-15
  // 2024-Q3.666…     → 2024-Q3
  // 2024-03.666…     → 2024-03
  return s.split(/[.,]/)[0];
}

/** 把各种时间表示统一成 Date；无法解析返回 null。10 位数按秒、13 位数按毫秒处理。 */
export function toDate(input: unknown): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === "number" && Number.isFinite(input)) {
    // 自动区分秒 / 毫秒：> 1e11 视为毫秒
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === "string") {
    const t = input.trim();
    if (!t) return null;
    // 纯数字串同样按秒/毫秒处理
    if (/^\d{9,16}$/.test(t)) return toDate(Number(t));
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * 相对时间（用于快讯流）。超过 7 天回退为绝对日期，避免出现「3 个月前」这种无信息量文案。
 */
export function fmtRelative(input: unknown, nowMs = Date.now()): string {
  const d = toDate(input);
  if (!d) return "—";
  const diff = nowMs - d.getTime();
  if (diff < 0) return fmtDateTime(d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day <= 7) return `${day} 天前`;
  return fmtDateOnly(d);
}

export function isUp(n: number | null | undefined): boolean {
  return (n ?? 0) >= 0;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * 安全解析「JSON 数组」文本列（数据库中常见：dataLinks / companies / tags 等）
 *
 * 这些字段由内容管道写入，一旦出现非法 JSON（编辑失误、截断、编码问题），
 * 在服务端组件里直接 JSON.parse 会抛出异常导致整页 500。
 * 这里统一降级为空数组，保证页面其余内容仍可正常渲染。
 */
export function safeJsonArray<T = unknown>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * 把上游接口返回值强制转为有限数字，非法值一律返回 null。
 *
 * 为什么需要：腾讯 / 东方财富 / 新浪等行情接口的数值字段**类型并不稳定**，
 * 同一字段有时是 number、有时是字符串（"12.34"）、有时是 "-" / "" / null。
 * 此时 `value?.toFixed(2)` 这种写法并不安全 —— 可选链只能挡 null/undefined，
 * 挡不住"字符串没有 toFixed 方法"，运行时会抛
 * `TypeError: xxx?.toFixed is not a function` 并导致整块 UI 崩溃。
 * 因此凡是来自外部接口的数值，应先经此函数归一化再参与计算或渲染。
 */
export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}