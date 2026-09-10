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

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return s;
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