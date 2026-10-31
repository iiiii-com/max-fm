"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download } from "lucide-react";
import type {
  MonthlyFeelingInfo,
  MonthlyIndicatorRow,
  MonthlyTemperatureInfo,
} from "@/lib/data/monthly-report";

/**
 * 专业版：宏观深度数据台。
 *
 * 普通版 /macro 已有：温度计 + 三因子拆解 + 单指标走势 + 传导观察 + AI 月报。
 * 这里多出的是「研究口径的底表」：24 项指标最新/上期/变化一览、温度三因子得分历史、
 * 以及一键导出 CSV / Markdown —— 能粘进自己的周报，也能核对每个数字的来源与日期。
 * 数据全部来自 DB（server 端组装后传入），不做任何推导填充。
 */

export interface MacroDeepPanelProps {
  ym: string;
  monthLabel: string;
  generatedAt: string;
  indicators: MonthlyIndicatorRow[];
  temperature: MonthlyTemperatureInfo;
  feeling: MonthlyFeelingInfo;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function fmtVal(v: number | null, unit: string): string {
  if (v == null) return "—";
  if (unit === "%") return `${round2(v)}%`;
  if (unit === "点") return round2(v).toFixed(1);
  return `${round2(v)}${unit}`;
}

function fmtChange(row: MonthlyIndicatorRow): string {
  if (row.prevValue == null) return "—";
  const d = row.value - row.prevValue;
  const s = d >= 0 ? "+" : "";
  return `${s}${round2(d)}${row.unit === "点" ? "点" : row.unit === "%" ? "个百分点" : row.unit}`;
}

export default function MacroDeepPanel({
  monthLabel,
  generatedAt,
  indicators,
  temperature,
  feeling,
}: MacroDeepPanelProps) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("全部");
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => {
    const set = new Set(indicators.map((i) => i.group));
    return ["全部", ...Array.from(set)];
  }, [indicators]);

  const rows = useMemo(() => {
    const key = q.trim();
    return indicators.filter(
      (i) => (group === "全部" || i.group === group) && (!key || i.title.includes(key) || i.type.includes(key)),
    );
  }, [indicators, group, q]);

  const tempSeries = temperature.series.slice(-12);

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push(`宏观深度数据台 · ${monthLabel}`);
    lines.push(`导出时间,${new Date().toLocaleString("zh-CN", { hour12: false })}`);
    lines.push(`数据组装时间,${new Date(generatedAt).toLocaleString("zh-CN", { hour12: false })}`);
    lines.push("");
    lines.push("指标,分组,最新值,单位,数据日期,上期值,上期日期,变化");
    for (const r of indicators) {
      lines.push(
        [r.title, r.group, round2(r.value), r.unit, r.date, r.prevValue == null ? "" : round2(r.prevValue), r.prevDate ?? "", fmtChange(r)].join(","),
      );
    }
    lines.push("");
    lines.push("宏观温度（月）");
    lines.push("月份,温度");
    for (const p of tempSeries) lines.push([p.date, round2(p.temperature)].join(","));
    if (temperature.raw && temperature.scores) {
      lines.push("");
      lines.push("三因子（最新）");
      lines.push("因子,原始值,得分,权重");
      lines.push(["PMI", temperature.raw.pmi ?? "", temperature.scores.pmi, "0.4"].join(","));
      lines.push(["CPI", temperature.raw.cpi ?? "", temperature.scores.cpi, "0.35"].join(","));
      lines.push(["M2", temperature.raw.m2 ?? "", temperature.scores.m2, "0.25"].join(","));
    }
    lines.push("");
    lines.push("体感问卷");
    lines.push(["均值", feeling.overall == null ? "" : round2(feeling.overall), "样本数", feeling.sampleCount].join(","));
    lines.push("");
    lines.push("口径：指标来自 economic_indicators（东方财富数据中心同步）；温度为 PMI/CPI/M2 三因子加权合成；体感均值来自站点问卷，样本不足时不计算温差。");
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `macro-deep-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMarkdown = async () => {
    const lines: string[] = [];
    lines.push(`### 宏观深度数据台 · ${monthLabel}`);
    lines.push("");
    lines.push(`- 宏观温度：${temperature.temperature == null ? "—" : round2(temperature.temperature)}（${temperature.date ?? "—"}）`);
    lines.push(`- 体感均值：${feeling.overall == null ? "样本不足" : round2(feeling.overall)}（样本 ${feeling.sampleCount}）`);
    lines.push(`- 温差：${feeling.diff == null ? "—" : `${feeling.diff > 0 ? "+" : ""}${round2(feeling.diff)}`}`);
    lines.push("");
    lines.push("| 指标 | 分组 | 最新值 | 日期 | 变化 |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const r of indicators) {
      lines.push(`| ${r.title} | ${r.group} | ${fmtVal(r.value, r.unit)} | ${r.date} | ${fmtChange(r)} |`);
    }
    lines.push("");
    lines.push("口径：数字全部来自 economic_indicators；温差 = 宏观温度 − 体感均值。");
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="card p-3">
          <p className="text-[10px] text-muted">宏观温度</p>
          <p className="text-xl font-black font-mono">{temperature.temperature == null ? "—" : round2(temperature.temperature)}</p>
          <p className="text-[10px] text-muted">{temperature.date ?? "暂无数据"}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-muted">体感均值</p>
          <p className="text-xl font-black font-mono">{feeling.overall == null ? "—" : round2(feeling.overall)}</p>
          <p className="text-[10px] text-muted">样本 {feeling.sampleCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-muted">温差（宏观 − 体感）</p>
          <p className={`text-xl font-black font-mono ${feeling.diff == null ? "" : feeling.diff > 0 ? "up" : "down"}`}>
            {feeling.diff == null ? "—" : `${feeling.diff > 0 ? "+" : ""}${round2(feeling.diff)}`}
          </p>
          <p className="text-[10px] text-muted">{feeling.diff == null ? "样本不足不计算" : "正 = 宏观暖于体感"}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-muted">指标覆盖</p>
          <p className="text-xl font-black font-mono">{indicators.length}</p>
          <p className="text-[10px] text-muted">{monthLabel} · {groups.length - 1} 个分组</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <p className="text-xs font-bold">指标底表（最新 / 上期 / 变化）</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="筛选指标…"
              className="text-[11px] rounded-md border border-border px-2 py-1 w-32 bg-transparent"
            />
            <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={`px-2 py-1 ${group === g ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
            <button
              onClick={copyMarkdown}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border hover:border-primary/50"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? "已复制" : "Markdown"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-muted text-left border-b border-border">
                <th className="py-1.5 pr-2 font-medium">指标</th>
                <th className="py-1.5 pr-2 font-medium">分组</th>
                <th className="py-1.5 pr-2 font-medium text-right">最新值</th>
                <th className="py-1.5 pr-2 font-medium">数据日期</th>
                <th className="py-1.5 pr-2 font-medium text-right">上期值</th>
                <th className="py-1.5 pr-2 font-medium text-right">变化</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.type} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-2 font-medium">{r.title}</td>
                  <td className="py-1.5 pr-2 text-muted">{r.group}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{fmtVal(r.value, r.unit)}</td>
                  <td className="py-1.5 pr-2 text-muted font-mono text-[10px]">{r.date}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-muted">{r.prevValue == null ? "—" : fmtVal(r.prevValue, r.unit)}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{fmtChange(r)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted">没有匹配的指标</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted mt-2 leading-relaxed">
          变化 = 最新值 − 上期值（百分点/点/同单位）；分组为站点内容分类。数字未做季节调整，比较时注意口径。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-bold mb-2">三因子拆解（最新）</p>
          {temperature.raw && temperature.scores ? (
            <div className="space-y-2 text-[11px]">
              {[
                { name: "PMI（权重 40%）", raw: temperature.raw.pmi, score: temperature.scores.pmi, w: 40 },
                { name: "CPI（权重 35%）", raw: temperature.raw.cpi, score: temperature.scores.cpi, w: 35 },
                { name: "M2（权重 25%）", raw: temperature.raw.m2, score: temperature.scores.m2, w: 25 },
              ].map((f) => (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{f.name}</span>
                    <span className="font-mono text-muted">
                      原始 {f.raw == null ? "—" : round2(f.raw)} → 得分 {f.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded bg-muted/20 overflow-hidden">
                    <div className="h-full rounded bg-primary" style={{ width: `${Math.max(2, Math.min(100, f.score))}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted leading-relaxed pt-1">
                合成口径：temperature = 0.4×PMI 得分 + 0.35×CPI 得分 + 0.25×M2 得分，50 为中性线；
                得分是分段线性映射，用于横向比较而非预测。
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted">三因子明细暂不可用（温度行缺少 components，可用指标回算）</p>
          )}
        </div>

        <div className="card p-4">
          <p className="text-xs font-bold mb-2">温度月度序列（近 {tempSeries.length} 个月）</p>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted text-left border-b border-border">
                <th className="py-1.5 pr-2 font-medium">月份</th>
                <th className="py-1.5 font-medium text-right">温度</th>
                <th className="py-1.5 font-medium text-right">相对上月</th>
              </tr>
            </thead>
            <tbody>
              {tempSeries.map((p, i) => {
                const prev = tempSeries[i - 1];
                const d = prev ? p.temperature - prev.temperature : null;
                return (
                  <tr key={p.date} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-2 font-mono">{p.date}</td>
                    <td className="py-1.5 text-right font-mono font-medium">{round2(p.temperature)}</td>
                    <td className={`py-1.5 text-right font-mono ${d == null ? "text-muted" : d > 0 ? "up" : "down"}`}>
                      {d == null ? "—" : `${d > 0 ? "+" : ""}${round2(d)}`}
                    </td>
                  </tr>
                );
              })}
              {tempSeries.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-5 text-center text-muted">暂无温度序列</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-[10px] text-muted mt-2">
            想看图与体感对比？<Link href="/macro/feeling" className="text-primary hover:underline">打开体感温度页</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
