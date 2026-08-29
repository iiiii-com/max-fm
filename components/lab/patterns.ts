/** K 线经典形态识别：纯函数，基于 OHLC 数组（教学口径，规则公开可验证）
 *  形态规则参考《日本蜡烛图技术》（Steve Nison）通用定义，做了工程化简化：
 *  - 影线/实体倍数阈值固定，不做自适应
 *  - 趋势前提用「前 N 根累计涨跌幅」近似
 */

export interface PatternBar {
  open: number;
  close: number;
  high: number;
  low: number;
}

export interface PatternHit {
  index: number;
  date: string;
  name: string; // 形态名
  signal: "buy" | "sell"; // 教学含义：看涨/看跌
  note: string; // 判定依据
}

function body(b: PatternBar) {
  return Math.abs(b.close - b.open);
}
function upper(b: PatternBar) {
  return b.high - Math.max(b.close, b.open);
}
function lower(b: PatternBar) {
  return Math.min(b.close, b.open) - b.low;
}
function range(b: PatternBar) {
  return b.high - b.low;
}
function isBull(b: PatternBar) {
  return b.close > b.open;
}

/** 前 n 根（不含当前）累计涨跌幅 % */
function priorMove(bars: PatternBar[], i: number, n = 5): number {
  const s = Math.max(0, i - n);
  const a = bars[s]?.close ?? bars[i].close;
  const b = bars[i - 1]?.close ?? a;
  if (!a) return 0;
  return ((b - a) / a) * 100;
}

/** 单根 K 线形态（依赖趋势前提） */
function singleBarPatterns(bars: PatternBar[], i: number): PatternHit[] {
  const b = bars[i];
  const hits: PatternHit[] = [];
  const bd = body(b);
  const rg = range(b) || 1e-9;
  const trend = priorMove(bars, i);
  const date = (b as PatternBar & { date?: string }).date ?? "";

  // 锤子线：长下影（≥2×实体）、短上影（≤0.3×实体）、实体位于区间上部；出现在下跌后 → 看涨
  if (lower(b) >= 2 * bd && upper(b) <= Math.max(0.3 * bd, rg * 0.08) && trend <= -2) {
    hits.push({ index: i, date, name: "锤子线", signal: "buy", note: `前5日${trend.toFixed(1)}%下跌后，下影线${(lower(b) / (bd || 1e-9)).toFixed(1)}倍实体，收盘接近区间顶部` });
  }
  // 上吊线：同锤子线形态但出现在上涨后 → 看跌
  if (lower(b) >= 2 * bd && upper(b) <= Math.max(0.3 * bd, rg * 0.08) && trend >= 2) {
    hits.push({ index: i, date, name: "上吊线", signal: "sell", note: `前5日${trend.toFixed(1)}%上涨后出现长下影，多头动能衰竭警示` });
  }
  // 十字星：实体极小（≤10% 区间）
  if (bd <= rg * 0.1 && rg > 0) {
    hits.push({ index: i, date, name: "十字星", signal: trend >= 0 ? "sell" : "buy", note: `实体仅占区间${((bd / rg) * 100).toFixed(0)}%，多空僵持${trend >= 0 ? "高位变盘警示" : "低位可能反转"}` });
  }
  return hits;
}

/** 双根 K 线形态 */
function twoBarPatterns(bars: PatternBar[], i: number): PatternHit[] {
  if (i < 1) return [];
  const prev = bars[i - 1];
  const b = bars[i];
  const hits: PatternHit[] = [];
  const date = (b as PatternBar & { date?: string }).date ?? "";

  // 看涨吞没：阳线实体完全包住前阴线实体
  if (!isBull(prev) && isBull(b) && b.open <= prev.close && b.close >= prev.open) {
    hits.push({ index: i, date, name: "看涨吞没", signal: "buy", note: "阳线实体完全包住前根阴线实体，多方反攻力度强" });
  }
  // 看跌吞没：阴线实体完全包住前阳线实体
  if (isBull(prev) && !isBull(b) && b.open >= prev.close && b.close <= prev.open) {
    hits.push({ index: i, date, name: "看跌吞没", signal: "sell", note: "阴线实体完全包住前根阳线实体，空方压制" });
  }
  // 乌云盖顶：前阳后阴，阴线高开（高于前高）且收盘深入前阳实体下半部
  if (isBull(prev) && !isBull(b) && b.open > prev.high && b.close < (prev.open + prev.close) / 2) {
    hits.push({ index: i, date, name: "乌云盖顶", signal: "sell", note: "高开后收盘深入前阳实体中点之下，涨势受阻" });
  }
  // 刺透形态：前阴后阳，阳线低开（低于前低）且收盘深入前阴实体中点之上
  if (!isBull(prev) && isBull(b) && b.open < prev.low && b.close > (prev.open + prev.close) / 2) {
    hits.push({ index: i, date, name: "刺透形态", signal: "buy", note: "低开后收盘收复前阴实体中点之上，反弹有力" });
  }
  return hits;
}

/** 三根 K 线形态 */
function threeBarPatterns(bars: PatternBar[], i: number): PatternHit[] {
  if (i < 2) return [];
  const a = bars[i - 2];
  const b = bars[i - 1];
  const c = bars[i];
  const hits: PatternHit[] = [];
  const date = (c as PatternBar & { date?: string }).date ?? "";
  const smallBody = body(b) <= range(a) * 0.4;

  // 早晨之星：大阴 + 小实体/十字 + 大阳（第三根收盘收复第一根实体中点以上）
  if (!isBull(a) && body(a) > range(a) * 0.5 && smallBody && isBull(c) && c.close > (a.open + a.close) / 2) {
    hits.push({ index: i, date, name: "早晨之星", signal: "buy", note: "大阴→小实体→大阳且收复首根中点，经典底部反转组合" });
  }
  // 黄昏之星：大阳 + 小实体/十字 + 大阴（第三根收盘跌破第一根实体中点以下）
  if (isBull(a) && body(a) > range(a) * 0.5 && smallBody && !isBull(c) && c.close < (a.open + a.close) / 2) {
    hits.push({ index: i, date, name: "黄昏之星", signal: "sell", note: "大阳→小实体→大阴且跌破首根中点，经典顶部反转组合" });
  }
  return hits;
}

/** 全量扫描：返回按 index 升序的形态命中（含日期） */
export function detectPatterns(bars: Array<PatternBar & { date: string }>): PatternHit[] {
  const hits: PatternHit[] = [];
  for (let i = 0; i < bars.length; i++) {
    hits.push(...singleBarPatterns(bars, i), ...twoBarPatterns(bars, i), ...threeBarPatterns(bars, i));
  }
  return hits;
}

/** 形态教学目录（供 UI 展示判定标准） */
export const PATTERN_CATALOG: Array<{ name: string; signal: "buy" | "sell"; rule: string }> = [
  { name: "锤子线", signal: "buy", rule: "下跌后出现：下影线 ≥ 2×实体，上影线极短，收盘位于区间上部" },
  { name: "上吊线", signal: "sell", rule: "上涨后出现：形态同锤子线，含义相反（滞涨警示）" },
  { name: "看涨吞没", signal: "buy", rule: "阳线实体完全包住前一根阴线实体" },
  { name: "看跌吞没", signal: "sell", rule: "阴线实体完全包住前一根阳线实体" },
  { name: "十字星", signal: "sell", rule: "实体 ≤ 10% 区间，多空僵持；高位警示、低位观察" },
  { name: "乌云盖顶", signal: "sell", rule: "前阳后阴：阴线高开于前高之上，收盘深入前阳实体中点之下" },
  { name: "刺透形态", signal: "buy", rule: "前阴后阳：阳线低开于前低之下，收盘收复前阴实体中点之上" },
  { name: "早晨之星", signal: "buy", rule: "大阴 + 小实体 + 大阳（收盘收复首根中点）" },
  { name: "黄昏之星", signal: "sell", rule: "大阳 + 小实体 + 大阴（收盘跌破首根中点）" },
];
