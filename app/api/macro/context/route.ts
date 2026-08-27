import { NextResponse } from "next/server";
import shIndex from "@/data/sh-index.json";

export const dynamic = "force-dynamic";

/**
 * 宏观环境实时研判（真实数据自算）
 * 输入：上证综指日线（data/sh-index.json）
 * 输出：近 1 年涨跌 / 距 250 日线 / 年化波动 → 宏观评分与结论（对应 GMRDS 环节 1 宏观研判 + 环节 3 周期定位）
 */
export async function GET() {
  const bars = shIndex as Array<[string, number, number, number, number, number]>;
  if (!bars?.length) return NextResponse.json({ error: "无数据" }, { status: 500 });

  const closes = bars.map((b) => Number(b[2]));
  const last = closes[closes.length - 1];

  // 近 1 年（约 250 交易日）
  const yAgo = closes[Math.max(0, closes.length - 251)];
  const yearChg = ((last - yAgo) / yAgo) * 100;

  // 距 250 日线
  const ma250 = closes.slice(-250).reduce((a, b) => a + b, 0) / Math.min(250, closes.length);
  const vsMa250 = ((last - ma250) / ma250) * 100;

  // 年化波动（近 60 日收益标准差）
  const rets: number[] = [];
  for (let i = closes.length - 60; i < closes.length; i++) {
    if (i > 0 && closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
  const annVol = Math.sqrt(variance) * Math.sqrt(250) * 100;

  // 宏观阶段判定（真实数据驱动）
  let stage: string;
  let score: number;
  if (yearChg > 15) { stage = "扩张期"; score = 78; }
  else if (yearChg > 0) { stage = "复苏期"; score = 65; }
  else if (yearChg > -10) { stage = "放缓期"; score = 48; }
  else { stage = "收缩期"; score = 30; }

  // 资产偏好（环节 4 传导）
  const equityPref = vsMa250 > 0 ? "权益偏进攻" : "权益偏防御";

  return NextResponse.json({
    ok: true,
    updated: bars[bars.length - 1][0],
    index: { name: "上证综指", close: last, yearChg: Number(yearChg.toFixed(2)), vsMa250: Number(vsMa250.toFixed(2)), annVol: Number(annVol.toFixed(1)) },
    macro: { stage, score, equityPref, summary: `近 1 年 ${yearChg >= 0 ? "+" : ""}${yearChg.toFixed(1)}%，${stage}（环节 1 宏观研判）· 指数${vsMa250 >= 0 ? "站上" : "低于"}250 日线（${vsMa250 >= 0 ? "+" : ""}${vsMa250.toFixed(1)}%），${equityPref}` },
  });
}
