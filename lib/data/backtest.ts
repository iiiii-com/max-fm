/**
 * 策略回测引擎：预设策略库 + 全标的回测
 * 策略：均线金叉 / 突破 N 日高点 / RSI 超买超卖 / MACD 金叉死叉
 * 输出：总收益 / 年化 / 最大回撤 / 胜率 / 夏普 / 交易次数 + 净值曲线 + 信号
 */

export interface BacktestBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export type SignalType = "buy" | "sell" | null;

export interface Strategy {
  id: string;
  name: string;
  desc: string;
  signal: (bars: BacktestBar[]) => Array<{ date: string; type: SignalType }>;
}

export interface Trade {
  buyDate: string;
  buyPrice: number;
  sellDate: string | null;
  sellPrice: number | null;
  retPct: number | null; // 已平仓交易的收益率
  open: boolean;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  symbol: string;
  startDate: string;
  endDate: string;
  bars: number;
  totalRet: number; // 总收益率 %
  annualRet: number; // 年化 %
  maxDrawdown: number; // 最大回撤 %
  winRate: number; // 胜率 %
  tradeCount: number; // 交易次数（平仓）
  sharpe: number; // 夏普
  initial: number;
  final: number;
  equityCurve: Array<{ date: string; nav: number; benchmark: number }>; // 净值曲线（策略 vs 买入持有）
  signals: Array<{ date: string; type: "buy" | "sell" }>;
  trades: Trade[]; // 逐笔配对交易明细（含未平仓持仓）
}

const SMA = (arr: number[], n: number) => {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= n) sum -= arr[i - n];
    out.push(i >= n - 1 ? sum / n : NaN);
  }
  return out;
};

/** 简单 MACD（12/26/9） */
function macdLine(closes: number[]) {
  const ema = (n: number) => {
    const out: number[] = [];
    let prev = closes[0];
    const k = 2 / (n + 1);
    for (let i = 0; i < closes.length; i++) {
      prev = i === 0 ? closes[i] : closes[i] * k + prev * (1 - k);
      out.push(prev);
    }
    return out;
  };
  const dif = ema(12).map((v, i) => v - ema(26)[i]);
  const dea: number[] = [];
  let prev = dif[0];
  const k = 2 / 10;
  for (let i = 0; i < dif.length; i++) {
    prev = i === 0 ? dif[i] : dif[i] * k + prev * (1 - k);
    dea.push(prev);
  }
  return { dif, dea };
}

function rsiLine(closes: number[], n = 14) {
  const out: number[] = [];
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (i <= n) {
      gain += Math.max(ch, 0);
      loss += Math.max(-ch, 0);
      if (i === n) { gain /= n; loss /= n; out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)); }
      else out.push(NaN);
    } else {
      gain = (gain * (n - 1) + Math.max(ch, 0)) / n;
      loss = (loss * (n - 1) + Math.max(-ch, 0)) / n;
      out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
    }
  }
  return out;
}

/** 预设策略库 */
export const STRATEGIES: Strategy[] = [
  {
    id: "ma-cross",
    name: "均线金叉",
    desc: "MA5 上穿 MA20 买入，下穿卖出（趋势跟踪）",
    signal: (bars) => {
      const closes = bars.map((b) => b.close);
      const ma5 = SMA(closes, 5);
      const ma20 = SMA(closes, 20);
      return bars.map((b, i) => {
        if (i < 1 || !isFinite(ma5[i]) || !isFinite(ma20[i]) || !isFinite(ma5[i - 1]) || !isFinite(ma20[i - 1])) return { date: b.date, type: null as SignalType };
        if (ma5[i - 1] <= ma20[i - 1] && ma5[i] > ma20[i]) return { date: b.date, type: "buy" as const };
        if (ma5[i - 1] >= ma20[i - 1] && ma5[i] < ma20[i]) return { date: b.date, type: "sell" as const };
        return { date: b.date, type: null as SignalType };
      });
    },
  },
  {
    id: "breakout",
    name: "突破 20 日高点",
    desc: "收盘突破 20 日最高价买入，跌破 20 日最低价卖出",
    signal: (bars) =>
      bars.map((b, i) => {
        if (i < 20) return { date: b.date, type: null as SignalType };
        const hi20 = Math.max(...bars.slice(i - 20, i).map((x) => x.high));
        const lo20 = Math.min(...bars.slice(i - 20, i).map((x) => x.low));
        if (b.close > hi20) return { date: b.date, type: "buy" as const };
        if (b.close < lo20) return { date: b.date, type: "sell" as const };
        return { date: b.date, type: null as SignalType };
      }),
  },
  {
    id: "rsi",
    name: "RSI 超买超卖",
    desc: "RSI<30 买入，RSI>70 卖出（均值回归）",
    signal: (bars) => {
      const closes = bars.map((b) => b.close);
      const rsi = rsiLine(closes, 14);
      return bars.map((b, i) => {
        if (i < 15 || !isFinite(rsi[i])) return { date: b.date, type: null as SignalType };
        if (rsi[i] < 30) return { date: b.date, type: "buy" as const };
        if (rsi[i] > 70) return { date: b.date, type: "sell" as const };
        return { date: b.date, type: null as SignalType };
      });
    },
  },
  {
    id: "macd",
    name: "MACD 金叉死叉",
    desc: "DIF 上穿 DEA 买入，下穿卖出（动量）",
    signal: (bars) => {
      const closes = bars.map((b) => b.close);
      const { dif, dea } = macdLine(closes);
      return bars.map((b, i) => {
        if (i < 1 || !isFinite(dif[i]) || !isFinite(dea[i])) return { date: b.date, type: null as SignalType };
        if (dif[i - 1] <= dea[i - 1] && dif[i] > dea[i]) return { date: b.date, type: "buy" as const };
        if (dif[i - 1] >= dea[i - 1] && dif[i] < dea[i]) return { date: b.date, type: "sell" as const };
        return { date: b.date, type: null as SignalType };
      });
    },
  },
];

/**
 * 回测：全仓买卖（T+1 以次日开盘成交近似），含双边佣金
 */
export function backtest(bars: BacktestBar[], strategy: Strategy, initial = 100000, feeRate = 0.0003): BacktestResult | null {
  if (!bars?.length || bars.length < 30) return null;
  const signals = strategy.signal(bars);

  let cash = initial;
  let shares = 0;
  let lastBuyPrice = 0;
  let lastBuyDate = "";
  const trades: Trade[] = [];
  const equityCurve: Array<{ date: string; nav: number; benchmark: number }> = [];
  const closed: number[] = [];
  const bench0 = bars[0].close;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const sig = signals[i]?.type ?? null;
    // 次日开盘成交（模拟 T+1）
    const nextOpen = bars[Math.min(i + 1, bars.length - 1)].open;
    if (sig === "buy" && shares === 0 && cash > 0) {
      shares = cash * (1 - feeRate) / nextOpen;
      cash = 0;
      lastBuyPrice = nextOpen;
      lastBuyDate = bar.date;
    } else if (sig === "sell" && shares > 0) {
      cash = shares * nextOpen * (1 - feeRate);
      const ret = ((nextOpen - lastBuyPrice) / lastBuyPrice) * 100;
      closed.push(ret);
      trades.push({ buyDate: lastBuyDate, buyPrice: lastBuyPrice, sellDate: bar.date, sellPrice: nextOpen, retPct: ret, open: false });
      shares = 0;
    }
    const nav = cash + shares * bar.close;
    equityCurve.push({ date: bar.date, nav: Math.round(nav), benchmark: Math.round((bar.close / bench0) * initial) });
  }
  // 未平仓
  if (shares > 0) {
    trades.push({ buyDate: lastBuyDate, buyPrice: lastBuyPrice, sellDate: null, sellPrice: null, retPct: null, open: true });
  }

  const final = cash + shares * bars[bars.length - 1].close;
  const totalRet = ((final - initial) / initial) * 100;
  const years = (bars.length / 244);
  const annualRet = years > 0 ? (Math.pow(final / initial, 1 / years) - 1) * 100 : 0;

  // 最大回撤（净值曲线）
  let peak = -Infinity, maxDD = 0;
  for (const p of equityCurve) {
    peak = Math.max(peak, p.nav);
    maxDD = Math.max(maxDD, ((peak - p.nav) / peak) * 100);
  }
  // 胜率
  const winRate = closed.length ? (closed.filter((r) => r > 0).length / closed.length) * 100 : 0;
  // 夏普（日收益）
  const rets: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) rets.push(equityCurve[i].nav / equityCurve[i - 1].nav - 1);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const sd = rets.length > 1 ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) : 0;
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(244) : 0;

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    symbol: bars[0].date,
    startDate: bars[0].date,
    endDate: bars[bars.length - 1].date,
    bars: bars.length,
    totalRet: Number(totalRet.toFixed(2)),
    annualRet: Number(annualRet.toFixed(2)),
    maxDrawdown: Number(maxDD.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    tradeCount: closed.length,
    sharpe: Number(sharpe.toFixed(2)),
    initial,
    final: Math.round(final),
    equityCurve: equityCurve.filter((_, i) => i % 2 === 0 || i === equityCurve.length - 1), // 抽样减密
    signals: signals.filter((s) => s.type) as Array<{ date: string; type: "buy" | "sell" }>,
    trades,
  };
}
