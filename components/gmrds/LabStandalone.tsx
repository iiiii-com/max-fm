"use client";

import { useEffect, useState } from "react";
import InteractiveKlineLab from "./InteractiveKlineLab";
import { scanSignals } from "@/lib/data/rule-engine";

interface LabSymbol {
  label: string;
  name: string;
  secid: string;
  kind: "index" | "stock";
}

/** 预设标的：A 股指数/个股 + 全球指数（数据走多源容错 API） */
const LAB_SYMBOLS: LabSymbol[] = [
  { label: "🇨🇳 上证指数", name: "上证指数", secid: "1.000001", kind: "index" },
  { label: "🇨🇳 创业板指", name: "创业板指", secid: "0.399006", kind: "index" },
  { label: "🇨🇳 贵州茅台", name: "贵州茅台", secid: "1.600519", kind: "stock" },
  { label: "🇨🇳 宁德时代", name: "宁德时代", secid: "0.300750", kind: "stock" },
  { label: "🇺🇸 标普500", name: "标普500", secid: "100.SPX", kind: "index" },
  { label: "🇺🇸 纳斯达克", name: "纳斯达克", secid: "100.NDX", kind: "index" },
  { label: "🇭🇰 恒生指数", name: "恒生指数", secid: "100.HSI", kind: "index" },
];

/** 最近 180 日真实数据（约 8 个月，覆盖形态/扫描样本） */
const DAYS = 180;

/**
 * 实验台独立版：标的选择器 + 真实数据获取（多源 API）+ 买卖点自动扫描联动
 */
export default function LabStandalone() {
  const [sel, setSel] = useState<LabSymbol>(LAB_SYMBOLS[0]);
  const [bars, setBars] = useState<Array<{ date: string; open: number; close: number; high: number; low: number; volume: number }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [source, setSource] = useState("");
  const [markCount, setMarkCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    const api = sel.kind === "index" ? "/api/index/kline" : "/api/stock/kline";
    fetch(`${api}?secid=${sel.secid}&days=${DAYS}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!Array.isArray(j?.klines) || !j.klines.length) throw new Error(j?.error ?? "empty");
        setBars(j.klines);
        setSource(j?.source ?? "");
        // 买卖点自动扫描
        const sigs = scanSignals(j.klines);
        setMarkCount(sigs.length);
      })
      .catch((e: any) => {
        if (!cancelled) setErr(e?.message ?? "数据加载失败");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [sel]);

  const sigs = bars ? scanSignals(bars) : [];
  const marks = sigs.slice(-6).map((s) => ({
    date: s.date,
    label: `${s.type === "buy" ? "▲" : "▼"}${s.strength >= 3 ? "强" : s.strength === 2 ? "中" : "弱"}·${s.rule.length > 8 ? s.rule.slice(0, 8) + "…" : s.rule}`,
    type: s.type as "buy" | "sell",
  }));

  return (
    <div className="space-y-3">
      {/* 标的选择器 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted mr-1">标的：</span>
        {LAB_SYMBOLS.map((s) => (
          <button
            key={s.secid}
            onClick={() => setSel(s)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              sel.secid === s.secid
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border text-muted hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {err ? (
        <p className="text-sm text-destructive py-4 text-center">{err}（数据源受限，请尝试切换标的或刷新）</p>
      ) : loading || !bars ? (
        <p className="text-sm text-muted py-6 text-center">加载 {sel.name} 真实行情…</p>
      ) : (
        <>
          <InteractiveKlineLab
            data={bars}
            height={430}
            marks={marks}
          />
          <p className="text-[11px] text-muted leading-relaxed">
            <b className="text-foreground">数据</b>：{sel.name}（{sel.secid}）近 {DAYS} 个交易日真实日线 · 数据源：{source || "多源容错"}
            {markCount > 0 ? ` · 买卖点扫描命中 ${markCount} 个信号（最近 ${marks.length} 个标注于图中，▲买/▼卖 + 强度 + 命中规则）` : " · 当前区间无扫描信号"}
            ；周期切换/指标叠加/回放为实验台内置能力。
          </p>
        </>
      )}
    </div>
  );
}
