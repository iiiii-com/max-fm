/**
 * SAA / TAA 配置模型的量化底座：年化协方差矩阵 + 波动率 + 战术偏离区间。
 *
 * 为什么必须自算：
 *   SAA 目标比例若只按风险偏好给固定数字（股 60 / 债 25 / 黄金 10），
 *   就答不了两个问题——「这个组合历史上波动多大」「各资产是不是在同涨同跌」。
 *   协方差矩阵正是这两问的唯一输入，也是 TAA 偏离带宽的依据。
 *   全部输出可由输入序列复算，不含任何外部假设常数。
 */

/** 年化交易日数（A 股一年约 244 个交易日） */
export const TRADING_DAYS = 244;

export interface PriceSeries {
  asset: string;
  /** YYYY-MM-DD，升序 */
  dates: string[];
  closes: number[];
}

/**
 * 按**共同日期**对齐多条价格序列，并算出日收益率。
 * 任一资产缺失的交易日整行剔除 —— 收益率必须同期，否则协方差没有意义。
 */
export function alignReturns(series: PriceSeries[]): { dates: string[]; returns: number[][] } {
  const usable = series.filter((s) => s.dates.length >= 2 && s.dates.length === s.closes.length);
  if (!usable.length) return { dates: [], returns: [] };

  // date -> 各资产该日收盘价
  const maps = usable.map((s) => {
    const m = new Map<string, number>();
    s.dates.forEach((d, i) => m.set(d, s.closes[i]));
    return m;
  });

  const common = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort();
  if (common.length < 2) return { dates: [], returns: [] };

  const returns: number[][] = usable.map((_, k) => {
    const out: number[] = [];
    for (let i = 1; i < common.length; i++) {
      const prev = maps[k].get(common[i - 1])!;
      const cur = maps[k].get(common[i])!;
      // 停牌/零价导致的伪收益直接跳过，不当作 0 抹平
      if (prev > 0 && cur > 0) out.push(cur / prev - 1);
    }
    return out;
  });

  // 停牌过滤后各资产长度可能不同，协方差只在等长时成立
  const n = Math.min(...returns.map((r) => r.length));
  return { dates: common.slice(1, 1 + n), returns: returns.map((r) => r.slice(0, n)) };
}

/** 样本协方差矩阵 × 年化因子 */
export function annualCovariance(returns: number[][]): number[][] {
  const k = returns.length;
  if (!k) return [];
  const n = returns[0].length;
  if (n < 2) return Array.from({ length: k }, () => Array(k).fill(0));

  const means = returns.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const cov: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      let s = 0;
      for (let t = 0; t < n; t++) s += (returns[i][t] - means[i]) * (returns[j][t] - means[j]);
      const v = (s / (n - 1)) * TRADING_DAYS;
      cov[i][j] = v;
      cov[j][i] = v;
    }
  }
  return cov;
}

/** 年化波动率 = 协方差对角线开方 */
export function annualVol(cov: number[][]): number[] {
  return cov.map((row, i) => Math.sqrt(Math.max(row[i], 0)));
}

/** 相关系数 = cov / (σi·σj)；σ 为 0（无波动）时无相关性可言，记 0 */
export function correlationMatrix(cov: number[][]): number[][] {
  const v = annualVol(cov);
  return cov.map((row, i) =>
    row.map((cell, j) => {
      const d = v[i] * v[j];
      return d > 0 ? Number((cell / d).toFixed(4)) : 0;
    })
  );
}

/** 组合年化波动率 = sqrt(wᵀΣw) */
export function portfolioVol(weights: number[], cov: number[][]): number {
  let s = 0;
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights.length; j++) s += weights[i] * cov[i][j] * weights[j];
  return Math.sqrt(Math.max(s, 0));
}

/**
 * 最小方差权重（无约束等式解 Σw = 1，仅作风险平价参考）。
 * 消元后必须**回代**求解；按行直接除是前代，只在带状矩阵上碰巧成立。
 * 用 Σ⁻¹·1 归一化；矩阵接近奇异时退回等权 —— 这时协方差本身就不可信。
 */
export function minVarianceWeights(cov: number[][]): number[] {
  const k = cov.length;
  const ones = Array(k).fill(1);
  // 高斯消元解 Σx = 1
  const A = cov.map((r, i) => [...r, ones[i]]);
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return ones.map(() => 1 / k);
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = c + 1; r < k; r++) {
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  // 回代：x[i] = (b[i] - Σ_{j>i} a[i][j]·x[j]) / a[i][i]
  const x = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let s = A[i][k];
    for (let j = i + 1; j < k; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  const sum = x.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum === 0) return ones.map(() => 1 / k);
  return x.map((v) => Math.max(v / sum, 0));
}

/** 风险偏好 1-5 → 权益/固收/黄金/现金 目标总额。
 *  这是框架设定（待回测校准），不是回测结论 —— 别把它当成最优解。 */
export const SLEEVE_TOTAL: Record<number, { equity: number; bond: number; gold: number }> = {
  1: { equity: 0.2, bond: 0.55, gold: 0.1 },
  2: { equity: 0.2, bond: 0.55, gold: 0.1 },
  3: { equity: 0.4, bond: 0.4, gold: 0.1 },
  4: { equity: 0.6, bond: 0.25, gold: 0.1 },
  5: { equity: 0.6, bond: 0.25, gold: 0.1 },
};

/**
 * 权益内部按 1/σ 分配（风险平价直觉）：波动大的自动少配。
 * vol 为空或全 0 时退回等权 —— 没有波动数据就不该假装有风险偏好。
 */
export function inverseVolShare(vol: number[]): number[] {
  const inv = vol.map((v) => (v > 0 ? 1 / v : Infinity));
  const sum = inv.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum <= 0) return vol.map(() => 1 / vol.length);
  return inv.map((v) => v / sum);
}

/**
 * 战术偏离带宽：目标比例 ± k 倍该资产年化波动率。
 * 含义是「主动偏离超过 k 个标准差就属于赌方向而不是配权重」，与再平衡阈值同源。
 * 带宽下限截 0（不做空），上限截 100%。
 */
export function taaBand(target: number, vol: number, k = 0.5): { low: number; high: number } {
  const w = k * vol;
  return {
    low: Math.max(0, Number((target - w).toFixed(4))),
    high: Math.min(1, Number((target + w).toFixed(4))),
  };
}