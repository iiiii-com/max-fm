"use client";

import { useEffect, useState } from "react";
import ProGate from "@/components/ProGate";

interface Diagnosis {
  ok: boolean;
  error?: string;
  hint?: string;
  updated: string;
  window: { from: string; to: string; sessions: number; tradingDaysPerYear: number };
  count: number;
  truncated: number;
  assets: Array<{ secid: string; name: string; vol: number; bars: number }>;
  portfolio: {
    equalWeight: number;
    minVariance: number;
    minVarianceWeights: number[];
    concentrationHHI: number;
    effectiveN: number;
  };
  topPair: { a: string; b: string; rho: number } | null;
  corr: number[][];
  failed: string[];
  note: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * 自选股组合批量诊断（专业版）。
 *
 * 与单标的页面的区别不是"多看几个数"，而是这些问题只有整组一起算才回答得了：
 *   组合整体波动是多少、哪两个标的最同涨同跌、最小方差下权重集中在谁身上。
 * 因此这里刻意直接展示相关矩阵 —— 结论要能自己复核，不然就只是又一个黑箱。
 */
export default function WatchlistDiagnosis() {
  const [d, setD] = useState<Diagnosis | null>(null);
  const [needPro, setNeedPro] = useState<{ freeTier: string | null; proTier: string | null } | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/watchlist/diagnosis")
      .then(async (r) => ({ status: r.status, body: await r.json() }))
      .then(({ status, body }) => {
        if (!alive) return;
        if (status === 402) {
          setNeedPro({ freeTier: body.freeTier ?? null, proTier: body.proTier ?? null });
          return;
        }
        if (status === 401) {
          setErr("登录后可查看自选股组合诊断");
          return;
        }
        if (!body.ok) {
          setErr(`${body.error ?? "诊断失败"}${body.hint ? ` · ${body.hint}` : ""}`);
          return;
        }
        setD(body as Diagnosis);
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <p className="text-xs text-muted">正在读取自选列表并计算组合协方差…</p>;

  if (needPro) {
    return (
      <div className="space-y-2">
        <ProGate feature="batch-diagnosis" />
        {needPro.freeTier && (
          <p className="text-[11px] text-muted leading-relaxed">
            普通版仍可逐个打开标的查看各自的波动与估值分位。
          </p>
        )}
      </div>
    );
  }

  if (err) return <p className="text-xs text-amber-600">{err}</p>;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-border bg-border/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold tracking-wide text-primary">自选股组合诊断（{d.count} 只）</p>
        <p className="text-[10px] text-muted">
          共同区间 {d.window.from} ~ {d.window.to}（{d.window.sessions} 个交易日）
          {d.truncated > 0 && ` · 超出上限的 ${d.truncated} 只未纳入`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md bg-card border border-border/60 p-2.5">
          <p className="text-[10px] text-muted mb-1">组合年化波动（等权）</p>
          <p className="font-mono font-bold text-sm">{pct(d.portfolio.equalWeight)}</p>
        </div>
        <div className="rounded-md bg-card border border-border/60 p-2.5">
          <p className="text-[10px] text-muted mb-1">最小方差口径</p>
          <p className="font-mono font-bold text-sm">{pct(d.portfolio.minVariance)}</p>
        </div>
        <div className="rounded-md bg-card border border-border/60 p-2.5">
          <p className="text-[10px] text-muted mb-1">有效标的数（1/HHI）</p>
          <p className="font-mono font-bold text-sm">
            {d.portfolio.effectiveN} / {d.count}
          </p>
          <p className="text-[9px] text-muted mt-0.5 leading-tight">
            越接近 1 说明最小方差下权重越集中在少数标的
          </p>
        </div>
      </div>

      {d.topPair && (
        <p className="text-[11px] leading-relaxed">
          <span className="text-muted">最同涨同跌的一对：</span>
          <b>{d.topPair.a}</b> × <b>{d.topPair.b}</b>
          <span className="font-mono ml-1">ρ={d.topPair.rho.toFixed(2)}</span>
          <span className="text-muted ml-1">——分散化收益最低的正是这两个。</span>
        </p>
      )}

      <div className="overflow-x-auto">
        <p className="text-[10px] font-bold tracking-wider text-primary mb-1.5">
          相关矩阵（同期日收益，可自行复核上面的结论）
        </p>
        <table className="text-[10px] font-mono border-collapse">
          <thead>
            <tr>
              <th className="text-left pr-2 text-muted font-normal">—</th>
              {d.assets.map((a) => (
                <th key={a.secid} className="px-1.5 pb-1 text-muted font-normal max-w-[64px] truncate" title={a.name}>
                  {a.name.slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.assets.map((row, i) => (
              <tr key={row.secid}>
                <td className="pr-2 text-muted max-w-[80px] truncate" title={row.name}>
                  {row.name.slice(0, 5)}
                </td>
                {d.assets.map((_, j) => {
                  const rho = d.corr[i][j];
                  return (
                    <td
                      key={j}
                      className="px-1.5 py-0.5 text-right"
                      style={{ background: i === j ? undefined : `rgba(192,57,43,${Math.max(0, rho) * 0.22})` }}
                    >
                      {i === j ? "—" : rho.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {d.failed.length > 0 && (
        <p className="text-[10px] text-amber-600 leading-relaxed">
          未纳入：{d.failed.join("；")}
        </p>
      )}

      <p className="text-[10px] text-muted leading-relaxed border-t border-border/60 pt-2">
        {d.note} 取数时间 {new Date(d.updated).toLocaleString("zh-CN")}
      </p>
    </div>
  );
}