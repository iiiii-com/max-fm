import { NextResponse } from "next/server";
import { fetchIndexKlineMulti } from "@/lib/data/index-kline";
import {
  alignReturns, annualCovariance, annualVol, correlationMatrix,
  inverseVolShare, minVarianceWeights, portfolioVol, taaBand,
  SLEEVE_TOTAL, TRADING_DAYS,
  type PriceSeries,
} from "@/lib/data/portfolio-risk";

export const dynamic = "force-dynamic";

/**
 * SAA/TAA 风险参数接口：拉多市场指数日线 → 自算协方差矩阵 → 给目标比例与战术偏离带宽。
 *
 * 为什么用指数而不是个股：协方差要的是资产的系统风险，指数序列噪音小、不受个股事件干扰，
 * 且站内 /api/index/kline 已有多年数据（含多源容错）。
 * 债券与黄金的权重沿用风险偏好的既定框架，只把**权益部分**按真实波动率再分配。
 */

/** 权益 Sleeve：只用站内已验证可取的指数 */
const EQUITY = [
  { key: "cn", name: "A股（沪深300）", secid: "1.000300" },
  { key: "hk", name: "港股（恒生）", secid: "100.HSI" },
  { key: "us", name: "美股（标普500）", secid: "100.SPX" },
];

/** 风险偏好 → 权益/固收/黄金/现金 目标总额，见 lib/data/portfolio-risk.ts 的 SLEEVE_TOTAL */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // 协方差要看清一整轮周期，800 根≈3.3 年足够稳定；上限锁死避免被参数放大成本
  const days = Math.min(2000, Math.max(300, Number(searchParams.get("days") ?? 800)));
  const risk = Math.min(5, Math.max(1, Number(searchParams.get("risk") ?? 3)));

  const series: PriceSeries[] = [];
  const missing: string[] = [];

  const results = await Promise.all(
    EQUITY.map(async (e) => {
      const { bars } = await fetchIndexKlineMulti(e.secid, days);
      if (!bars.length) return null;
      return {
        asset: e.key,
        dates: bars.map((b) => b.date),
        closes: bars.map((b) => b.close),
      } satisfies PriceSeries;
    })
  );

  results.forEach((r, i) => {
    if (r) series.push(r);
    else missing.push(EQUITY[i].name);
  });

  const { dates, returns } = alignReturns(series);
  if (returns.length < 2 || returns[0].length < 60) {
    return NextResponse.json(
      {
        ok: false,
        missing,
        error: `可用资产不足（仅 ${returns.length} 条 / 共同交易日 ${returns[0]?.length ?? 0}），协方差不可计算`,
      },
      { status: 503 }
    );
  }

  const cov = annualCovariance(returns);
  const vol = annualVol(cov);
  const corr = correlationMatrix(cov);
  const names = series.map((s) => EQUITY.find((e) => e.key === s.asset)!.name);
  const keys = series.map((s) => s.asset);

  const sleeveShare = inverseVolShare(vol);

  const total = SLEEVE_TOTAL[risk] ?? SLEEVE_TOTAL[3];
  const minVar = minVarianceWeights(cov);
  const equal = series.map(() => 1 / series.length);

  const assets = keys.map((key, i) => {
    const target = total.equity * sleeveShare[i];
    return {
      key,
      name: names[i],
      vol: Number(vol[i].toFixed(4)),
      target: Number(target.toFixed(4)),
      band: taaBand(target, vol[i]),
    };
  });

  // 权益部分的三种口径对照：等权 / 逆波动率(SAA) / 最小方差
  const equityRisk = {
    equalWeight: Number(portfolioVol(equal, cov).toFixed(4)),
    inverseVol: Number(portfolioVol(sleeveShare, cov).toFixed(4)),
    minVariance: Number(portfolioVol(minVar, cov).toFixed(4)),
    minVarianceWeights: minVar.map((v) => Number(v.toFixed(4))),
  };

  return NextResponse.json(
    {
      ok: true,
      updated: new Date().toISOString(),
      window: { from: dates[0], to: dates[dates.length - 1], sessions: dates.length, tradingDaysPerYear: TRADING_DAYS },
      assets,
      nonEquity: { bond: total.bond, gold: total.gold, cash: Number((1 - total.equity - total.bond - total.gold).toFixed(4)) },
      equityRisk,
      vol: vol.map((v) => Number(v.toFixed(4))),
      corr,
      missing,
      note: "债券/黄金/现金比例沿用风险偏好框架设定，非回测结论；权益内部比例由上表协方差矩阵自算。",
    },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } }
  );
}