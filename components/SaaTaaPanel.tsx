"use client";

import { useEffect, useState } from "react";

/** 目标比例 → 战术偏离带宽（SAA 战略比例 / TAA 择时偏离） */
interface RiskPayload {
  ok: boolean;
  error?: string;
  updated: string;
  window: { from: string; to: string; sessions: number; tradingDaysPerYear: number };
  assets: Array<{ key: string; name: string; vol: number; target: number; band: { low: number; high: number } }>;
  nonEquity: { bond: number; gold: number; cash: number };
  equityRisk: { equalWeight: number; inverseVol: number; minVariance: number; minVarianceWeights: number[] };
  corr: number[][];
  missing: string[];
  note: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * SAA/TAA 面板：把「目标比例 + 战术偏离带宽 + 协方差矩阵」摊开给用户看。
 * 关键是把口径摊开 —— 每个数字都能追到窗口、样本数和来源，
 * 而不是只丢一个「建议股票 40%」的结论。
 */
export default function SaaTaaPanel({ risk }: { risk: number }) {
  const [d, setD] = useState<RiskPayload | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    fetch(`/api/portfolio/risk?risk=${risk}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (!j.ok) setErr(j.error || "风险参数暂不可用");
        else setD(j as RiskPayload);
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [risk]);

  if (loading) return <p className="text-xs text-muted">正在按当前风险偏好计算协方差…</p>;
  if (err) return <p className="text-xs text-amber-600">目标比例暂不可用：{err}（数据不足时不给建议，避免用不完整的协方差误导配置）</p>;
  if (!d) return null;

  return (
    <div className="rounded-lg border border-border bg-border/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold tracking-wide text-primary">SAA 目标比例 · TAA 战术偏离带宽</p>
        <p className="text-[10px] text-muted">
          样本 {d.window.from} ~ {d.window.to}（{d.window.sessions} 个交易日，按 {d.window.tradingDaysPerYear} 日年化）
        </p>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted text-[10px]">
            <th className="text-left font-medium py-1">资产</th>
            <th className="text-right font-medium py-1">年化波动</th>
            <th className="text-right font-medium py-1">目标比例</th>
            <th className="text-right font-medium py-1">TAA 偏离区间</th>
          </tr>
        </thead>
        <tbody>
          {d.assets.map((a) => (
            <tr key={a.key} className="border-t border-border/60">
              <td className="py-1.5">{a.name}</td>
              <td className="py-1.5 text-right font-mono">{pct(a.vol)}</td>
              <td className="py-1.5 text-right font-mono font-semibold">{pct(a.target)}</td>
              <td className="py-1.5 text-right font-mono text-muted">
                {pct(a.band.low)} ~ {pct(a.band.high)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-border/60">
            <td className="py-1.5">固收类</td>
            <td className="py-1.5 text-right text-muted">—</td>
            <td className="py-1.5 text-right font-mono font-semibold">{pct(d.nonEquity.bond)}</td>
            <td className="py-1.5 text-right text-muted text-[10px]">按风险偏好设定</td>
          </tr>
          <tr className="border-t border-border/60">
            <td className="py-1.5">黄金等避险</td>
            <td className="py-1.5 text-right text-muted">—</td>
            <td className="py-1.5 text-right font-mono font-semibold">{pct(d.nonEquity.gold)}</td>
            <td className="py-1.5 text-right text-muted text-[10px]">按风险偏好设定</td>
          </tr>
          <tr className="border-t border-border">
            <td className="py-1.5">现金/活期</td>
            <td className="py-1.5 text-right text-muted">—</td>
            <td className="py-1.5 text-right font-mono font-semibold">{pct(d.nonEquity.cash)}</td>
            <td className="py-1.5 text-right text-muted text-[10px]">配平项</td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <p className="text-[10px] font-bold tracking-wider text-primary mb-1">权益部分相关性（同期日收益）</p>
          <table className="w-full text-[10px] font-mono">
            <tbody>
              {d.assets.map((row, i) => (
                <tr key={row.key}>
                  <td className="text-muted py-0.5 pr-2">{row.name.slice(0, 6)}</td>
                  {d.assets.map((_, j) => (
                    <td key={j} className="text-right py-0.5">
                      {i === j ? "—" : d.corr[i][j].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-wider text-primary mb-1">权益组合年化波动（三种口径）</p>
          <ul className="text-[10px] font-mono space-y-0.5">
            <li>等权 {pct(d.equityRisk.equalWeight)}</li>
            <li className="font-semibold">逆波动率（SAA 采用）{pct(d.equityRisk.inverseVol)}</li>
            <li>最小方差 {pct(d.equityRisk.minVariance)}</li>
          </ul>
        </div>
      </div>

      <p className="text-[10px] text-muted leading-relaxed border-t border-border/60 pt-2">
        权益内部比例由协方差矩阵自算（波动越低配得越多）；TAA 带宽 = 目标比例 ± 0.5 倍该资产年化波动，
        超出带宽属于赌方向而非配权重。{d.note}
        {d.missing.length > 0 && ` 未取到：${d.missing.join("、")}（相关比例按其余资产归一）。`}
        {` 取数时间 ${new Date(d.updated).toLocaleString("zh-CN")}`}
      </p>
    </div>
  );
}