import { sma, macd, rsi } from "./indicators";

export interface Signal {
  date: string;
  type: "buy" | "sell";
  rule: string; // 命中依据（回显判断标准）
  strength: 1 | 2 | 3; // 信号强度
}

export interface ScanBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

/**
 * 买卖点扫描：结合「环节 7 判断标准」+ 经典技术形态
 * 规则（命中即产生信号，标注依据）：
 * - MA5 上穿 MA20 金叉 → 买入（多头排列确认）
 * - MA5 下穿 MA20 死叉 → 卖出
 * - RSI < 30 → 超卖买入；RSI > 70 → 超买卖出
 * - MACD DIF 上穿 DEA → 买入；下穿 → 卖出
 * - 放量突破 20 日高点（量 > 1.5×20日均量）→ 买入（放量突破 = 有效）
 * - 缩量回踩 MA20 企稳 → 买入观察（缩量回踩 = 低吸点）
 */
export function scanSignals(bars: ScanBar[]): Signal[] {
  if (bars.length < 30) return [];
  const closes = bars.map((b) => b.close);
  const vols = bars.map((b) => b.volume);
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const m = macd(closes);
  const r = rsi(closes, 14);
  const volMa20 = sma(vols, 20);
  const out: Signal[] = [];

  const push = (date: string, type: "buy" | "sell", rule: string, strength: 1 | 2 | 3) => {
    // 同一天同类型去重，保留强度高的
    const last = out[out.length - 1];
    if (last && last.date === date && last.type === type) {
      if (strength > last.strength) { last.rule = rule; last.strength = strength; }
      return;
    }
    out.push({ date, type, rule, strength });
  };

  for (let i = 25; i < bars.length; i++) {
    const b = bars[i];
    // 1) MA 金叉 / 死叉
    if (ma5[i - 1] != null && ma20[i - 1] != null && ma5[i] != null && ma20[i] != null) {
      if (ma5[i - 1]! <= ma20[i - 1]! && ma5[i]! > ma20[i]!) push(b.date, "buy", "MA5 上穿 MA20 金叉（多头排列确认）", 3);
      if (ma5[i - 1]! >= ma20[i - 1]! && ma5[i]! < ma20[i]!) push(b.date, "sell", "MA5 下穿 MA20 死叉（趋势转弱）", 3);
    }
    // 2) RSI 超买超卖
    if (r[i] != null) {
      if (r[i]! < 30) push(b.date, "buy", `RSI ${r[i]!.toFixed(0)} < 30 超卖`, 2);
      if (r[i]! > 70) push(b.date, "sell", `RSI ${r[i]!.toFixed(0)} > 70 超买`, 2);
    }
    // 3) MACD 金叉 / 死叉
    if (i >= 1 && m.dif[i] != null && m.dea[i] != null && m.dif[i - 1] != null && m.dea[i - 1] != null) {
      if (m.dif[i - 1]! <= m.dea[i - 1]! && m.dif[i]! > m.dea[i]!) push(b.date, "buy", "MACD DIF 上穿 DEA 金叉（动能转多）", 2);
      if (m.dif[i - 1]! >= m.dea[i - 1]! && m.dif[i]! < m.dea[i]!) push(b.date, "sell", "MACD DIF 下穿 DEA 死叉（动能转空）", 2);
    }
    // 4) 放量突破 20 日高点
    if (volMa20[i] != null && i >= 20) {
      const hi20 = Math.max(...bars.slice(i - 20, i).map((x) => x.high));
      if (b.close > hi20 && b.volume > volMa20[i]! * 1.5) push(b.date, "buy", "放量突破 20 日高点（量 >1.5×20日均量，突破有效）", 3);
    }
    // 5) 缩量回踩 MA20 企稳
    if (ma20[i] != null && i >= 25) {
      const near = Math.abs(b.close - ma20[i]!) / ma20[i]! < 0.015;
      const shrink = b.volume < volMa20[i]! * 0.8;
      if (near && shrink && b.close >= ma20[i]!) push(b.date, "buy", "缩量回踩 MA20 企稳（低吸点）", 2);
    }
  }
  // 相邻同向信号合并（3 根内）
  const merged: Signal[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.type === s.type && Math.abs(bars.findIndex((b) => b.date === s.date) - bars.findIndex((b) => b.date === last.date)) <= 3) {
      continue; // 合并相邻同向
    }
    merged.push(s);
  }
  return merged.slice(-24); // 只保留最近 24 个
}
