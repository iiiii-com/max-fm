"use client";

import { useMemo } from "react";
import { scanSignals, SCAN_RULES } from "./signals";
import type { LabBar } from "./KlineLab";

/** 05 买卖点扫描器：四套明确规则全量扫描 + 近期信号（标注同步至 01 实验台） */
export default function ScanCard({ bars }: { bars: LabBar[] }) {
  const signals = useMemo(() => (bars.length >= 35 ? scanSignals(bars) : []), [bars]);
  const recent = useMemo(() => signals.slice(-16).reverse(), [signals]);
  const buyN = signals.filter((s) => s.type === "buy").length;
  const sellN = signals.filter((s) => s.type === "sell").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center gap-3 mb-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-down/10 text-down font-medium">买点信号 {buyN}</span>
          <span className="px-2 py-0.5 rounded bg-primary-soft text-primary font-medium">卖点信号 {sellN}</span>
          <span className="text-muted">样本 {bars.length} 根 K 线</span>
        </div>
        {recent.length ? (
          <div className="rounded-md border border-border divide-y divide-border/50 max-h-[320px] overflow-y-auto">
            {recent.map((s, i) => (
              <div key={`${s.index}-${s.source}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <span className="font-mono text-muted shrink-0 w-20">{s.date}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                    s.type === "buy" ? "bg-down/10 text-down" : "bg-primary-soft text-primary"
                  }`}
                >
                  {s.type === "buy" ? "买点" : "卖点"}
                </span>
                <span className="font-medium shrink-0 w-10">{s.source}</span>
                <span className="text-muted truncate" title={s.detail}>{s.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted py-6 text-center">样本内未产生信号（需 ≥35 根 K 线）</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted mb-2">扫描规则（判定标准全部公开可复算）</p>
        <div className="rounded-md border border-border divide-y divide-border/50">
          {SCAN_RULES.map((r) => (
            <div key={r.id} className="px-3 py-2 text-xs">
              <p className="font-medium">{r.name}</p>
              <p className="text-muted mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
          教学提示：单一指标信号噪音大，实盘中应结合趋势（01）、形态（02）、估值（04）与基本面（03）交叉验证。信号为规则触发记录，非投资建议。
        </p>
      </div>
    </div>
  );
}
