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