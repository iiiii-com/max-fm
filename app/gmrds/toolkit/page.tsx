import Link from "next/link";
import { ArrowLeft, Wrench, CandlestickChart, Radar as RadarIcon, Scale, TrendingDown, LayoutGrid } from "lucide-react";
import KlinePatternChart from "@/components/gmrds/KlinePatternChart";
import RadarChart from "@/components/gmrds/RadarChart";
import ValuationBand from "@/components/gmrds/ValuationBand";
import DrawdownChart from "@/components/gmrds/DrawdownChart";
import InteractiveKlineLab from "@/components/gmrds/InteractiveKlineLab";
import ScannerSection from "@/components/gmrds/ScannerSection";
import VizBoundary from "@/components/gmrds/VizBoundary";
import shanghaiSample from "@/data/shanghai-sample.json";
import shIndex from "@/data/sh-index.json";

export const metadata = { title: "实操工具箱 | 研究体系 GMRDS" };

/** 真实回撤统计（上证 2020 起，收盘口径自算） */
function drawdownStats() {
  const closes: Array<[string, number]> = (shIndex as [string, number, number, number, number, number][])
    .filter((b) => b[0] >= "2020-01-01")
    .map((b) => [b[0], b[2]]);
  if (closes.length < 2) return { stats: [], dd: [] };
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push((closes[i][1] / closes[i - 1][1] - 1) * 100);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length);
  const annRet = (Math.pow(closes[closes.length - 1][1] / closes[0][1], 252 / rets.length) - 1) * 100;
  const annVol = sd * Math.sqrt(252);
  const sharpe = (annRet - 2) / annVol;
  let peak = closes[0][1];
  let maxDD = 0;
  const dd: Array<{ date: string; dd: number }> = [];
  for (const [d, c] of closes) {
    if (c > peak) peak = c;
    const cur = (c / peak - 1) * 100;
    if (cur < maxDD) maxDD = cur;
    dd.push({ date: d, dd: Math.round(cur * 100) / 100 });
  }
  return {
    stats: [
      { label: "年化收益", value: `${annRet.toFixed(1)}%`, tone: annRet >= 0 ? ("up" as const) : ("down" as const) },
      { label: "年化波动", value: `${annVol.toFixed(1)}%`, tone: "plain" as const },
      { label: "夏普比率", value: sharpe.toFixed(2), tone: "plain" as const },
      { label: "最大回撤", value: `${maxDD.toFixed(1)}%`, tone: "down" as const },
      { label: "样本", value: `${closes.length} 交易日`, tone: "plain" as const },
    ],
    dd,
  };
}

export default function ToolkitPage() {
  // 真实数据：上证 2024-08 ~ 2025-06（219 根，腾讯日线）
  const bars = shanghaiSample as Array<{ date: string; open: number; close: number; high: number; low: number; volume: number }>;
  const risk = drawdownStats();
  const scanBars = (shIndex as [string, number, number, number, number, number][])
    .filter((b) => b[0] >= "2024-01-01")
    .map((b) => ({ date: b[0], open: b[1], close: b[2], high: b[3], low: b[4], volume: Math.round(b[5]) }));

  // 买卖点标注（基于真实行情验证的关键点位）
  const marks = [
    { date: "2024-09-24", label: "政策反转 · 买入", type: "buy" as const },
    { date: "2024-10-08", label: "高点 3489 · 减仓", type: "sell" as const },
    { date: "2024-11-27", label: "回踩 · 观察", type: "hold" as const },
    { date: "2025-02-19", label: "突破前高 · 加仓", type: "buy" as const },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">实操工具箱</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">可视化实操工具箱</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          把「十一环节」的判断标准落成可视化工具：K 线形态与买卖点识别（真实行情）、
          多维评估雷达图、估值区间测算。数据均为可溯源真实值或标注案例教学值。
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <a href="#kline" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium">
            <CandlestickChart className="w-3.5 h-3.5" /> K线形态与买卖点
          </a>
          <a href="#radar" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:border-primary/50">
            <RadarIcon className="w-3.5 h-3.5" /> 多维评估雷达
          </a>
          <a href="#valuation" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:border-primary/50">
            <Scale className="w-3.5 h-3.5" /> 估值区间测算
          </a>
        </div>
      </section>

      {/* 交互式 K 线实验台 */}
      <section id="lab" className="scroll-mt-20">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <LayoutGrid className="w-4.5 h-4.5 text-primary" /> 交互式 K 线实验台 · 多周期 / 指标 / 回放
        </h2>
        <VizBoundary name="交互式K线实验台">
          <InteractiveKlineLab
            data={(shIndex as [string, number, number, number, number, number][]).filter((b) => b[0] >= "2020-01-01").map((b) => ({
              date: b[0], open: b[1], close: b[2], high: b[3], low: b[4], volume: b[5],
            }))}
          />
        </VizBoundary>
      </section>

      {/* K线形态与买卖点 */}
      <section id="kline" className="scroll-mt-20">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <CandlestickChart className="w-4.5 h-4.5 text-primary" /> 环节 7 · K线形态与买卖点识别
        </h2>
        <VizBoundary name="K线形态与买卖点">
          <KlinePatternChart
            bars={bars}
            marks={marks}
            title="上证综指 2024-08 ~ 2025-06（真实日线）· 形态与买卖点"
            height={420}
            caption={
              "图注：真实行情（腾讯日线）。2024-09-24 政策组合拳放量突破（买入点）；2024-10-08 冲高 3489.78 后见顶（减仓）；" +
              "2025 年 2 月放量突破前高确认趋势延续（加仓）。判定标准：① 放量突破 = 有效；② 缩量回踩 = 观察；③ 高点放量滞涨 = 减仓。"
            }
          />
        </VizBoundary>
      </section>

      {/* 多维评估雷达 */}
      <section id="radar" className="scroll-mt-20">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <RadarIcon className="w-4.5 h-4.5 text-primary" /> 环节 5 · 企业财务质量多维评估雷达
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VizBoundary name="财务质量雷达">
            <RadarChart
              dims={[
                { name: "盈利能力", max: 10 },
                { name: "成长性", max: 10 },
                { name: "现金流质量", max: 10 },
                { name: "财务稳健", max: 10 },
                { name: "盈利真实性", max: 10 },
              ]}
              series={[
                { name: "优质公司（可口可乐型）", values: [9, 6, 9, 8, 9], color: "#16a34a" },
                { name: "造假公司（安然/瑞幸型）", values: [7, 8, 2, 2, 1], color: "#d7000b" },
              ]}
              title="财务质量五维雷达 · 优质 vs 造假（案例教学值）"
              caption="图注：数值为案例特征教学值（非实时财务）。核心差异在「现金流质量」与「盈利真实性」两维——造假公司利润表好看但现金流与勾稽关系崩塌（安然：经营现金流/净利长期 <0.7；瑞幸：单店销量异常远超同业）。"
            />
          </VizBoundary>
          <VizBoundary name="流动性风险雷达">
            <RadarChart
              dims={[
                { name: "流动性", max: 10 },
                { name: "杠杆", max: 10 },
                { name: "资产质量", max: 10 },
                { name: "期限匹配", max: 10 },
                { name: "抗冲击", max: 10 },
              ]}
              series={[
                { name: "健康银行", values: [8, 4, 8, 7, 8], color: "#16a34a" },
                { name: "雷曼型（2008）", values: [2, 9, 3, 2, 1], color: "#d7000b" },
              ]}
              title="流动性-杠杆风险雷达 · 健康 vs 雷曼型（案例教学值）"
              caption="图注：数值为案例特征教学值。雷曼 30 倍杠杆 + 资产流动性差 + 期限错配，在回购融资枯竭时崩塌——风控雷达的「杠杆」与「期限匹配」两维是硬约束。"
            />
          </VizBoundary>
        </div>
      </section>

      {/* 估值区间 */}
      <section id="valuation" className="scroll-mt-20">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <Scale className="w-4.5 h-4.5 text-primary" /> 环节 6 · 估值区间测算
        </h2>
        <VizBoundary name="估值区间">
          <ValuationBand
            items={[
              {
                name: "贵州茅台 600519",
                pe: 17.87,
                band: [15, 30],
                note: "当前 PE 17.87 为东财实时（2026-08-25）；白酒板块历史 PE 中枢约 25-30，低分位约 15-18（公开估值口径）",
              },
              {
                name: "上证综指全市场",
                pe: null,
                band: [11, 16],
                note: "当前全市场 PE 待接口接入；历史区间约 11-16 倍（公开估值统计）",
              },
            ]}
            title="估值区间：当前 PE vs 合理区间"
            caption="图注：条形为合理区间（方法论测算输入），圆点为当前 PE（真实接口值，灰点=待接入）。当前值低于区间下限（绿）→ 低估区；高于上限（红）→ 高估区；区间内（蓝）→ 合理。区间边界为研究设定输入，随盈利预期更新。"
          />
        </VizBoundary>
      </section>

      {/* 买卖点扫描（规则引擎 + CSV 导入） */}
      <section id="scanner" className="scroll-mt-20">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <CandlestickChart className="w-4.5 h-4.5 text-primary" /> 环节 7 · 买卖点扫描器（判断标准 + 经典形态）
        </h2>
        <VizBoundary name="买卖点扫描器">
          <ScannerSection defaultBars={scanBars} />
        </VizBoundary>
      </section>

      {/* 回撤与风险统计 */}
      <section id="risk" className="scroll-mt-20">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-3">
          <TrendingDown className="w-4.5 h-4.5 text-primary" /> 环节 9 · 回撤与风险统计（真实数据自算）
        </h2>
        <VizBoundary name="回撤与风险统计">
          <DrawdownChart
            ddSeries={risk.dd}
            stats={risk.stats}
            title="上证综指回撤曲线（2020-01 ~ 2026-08，收盘口径）"
            caption={
              "图注：真实行情自算（腾讯日线）。最大回撤发生在 2022 年（宏观紧缩 + 流动性收紧）；2024-2025 年修复至新高。" +
              "判定标准（环节 9）：最大回撤 >20% 触发组合审查；年化波动 >30% 为高危；夏普 <0.5 需重新评估风险预算。"
            }
          />
        </VizBoundary>
      </section>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/gmrds/flow" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 十一环节详解
        </Link>
        <Link href="/gmrds/cases" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          查看真实案例库 <Wrench className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
