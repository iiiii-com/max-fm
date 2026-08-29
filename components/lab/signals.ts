/** 买卖点信号扫描：基于技术指标的明确规则（教学口径，全部可复算验证）
 *  依赖 lib/data/indicators 的真实计算结果，不引入任何主观打分。
 */

import { macd, kdj, rsi, sma, type OHLC } from "@/lib/data/indicators";

export interface ScanSignal {
  index: number;
  date: string;
  source: string; // 指标来源
  type: "buy" | "sell";
  detail: string; // 触发数值依据
}

export interface ScanRule {
  id: string;
  name: string;
  desc: string; // 判定标准（教学展示）
}

/** 扫描规则目录（UI 展示） */
export const SCAN_RULES: ScanRule[] = [
  { id: "macd", name: "MACD 金叉/死叉", desc: "DIF 上穿 DEA 为金叉（买），下穿为死叉（卖）" },
  { id: "kDJ", name: "KDJ 金叉/死叉", desc: "K 上穿 D 为金叉（买，<30 低位更可靠），下穿为死叉（卖）" },
  { id: "rsi", name: "RSI 超买/超卖", desc: "RSI(14) < 30 为超卖（买点关注），> 70 为超买（卖点关注）" },
  { id: "ma", name: "均线交叉", desc: "MA5 上穿 MA20 为金叉（买），下穿为死叉（卖）" },
];

/** 对 K 线序列全量扫描，返回按 index 升序的信号列表 */
export function scanSignals(bars: Array<OHLC & { date: string }>): ScanSignal[] {
  const out: ScanSignal[] = [];
  if (bars.length < 35) return out;
  const closes = bars.map((b) => b.close);

  // MACD
  const m = macd(closes);
  for (let i = 1; i < bars.length; i++) {
    const difPrev = m.dif[i - 1] ?? 0;
    const deaPrev = m.dea[i - 1] ?? 0;
    const dif = m.dif[i] ?? 0;
    const dea = m.dea[i] ?? 0;
    if (difPrev <= deaPrev && dif > dea) {
      out.push({ index: i, date: bars[i].date, source: "MACD", type: "buy", detail: `DIF(${dif.toFixed(3)}) 上穿 DEA(${dea.toFixed(3)})` });
    } else if (difPrev >= deaPrev && dif < dea) {
      out.push({ index: i, date: bars[i].date, source: "MACD", type: "sell", detail: `DIF(${dif.toFixed(3)}) 下穿 DEA(${dea.toFixed(3)})` });
    }
  }

  // KDJ
  const k = kdj(bars);
  for (let i = 1; i < bars.length; i++) {
    const kp = k.k[i - 1] ?? 50;
    const dp = k.d[i - 1] ?? 50;
    const kc = k.k[i] ?? 50;
    const dc = k.d[i] ?? 50;
    if (kp <= dp && kc > dc) {
      out.push({ index: i, date: bars[i].date, source: "KDJ", type: "buy", detail: `K(${kc.toFixed(1)}) 上穿 D(${dc.toFixed(1)})${kc < 30 ? "，低位金叉" : ""}` });
    } else if (kp >= dp && kc < dc) {
      out.push({ index: i, date: bars[i].date, source: "KDJ", type: "sell", detail: `K(${kc.toFixed(1)}) 下穿 D(${dc.toFixed(1)})${kc > 70 ? "，高位死叉" : ""}` });
    }
  }

  // RSI(14) 超买超卖（穿越阈值才算信号，避免连续触发）
  const r = rsi(closes, 14);
  for (let i = 1; i < bars.length; i++) {
    const prev = r[i - 1];
    const cur = r[i];
    if (prev == null || cur == null) continue;
    if (prev >= 30 && cur < 30) {
      out.push({ index: i, date: bars[i].date, source: "RSI", type: "buy", detail: `RSI 跌入超卖区（${cur.toFixed(1)} < 30）` });
    } else if (prev <= 70 && cur > 70) {
      out.push({ index: i, date: bars[i].date, source: "RSI", type: "sell", detail: `RSI 升入超买区（${cur.toFixed(1)} > 70）` });
    }
  }

  // MA5 × MA20
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  for (let i = 1; i < bars.length; i++) {
    const p5 = ma5[i - 1];
    const p20 = ma20[i - 1];
    const c5 = ma5[i];
    const c20 = ma20[i];
    if (p5 == null || p20 == null || c5 == null || c20 == null) continue;
    if (p5 <= p20 && c5 > c20) {
      out.push({ index: i, date: bars[i].date, source: "均线", type: "buy", detail: `MA5(${c5.toFixed(2)}) 上穿 MA20(${c20.toFixed(2)})` });
    } else if (p5 >= p20 && c5 < c20) {
      out.push({ index: i, date: bars[i].date, source: "均线", type: "sell", detail: `MA5(${c5.toFixed(2)}) 下穿 MA20(${c20.toFixed(2)})` });
    }
  }

  return out.sort((a, b) => a.index - b.index);
}
