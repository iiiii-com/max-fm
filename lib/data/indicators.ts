/** 技术指标计算库：纯函数，基于 OHLC 数组 */

export interface OHLC {
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

/** 简单移动平均 */
export function sma(data: number[], n: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < n - 1) return null;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += data[j];
    return Number((s / n).toFixed(3));
  });
}

/** EMA 指数移动平均 */
export function ema(data: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  let prev = data[0];
  out.push(prev);
  for (let i = 1; i < data.length; i++) {
    prev = data[i] * k + prev * (1 - k);
    out.push(Number(prev.toFixed(3)));
  }
  return out;
}

export interface MacdResult {
  dif: (number | null)[];
  dea: (number | null)[];
  hist: (number | null)[];
}

/** MACD：DIF = EMA12 - EMA26，DEA = DIF 的 EMA9，HIST = (DIF-DEA)*2 */
export function macd(closes: number[], fast = 12, slow = 26, signal = 9): MacdResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const difArr = closes.map((_, i) => Number((emaFast[i] - emaSlow[i]).toFixed(3)));
  const deaArr = ema(difArr, signal);
  const hist = difArr.map((d, i) => Number(((d - deaArr[i]) * 2).toFixed(3)));
  return { dif: difArr, dea: deaArr, hist };
}

export interface BollResult {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

/** BOLL 布林带：中轨 = MA20，上/下轨 = 中轨 ± 2×标准差 */
export function boll(closes: number[], n = 20, k = 2): BollResult {
  const mid = sma(closes, n);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < n - 1 || mid[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (closes[j] - mid[i]!) ** 2;
    const sd = Math.sqrt(v / n);
    upper.push(Number((mid[i]! + k * sd).toFixed(3)));
    lower.push(Number((mid[i]! - k * sd).toFixed(3)));
  }
  return { mid, upper, lower };
}

export interface KdjResult {
  k: (number | null)[];
  d: (number | null)[];
  j: (number | null)[];
}

/** KDJ：RSV = (C-L9)/(H9-L9)*100，K = 2/3*Kprev + 1/3*RSV，D = 2/3*Dprev + 1/3*K，J = 3K-2D */
export function kdj(bars: OHLC[], n = 9): KdjResult {
  const k: (number | null)[] = [];
  const d: (number | null)[] = [];
  const j: (number | null)[] = [];
  let prevK = 50;
  let prevD = 50;
  for (let i = 0; i < bars.length; i++) {
    if (i < n - 1) {
      k.push(null);
      d.push(null);
      j.push(null);
      continue;
    }
    let h = -Infinity;
    let l = Infinity;
    for (let x = i - n + 1; x <= i; x++) {
      h = Math.max(h, bars[x].high);
      l = Math.min(l, bars[x].low);
    }
    const rsv = h === l ? 50 : ((bars[i].close - l) / (h - l)) * 100;
    prevK = (2 / 3) * prevK + (1 / 3) * rsv;
    prevD = (2 / 3) * prevD + (1 / 3) * prevK;
    k.push(Number(prevK.toFixed(2)));
    d.push(Number(prevD.toFixed(2)));
    j.push(Number((3 * prevK - 2 * prevD).toFixed(2)));
  }
  return { k, d, j };
}

export interface RsiResult {
  rsi6: (number | null)[];
  rsi14: (number | null)[];
}

/** RSI：相对强弱指数（Wilder 平滑） */
export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = 0; i < closes.length; i++) {
    if (i <= period) {
      out.push(null);
      continue;
    }
    const diff = closes[i] - closes[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out.push(Number((avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)).toFixed(2)));
  }
  return out;
}

/** 可供叠加的指标元信息 */
export const INDICATORS = [
  { key: "ma", label: "MA 均线", desc: "MA5/10/20/60 简单移动平均" },
  { key: "macd", label: "MACD", desc: "DIF/DEA/柱（12/26/9）" },
  { key: "boll", label: "BOLL 布林带", desc: "中轨±2σ（20 日）" },
  { key: "kdj", label: "KDJ", desc: "随机指标（9,3,3）" },
  { key: "rsi", label: "RSI", desc: "相对强弱（6/14）" },
] as const;

export type IndicatorKey = (typeof INDICATORS)[number]["key"];

// ---------------- 趋势涨跌幅度检测（zigzag 摆动点） ----------------

export interface SwingMark {
  /** 摆动点类型：peak=波峰 / trough=波谷 */
  type: "peak" | "trough";
  /** 所在 K 线索引 */
  index: number;
  /** 价格（收盘价） */
  price: number;
  /** 相对前一点的涨跌幅度 % */
  changePct: number;
  /** 标签：如 "+30.2%" / "-15.8%" */
  label: string;
}

/**
 * ZigZag 摆动点检测：识别显著峰谷转折。
 * @param closes 收盘价数组
 * @param thresholdPct 最小幅度阈值（%），低于该幅度的摆动忽略，避免噪声
 * @returns 峰谷序列（首尾各包含一个端点）
 */
export function detectSwings(closes: number[], thresholdPct = 12): SwingMark[] {
  const n = closes.length;
  if (n < 3) return [];
  const swings: SwingMark[] = [{ type: "trough", index: 0, price: closes[0], changePct: 0, label: "" }];
  let dir = 0; // 0=初始, 1=向上, -1=向下
  let extIdx = 0; // 当前极值索引
  let extPrice = closes[0];

  for (let i = 1; i < n; i++) {
    const c = closes[i];
    if (dir >= 0) {
      if (c > extPrice) {
        extIdx = i;
        extPrice = c;
      } else if (((extPrice - c) / extPrice) * 100 >= thresholdPct) {
        // 确认波峰
        const last = swings[swings.length - 1];
        const chg = ((extPrice - last.price) / last.price) * 100;
        swings.push({ type: "peak", index: extIdx, price: extPrice, changePct: chg, label: `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%` });
        dir = -1;
        extIdx = i;
        extPrice = c;
      }
    } else if (dir < 0) {
      if (c < extPrice) {
        extIdx = i;
        extPrice = c;
      } else if (((c - extPrice) / extPrice) * 100 >= thresholdPct) {
        // 确认波谷
        const last = swings[swings.length - 1];
        const chg = ((extPrice - last.price) / last.price) * 100;
        swings.push({ type: "trough", index: extIdx, price: extPrice, changePct: chg, label: `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%` });
        dir = 1;
        extIdx = i;
        extPrice = c;
      }
    }
  }
  // 末尾端点
  if (extIdx !== swings[swings.length - 1]?.index) {
    const last = swings[swings.length - 1];
    const chg = ((extPrice - last.price) / last.price) * 100;
    swings.push({ type: dir >= 0 ? "peak" : "trough", index: extIdx, price: extPrice, changePct: chg, label: `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%` });
  }
  return swings;
}

/**
 * 构建涨跌幅度标注的 markPoint 数据。
 * 锚定真实价格点位（coord=[index, price]），随 dataZoom 缩放平移自动跟随；
 * 标签带背景色 + 圆角，涨红跌绿背景下均醒目，不遮挡 K 线主体（偏移到高低点外侧）。
 */
export function buildSwingMarkPoints(swings: SwingMark[], opts: { maxCount?: number; minAbsPct?: number } = {}) {
  const { maxCount = 40, minAbsPct = 12 } = opts;
  const filtered = swings.filter((s) => Math.abs(s.changePct) >= minAbsPct).slice(-maxCount);
  return filtered.map((s) => {
    const isPeak = s.type === "peak";
    const isUp = s.changePct >= 0;
    const color = isUp ? "#dc2626" : "#16a34a";
    return {
      coord: [s.index, s.price],
      value: s.label,
      symbol: "circle",
      symbolSize: 5,
      symbolRotate: 0,
      itemStyle: { color, borderColor: "#fff", borderWidth: 1 },
      label: {
        show: true,
        formatter: s.label,
        color: "#ffffff",
        fontSize: 10,
        fontWeight: "bold",
        backgroundColor: color,
        padding: [2, 5],
        borderRadius: 3,
        position: isPeak ? "bottom" : "top",
        distance: 8,
      },
    };
  });
}

/** 日 K 聚合为周 / 月 K（OHLCV 通用工具） */
export function aggregateBars(bars: Array<{ date: string; open: number; close: number; high: number; low: number; volume: number }>, unit: "week" | "month") {
  const keyOf = (d: string) => {
    if (unit === "month") return d.slice(0, 7);
    const dt = new Date(d);
    const day = (dt.getDay() + 6) % 7; // 周一=0
    const mon = new Date(dt);
    mon.setDate(dt.getDate() - day);
    return mon.toISOString().slice(0, 10);
  };
  const map = new Map<string, { date: string; open: number; close: number; high: number; low: number; volume: number }>();
  for (const b of bars) {
    const k = keyOf(b.date);
    const cur = map.get(k);
    if (!cur) map.set(k, { date: b.date, open: b.open, close: b.close, high: b.high, low: b.low, volume: b.volume });
    else {
      cur.close = b.close;
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.volume += b.volume;
    }
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
