/**
 * SAA/TAA 风险参数自检：协方差 / 波动率 / 相关性 / 最小方差 / 战术带宽。
 * 运行：node scripts/verify-portfolio-risk.mjs
 */
import assert from "node:assert/strict";
import {
  alignReturns, annualCovariance, annualVol, correlationMatrix,
  minVarianceWeights, portfolioVol, taaBand,
} from "../lib/data/portfolio-risk.ts";

// 两条完全同步的序列 → 相关系数必须为 1，协方差等于方差
{
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"];
  const closes = [100, 101, 102, 103];
  const { dates: d, returns: r } = alignReturns([
    { asset: "a", dates, closes },
    { asset: "b", dates, closes },
  ]);
  assert.equal(d.length, 3);
  assert.equal(r.length, 2);
  const cov = annualCovariance(r);
  assert.ok(Math.abs(cov[0][1] - cov[0][0]) < 1e-12, "同步序列协方差应等于方差");
  const corr = correlationMatrix(cov);
  assert.ok(Math.abs(corr[0][1] - 1) < 1e-6, `同步序列相关系数应为 1，实得 ${corr[0][1]}`);
}

// 完全反向的序列 → 相关系数 -1（需 ≥3 个收益率：2 个样本的样本相关恒为 +1）
{
  const r = alignReturns([
    { asset: "a", dates: ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"], closes: [100, 110, 121, 119.79] },
    { asset: "b", dates: ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"], closes: [100, 90, 81, 81.81] },
  ]).returns;
  assert.equal(r[0].length, 3, "3 个收益率才够算样本相关");
  const corr = correlationMatrix(annualCovariance(r));
  assert.ok(Math.abs(corr[0][1] + 1) < 1e-6, `反向序列相关系数应为 -1，实得 ${corr[0][1]}`);
}

// 日期不对齐 → 剔除只在其中一条序列出现的交易日，且收益率必须同期
{
  const { dates, returns } = alignReturns([
    { asset: "a", dates: ["2026-01-01", "2026-01-02", "2026-01-03"], closes: [100, 110, 121] },
    { asset: "b", dates: ["2026-01-02", "2026-01-03", "2026-01-04"], closes: [50, 55, 60.5] },
  ]);
  // 共同日期 = 01-02 / 01-03 → 只有 1 个收益率，低于可算门槛
  assert.equal(returns.length, 2);
  assert.ok(dates.length <= 2);
  const cov = annualCovariance(returns);
  // 两边都是 +10%，协方差为 0（零波动 → 对角线为 0）
  assert.equal(cov[0][0], 0);
}

// 年化：日波动 1% → 年化 ≈ 1%·√244 ≈ 15.7%
{
  const n = 40;
  const closes = [100];
  const dates = ["2026-01-01"];
  for (let i = 1; i < n; i++) {
    closes.push(closes[i - 1] * (i % 2 ? 1.01 : 1 / 1.01));
    dates.push(`2026-02-${String(i).padStart(2, "0")}`);
  }
  const { returns } = alignReturns([{ asset: "a", dates, closes }]);
  const vol = annualVol(annualCovariance(returns))[0];
  assert.ok(vol > 0.10 && vol < 0.20, `日波动 1% 年化应在 10%~20%，实得 ${vol}`);
}

// 组合波动率：单资产时等于自身波动率
{
  const cov = [[0.04]];
  assert.ok(Math.abs(portfolioVol([1], cov) - 0.2) < 1e-9);
}

// 最小方差权重必须真的最小：用站内实测的 CN/HK/US 协方差暴力搜索对拍
// （等权 13.94% 不是最优，真实最优约 12.38%）—— 曾经的前代 bug 会静默返回等权
{
  const cov = [
    [0.03258, 0.02349, 0.00434],
    [0.02349, 0.04937, 0.00733],
    [0.00434, 0.00733, 0.02259],
  ];
  const w = minVarianceWeights(cov);
  const got = portfolioVol(w, cov);
  let best = Infinity;
  for (let a = 0; a <= 200; a++)
    for (let b = 0; a + b <= 200; b++) {
      const c = 200 - a - b;
      if (!c) continue;
      const v = portfolioVol([a / 200, b / 200, c / 200], cov);
      if (v < best) best = v;
    }
  assert.ok(Math.abs(w.reduce((x, y) => x + y, 0) - 1) < 1e-6, "权重应归一");
  assert.ok(got <= best + 1e-6, `最小方差权重波动 ${got.toFixed(5)} 应不高于暴力最优 ${best.toFixed(5)}`);
  assert.ok(got < portfolioVol([1 / 3, 1 / 3, 1 / 3], cov) - 1e-4, "最小方差权重不应等于等权");
}

// 高相关时两资产应接近等权
{
  const cov = [
    [0.04, 0.039],
    [0.039, 0.04],
  ];
  const w = minVarianceWeights(cov);
  assert.ok(Math.abs(w[0] - 0.5) < 0.05, `高相关资产应接近等权，实得 ${w[0]}`);
}

// 战术带宽：目标 40% + 0.5σ，σ=20% → [30%, 50%]，且下限截 0、上限截 100%
{
  assert.deepEqual(taaBand(0.4, 0.2, 0.5), { low: 0.3, high: 0.5 });
  assert.deepEqual(taaBand(0.05, 0.4, 0.5), { low: 0, high: 0.25 });
  assert.deepEqual(taaBand(0.95, 0.4, 0.5), { low: 0.75, high: 1 });
}

// 数据不足 → 不给协方差（宁可不给分位数/矩阵，也不给半成品）
{
  const r = alignReturns([
    { asset: "a", dates: ["2026-01-01"], closes: [100] },
    { asset: "b", dates: ["2026-01-01"], closes: [100] },
  ]);
  assert.equal(r.returns.length, 0);
}

console.log("portfolio-risk: 7 组断言全过");