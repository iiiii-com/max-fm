"use client";

import { useEffect, useRef, useState } from "react";
import { echarts, initResponsiveChart, type EChartsOption } from "@/components/charts/echarts";
import ProGate from "@/components/ProGate";
import { resolveChartTheme, readVar, withAlpha, TOOLTIP, ANIM_DURATION, GRID_DEFAULT, seriesColors } from "@/lib/charts/theme";

interface Row { rank: number; slug: string; name: string; prosperity: string; ret: number; vol: number }
interface Payload {
  ok: boolean;
  error?: string;
  hint?: string;
  updated: string;
  window: { from: string; to: string; sessions: number };
  method: { weighting: string; alignment: string; minBars: number; membersPerChain: number };
  ranking: Row[];
  curves: Array<{ slug: string; name: string; points: Array<{ date: string; value: number }> }>;
  correlation: Array<{ slug: string; name: string; with: Array<{ slug: string; name: string; rho: number }> }>;
  relativeStrength: { benchmark: string; rows: Array<{ slug: string; name: string; excess: number }> } | null;
  coverage: Array<{
    slug: string; name: string; companiesInChain: number; withSecid: number; usedInIndex: number;
    excluded: Array<{ name: string; reason: string }>; fetchFailed: string[];
  }>;
  note: string;
}

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

/**
 * 多链对比（专业版）。
 *
 * 这是产业研究里真正的日常动作：不是"看某条链怎么样"，而是"在同样的窗口里，
 * 哪些链更强、哪些更弱、它们之间是不是同涨同跌"。所以三块缺一不可：
 *   排名（谁强）→ 曲线（怎么走的）→ 相关矩阵（是不是一回事）
 * 只给排名不给相关矩阵，会让人把两个高度同源的链当成两次独立机会。
 */
export default function ChainComparePanel({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !open || d || loading) return;
    setLoading(true);
    setErr("");
    fetch("/api/chain/compare")
      .then(async (r) => ({ status: r.status, body: await r.json() }))
      .then(({ body }) => {
        if (!body.ok) setErr(`${body.error ?? "对比失败"}${body.hint ? ` · ${body.hint}` : ""}`);
        else setD(body as Payload);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [enabled, open, d, loading]);

  useEffect(() => {
    if (!ref.current || !d) return;
    echarts.registerTheme("mx-chain-compare", resolveChartTheme());
    const { chart, dispose } = initResponsiveChart(ref.current, "mx-chain-compare");
    chartRef.current = chart;

    const muted = readVar("--muted", "#6b6862");
    const border = readVar("--border", "#e2e0dc");
    const fg = readVar("--foreground", "#1a1a1a");
    const palette = seriesColors(d.curves.length);

    const option: EChartsOption = {
      animationDuration: ANIM_DURATION,
      color: palette,
      tooltip: { ...TOOLTIP, trigger: "axis", valueFormatter: (v: any) => (v == null ? "—" : Number(v).toFixed(1)) },
      legend: { type: "scroll", top: 0, textStyle: { color: muted, fontSize: 10 }, itemWidth: 14, itemHeight: 8 },
      grid: { ...GRID_DEFAULT, top: 46, left: 52, right: 16, bottom: 46 },
      xAxis: { type: "time", axisLabel: { color: muted, fontSize: 9 }, axisLine: { lineStyle: { color: border } } },
      yAxis: {
        type: "value", scale: true, name: "基点 1000", nameTextStyle: { color: muted, fontSize: 9 },
        axisLabel: { color: muted, fontSize: 9 },
        splitLine: { lineStyle: { color: withAlpha(fg, 0.08), type: "dashed" } },
      },
      dataZoom: [{ type: "inside", start: 0, end: 100 }, { type: "slider", height: 14, bottom: 6, start: 0, end: 100 }],
      series: d.curves.map((c) => ({
        name: c.name,
        type: "line" as const,
        data: c.points.map((p) => [p.date, p.value]),
        showSymbol: false,
        lineStyle: { width: 1.5 },
      })),
    };
    chart.setOption(option);
    return () => {
      dispose();
      chartRef.current = null;
    };
  }, [d]);

  if (!enabled) {
    return (
      <div className="mt-3">
        <ProGate feature="chain-compare" compact />
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-border/20 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] text-muted leading-relaxed">
            默认观测池 10 条链（半导体 / AI / 新能源车 / 光伏 / 医药 / 军工 / 消费 / 机器人 / 低空经济 / 算力）。
            每条链取最多 8 个成员，统一到共同交易日并重定基点 —— 否则区间不同、排名不可比。
          </p>
          <button
            onClick={() => setOpen(true)}
            className="text-[11px] px-3 py-1 rounded-md border border-primary/40 bg-primary/8 text-primary hover:bg-primary/15 shrink-0"
          >
            计算多链对比
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <p className="mt-3 text-xs text-muted">正在取 {10} 条链的成员日线并合成（约需十几秒）…</p>;
  if (err) return <p className="mt-3 text-xs text-amber-600">{err}</p>;
  if (!d) return null;

  const heat = (rho: number) => {
    if (rho >= 0.7) return { bg: withAlpha(readVar("--up", "#c0392b"), 0.22), strong: true };
    if (rho >= 0.4) return { bg: withAlpha(readVar("--up", "#c0392b"), 0.10), strong: false };
    return { bg: "transparent", strong: false };
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-border/20 p-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold tracking-wide text-primary">
          多链对比（{d.ranking.length} 条链 · {d.window.sessions} 个共同交易日）
        </p>
        <p className="text-[10px] text-muted">
          {d.window.from} ~ {d.window.to} · 取数时间 {new Date(d.updated).toLocaleString("zh-CN")}
        </p>
      </div>

      {/* 排名 */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[520px]">
          <thead>
            <tr className="text-muted text-[10px] border-b border-border">
              <th className="text-left py-1.5 pr-2 font-medium">#</th>
              <th className="text-left px-1.5 py-1.5 font-medium">产业链</th>
              <th className="text-right px-1.5 py-1.5 font-medium">区间收益</th>
              <th className="text-right px-1.5 py-1.5 font-medium">年化波动</th>
              <th className="text-right px-1.5 py-1.5 font-medium">相对沪深300</th>
            </tr>
          </thead>
          <tbody>
            {d.ranking.map((r) => {
              const ex = d.relativeStrength?.rows.find((x) => x.slug === r.slug);
              return (
                <tr key={r.slug} className="border-b border-border/40">
                  <td className="py-1.5 pr-2 text-muted font-mono">{r.rank}</td>
                  <td className="px-1.5 py-1.5">{r.name}</td>
                  <td className={`px-1.5 py-1.5 text-right font-mono font-semibold ${r.ret >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                    {pct(r.ret)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right font-mono text-muted">{r.vol.toFixed(1)}%</td>
                  <td className={`px-1.5 py-1.5 text-right font-mono ${ex && ex.excess >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                    {ex ? pct(ex.excess) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div ref={ref} style={{ height: 380, width: "100%" }} />

      {/* 相关矩阵：只给排名不给相关性，会把同源的两条链当成两次独立机会 */}
      <div>
        <p className="text-[10px] font-bold tracking-wider text-primary mb-1.5">
          两两相关性（共同窗口的日收益，≥0.7 高亮）
        </p>
        <div className="overflow-x-auto">
          <table className="text-[10px] font-mono border-collapse">
            <thead>
              <tr>
                <th className="text-left pr-2 text-muted font-normal">—</th>
                {d.curves.map((c) => (
                  <th key={c.slug} className="px-1.5 pb-1 text-muted font-normal max-w-[56px] truncate" title={c.name}>
                    {c.name.slice(0, 4)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.correlation.map((row) => (
                <tr key={row.slug}>
                  <td className="pr-2 text-muted max-w-[72px] truncate" title={row.name}>{row.name.slice(0, 5)}</td>
                  {row.with.map((w, j) => {
                    const h = heat(w.rho);
                    return (
                      <td key={j} className={`px-1.5 py-0.5 text-right ${h.strong ? "font-semibold" : ""}`} style={{ background: h.bg }}>
                        {row.slug === w.slug ? "—" : w.rho.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 口径与覆盖率 */}
      <div className="border-t border-border/60 pt-2 space-y-1">
        <p className="text-[10px] text-muted leading-relaxed">
          <b className="text-foreground">口径</b>：{d.method.weighting}；{d.method.alignment}；
          每条链最多取 {d.method.membersPerChain} 个成员，成员不足 {d.method.minBars} 根日线不纳入。
        </p>
        <p className="text-[10px] text-muted leading-relaxed">
          <b className="text-foreground">覆盖率</b>：
          {d.coverage.map((c) => `${c.name} ${c.usedInIndex}/${c.withSecid}`).join(" · ")}
          （分子=实际纳入，分母=链上有证券代码的公司数）
        </p>
        {d.coverage.some((c) => c.fetchFailed.length > 0) && (
          <p className="text-[10px] text-amber-600 leading-relaxed">
            取数失败：{d.coverage.filter((c) => c.fetchFailed.length).map((c) => `${c.name}（${c.fetchFailed.length} 只）`).join("；")}
          </p>
        )}
        <p className="text-[10px] text-muted leading-relaxed">{d.note}</p>
      </div>
    </div>
  );
}