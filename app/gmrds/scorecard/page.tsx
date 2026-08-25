import Link from "next/link";
import { ArrowLeft, Gauge } from "lucide-react";
import ScorecardLab from "@/components/gmrds/ScorecardLab";
import shIndex from "@/data/sh-index.json";
import { scanSignals } from "@/lib/data/rule-engine";

export const metadata = { title: "全流程评分示例 | 研究体系 GMRDS" };

/** 真实数据自动评分 */
function autoScores() {
  const rows = (shIndex as [string, number, number, number, number, number][]).filter((b) => b[0] >= "2024-01-01");
  const closes = rows.map((b) => b[2]);
  const last = closes[closes.length - 1];
  // 环节1 宏观：近 1 年涨跌幅 → 评分
  const y1 = closes[closes.length - 1 - 250] ?? closes[0];
  const chg1y = ((last - y1) / y1) * 100;
  const macro = clamp(Math.round((chg1y / 6) * 2) / 2, -5, 5);
  // 环节3 周期：收盘 vs 250 日均线
  const ma250 = closes.slice(-250).reduce((a, b) => a + b, 0) / 250;
  const vsMa = ((last - ma250) / ma250) * 100;
  const cycle = clamp(Math.round((vsMa / 5) * 2) / 2, -5, 5);
  // 环节6 估值：茅台 PE 17.87（东财实时）
  const pe = 17.87;
  const val = pe < 15 ? 3 : pe < 25 ? 1 : pe < 35 ? -1 : -3;
  // 环节7 技术：买卖点扫描净信号
  const signals = scanSignals(rows.map((b) => ({ date: b[0], open: b[1], close: b[2], high: b[3], low: b[4], volume: Math.round(b[5]) })));
  const net = signals.filter((s) => s.type === "buy").length - signals.filter((s) => s.type === "sell").length;
  const tech = clamp(Math.round(net * 1.2), -5, 5);
  // 环节9 风险：年化波动（近 250 日）
  const rets = closes.slice(-250).map((c, i) => (i === 0 ? 0 : (c / closes[closes.length - 250 + i - 1] - 1) * 100)).slice(1);
  const vol = Math.sqrt(rets.reduce((a, r) => a + r * r, 0) / rets.length) * Math.sqrt(252);
  const risk = vol > 32 ? -3 : vol > 26 ? -1 : vol > 20 ? 1 : 2;

  return {
    macro: { v: macro, basis: `上证近 1 年涨跌 ${chg1y.toFixed(1)}%（真实日线自算）→ 评分 ${macro}` },
    cycle: { v: cycle, basis: `上证收盘 vs 250 日均线偏离 ${vsMa.toFixed(1)}%（真实自算）→ 评分 ${cycle}` },
    val: { v: val, basis: `茅台 PE ${pe}（东财实时 2026-08-25）→ 评分 ${val}` },
    tech: { v: tech, basis: `买卖点扫描：买 ${signals.filter((s) => s.type === "buy").length} / 卖 ${signals.filter((s) => s.type === "sell").length}，净 ${net} → 评分 ${tech}` },
    risk: { v: risk, basis: `上证年化波动 ${vol.toFixed(0)}%（近 250 日真实自算）→ 评分 ${risk}` },
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function GmrdsScorecardPage() {
  const a = autoScores();

  const defs = [
    { no: 1, label: "宏观研判", weight: 12, auto: a.macro.v, basis: a.macro.basis },
    { no: 2, label: "流动性评估", weight: 12, auto: 0, basis: "手动输入：央行利率方向 / 两融 / DR007（数据源接入后自动）" },
    { no: 3, label: "周期定位", weight: 12, auto: a.cycle.v, basis: a.cycle.basis },
    { no: 4, label: "行业景气", weight: 12, auto: 0, basis: "手动输入：行业景气度 / 拥挤度（行业资金接口接入后自动）" },
    { no: 5, label: "盈利评估", weight: 12, auto: 0, basis: "手动输入：ROE / 现金流质量 / 护城河评分（财报接口接入后自动）" },
    { no: 6, label: "估值判断", weight: 12, auto: a.val.v, basis: a.val.basis },
    { no: 7, label: "技术确认", weight: 10, auto: a.tech.v, basis: a.tech.basis },
    { no: 8, label: "情绪评估", weight: 10, auto: 0, basis: "手动输入：成交额 / 两融 / 贪婪-恐慌指数（数据接入后自动）" },
    { no: 9, label: "风险评估", weight: 8, auto: a.risk.v, basis: a.risk.basis },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">全流程评分示例</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">十一环节全流程评分 · 真实数据演示</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          环节 1-9 逐项评分（真实数据自动计算 + 手动覆写）→ 加权综合 → 环节 10 仓位决策 →
          环节 11 复盘建议。演示数据：上证综指日线（2024 起）、贵州茅台估值（东财实时）、
          买卖点规则引擎扫描——全部可溯源。
        </p>
      </section>

      <ScorecardLab defs={defs} />

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/gmrds/toolkit" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 实操工具箱
        </Link>
        <p className="text-[10px] text-muted flex items-center gap-1"><Gauge className="w-3 h-3" /> 演示评分基于真实数据；权重为框架设定，待 V2.0 回测校准</p>
      </div>
    </div>
  );
}
