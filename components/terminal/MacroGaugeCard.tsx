"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Thermometer, TrendingUp, ShieldAlert, ArrowRight } from "lucide-react";

interface MacroCtx {
  stage: string;
  score: number;
  equityPref: string;
  summary: string;
}
interface MacroIndex {
  name: string;
  close: number;
  yearChg: number;
  vsMa250: number;
  annVol: number;
}

/** 宏观仪表：宏观阶段/评分/资产偏好（上证真实数据自算）+ 关键指标 */
export default function MacroGaugeCard() {
  const [macro, setMacro] = useState<MacroCtx | null>(null);
  const [idx, setIdx] = useState<MacroIndex | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/macro/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok) {
          setMacro(j.macro);
          setIdx(j.index);
        } else setErr("宏观数据加载失败");
      })
      .catch(() => !cancelled && setErr("宏观数据加载失败"));
    return () => { cancelled = true; };
  }, []);

  const scoreColor =
    macro?.score == null ? "#64748b" : macro.score >= 60 ? "#dc2626" : macro.score >= 45 ? "#64748b" : "#16a34a";

  return (
    <figure>
      {err ? (
        <p className="text-sm text-muted py-6 text-center">{err}</p>
      ) : !macro ? (
        <p className="text-sm text-muted py-6 text-center">宏观指标计算中…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* 宏观温度环 */}
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={scoreColor} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(macro.score / 100) * 213.6} 213.6`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold" style={{ color: scoreColor }}>{macro.score}</span>
                <span className="text-[9px] text-muted">宏观评分</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">
                {macro.stage}
                <span className="ml-2 text-xs font-normal text-muted">{macro.equityPref}</span>
              </p>
              <p className="text-xs text-muted mt-1 leading-relaxed">{macro.summary}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted flex-wrap">
                <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> 年化波动 {idx?.annVol?.toFixed(1)}%</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 近 1 年 {idx?.yearChg != null && idx.yearChg >= 0 ? "+" : ""}{idx?.yearChg?.toFixed(1)}%</span>
                <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> 距 250 日线 {idx?.vsMa250 != null && idx.vsMa250 >= 0 ? "+" : ""}{idx?.vsMa250?.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <Link
            href="/macro"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            进入宏观仪表盘 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
      <figcaption className="text-[10px] text-muted mt-2 leading-relaxed">
        宏观阶段/评分由上证综指近 1 年涨跌 · 距 250 日线 · 年化波动真实数据自算（GMRDS 环节 1+3）；对应资产配置偏好。
      </figcaption>
    </figure>
  );
}
