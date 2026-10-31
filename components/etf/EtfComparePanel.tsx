"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import { useRefresh } from "@/lib/hooks/refresh";
import type { EtfHitLike } from "./EtfMarketBoard";

const COLORS = ["#c0392b", "#1d4ed8", "#1e8449", "#b45309", "#7c3aed", "#be185d", "#0891b2", "#6b6862"];
const RANGES = [
  [22, "1月"],
  [66, "3月"],
  [130, "6月"],
  [250, "1年"],
  [750, "3年"],
] as const;

interface KBar {
  date: string;
  close: number;
}

interface Series {
  hit: EtfHitLike;
  bars: KBar[] | null;
  error?: string;
}

/** 每只 ETF 用自己的日线；多只对齐到「共同交易日」，再从共同起点归一化为 100。 */
function normalize(series: Series[]): { dates: string[]; lines: Array<Array<number | null>>; stats: Array<{ hit: EtfHitLike; ret: number | null; mdd: number | null; last: number | null }> } {
  const ok = series.filter((s) => s.bars && s.bars.length > 1) as Array<Series & { bars: KBar[] }>;
  if (ok.length < 2) {
    return { dates: [], lines: [], stats: series.map((s) => ({ hit: s.hit, ret: null, mdd: null, last: s.bars?.at(-1)?.close ?? null })) };
  }
  // 日期 → 各序列收盘价
  const maps = ok.map((s) => new Map(s.bars.map((b) => [b.date, b.close])));
  const common = Array.from(maps[0].keys())
    .filter((d) => maps.every((m) => m.has(d)))
    .sort();
  if (common.length < 2) {
    return { dates: [], lines: [], stats: series.map((s) => ({ hit: s.hit, ret: null, mdd: null, last: s.bars?.at(-1)?.close ?? null })) };
  }
  // 点数控制：最多 260 个点，避免图表/悬浮卡顿（对比看的是形态，不是每根 K 线）
  const step = Math.ceil(common.length / 260);
  const dates = step > 1 ? common.filter((_, i) => i % step === 0 || i === common.length - 1) : common;
  const dateSet = new Set(dates);
  const lines = ok.map((s) => {
    const m = new Map(s.bars.map((b) => [b.date, b.close]));
    const base = m.get(dates[0]) ?? s.bars[0].close;
    return dates.map((d) => {
      const v = dateSet.has(d) ? (m.get(d) ?? null) : null;
      return v != null && base > 0 ? Number(((v / base) * 100).toFixed(2)) : null;
    });
  });
  const stats = series.map((s) => {
    if (!s.bars || s.bars.length < 2) return { hit: s.hit, ret: null, mdd: null, last: null };
    const m = new Map(s.bars.map((b) => [b.date, b.close]));
    const closes = common.map((d) => m.get(d)).filter((v): v is number => v != null);
    if (closes.length < 2) return { hit: s.hit, ret: null, mdd: null, last: closes.at(-1) ?? null };
    const first = closes[0];
    const last = closes[closes.length - 1];
    let peak = first;
    let mdd = 0;
    for (const c of closes) {
      peak = Math.max(peak, c);
      mdd = Math.min(mdd, (c / peak - 1) * 100);
    }
    return { hit: s.hit, ret: first > 0 ? ((last / first) * 100 - 100) : null, mdd, last };
  });
  return { dates, lines, stats };
}

/**
 * ETF 多标的对比面板（ETF 专区「对比」模式）。
 *
 * 用户可以只选 2 只宽基，也可以把 半导体 + 黄金 + 纳指 放一起看相对强弱 ——
 * 之前 ETF 专区完全没有对比入口，用户只能去 /compare 手动搜代码，等于没有。
 */
export default function EtfComparePanel({
  items,
  onRemove,
  onOpen,
}: {
  items: EtfHitLike[];
  onRemove: (secid: string) => void;
  onOpen: (hit: EtfHitLike) => void;
}) {
  const { refreshKey } = useRefresh();
  const [range, setRange] = useState<(typeof RANGES)[number][0]>(130);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (items.length === 0) {
      setSeries([]);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      const results = await Promise.all(
        items.map(async (hit) => {
          try {
            const res = await fetch(`/api/stock/kline?secid=${encodeURIComponent(hit.secid)}&period=day&days=${range}`, {
              cache: "no-store",
            });
            const json = await res.json();
            if (!json?.klines?.length) return { hit, bars: null, error: json?.error ?? "K 线暂缺" };
            const bars = (json.klines as Array<{ date: string; close: number }>).map((b) => ({ date: b.date, close: b.close }));
            return { hit, bars };
          } catch {
            return { hit, bars: null, error: "请求失败" };
          }
        })
      );
      if (alive) {
        setSeries(results);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [items, range, refreshKey, tick]);

  const { dates, lines, stats } = useMemo(() => normalize(series), [series]);

  const option = useMemo<EChartsOption>(() => {
    if (!dates.length || lines.length === 0) return {};
    return {
      animation: false,
      grid: { left: 46, right: 14, top: 30, bottom: 24 },
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex ?? 0;
          const date = dates[i] ?? "";
          const rows = arr
            .map((p: any) => {
              const v = p.value;
              return `${p.marker}${p.seriesName}：<b>${v == null ? "—" : Number(v).toFixed(2)}</b>${v == null ? "" : ""}`;
            })
            .join("<br/>");
          return `<div style="font-size:12px;line-height:1.6"><b>${date}</b>（起点=100）<br/>${rows}</div>`;
        },
      },
      legend: { show: false },
      xAxis: {
        type: "category",
        data: dates.map((d) => d.slice(5)),
        axisLabel: { fontSize: 10, maxInterval: Math.max(1, Math.floor(dates.length / 8)) },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: "#e2e0dc", type: "dashed" } },
      },
      series: series
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s.bars && s.bars.length > 1)
        .map(({ s, idx }, order) => ({
          name: `${s.hit.name}`,
          type: "line" as const,
          data: lines[order] ?? [],
          showSymbol: false,
          smooth: false,
          lineStyle: { width: 1.8, color: COLORS[idx % COLORS.length] },
          itemStyle: { color: COLORS[idx % COLORS.length] },
          connectNulls: true,
        })),
    };
  }, [dates, lines, series]);

  const failed = series.filter((s) => !s.bars);

  return (
    <div className="space-y-3">
      <div className="card p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium">ETF 对比（{items.length} / 6）</p>
          <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
            {RANGES.map(([d, label]) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`px-2 py-1 ${range === d ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTick((v) => v + 1)}
            className="px-2 py-1 rounded border border-border text-[11px] text-muted hover:text-foreground hover:border-primary/40"
          >
            重新拉取
          </button>
          <a
            href={`/compare?codes=${items.map((i) => i.code).join(",")}`}
            className="ml-auto text-[11px] text-primary hover:underline"
          >
            在对比中心打开 →
          </a>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((hit) => (
            <span key={hit.secid} className="inline-flex items-center gap-1.5 text-[11px] rounded-md border border-border px-2 py-1">
              <button onClick={() => onOpen(hit)} className="font-medium hover:text-primary">{hit.name}</button>
              <span className="text-[10px] text-muted font-mono">{hit.code}</span>
              <button onClick={() => onRemove(hit.secid)} className="text-muted hover:text-red-500" title="从对比中移除">×</button>
            </span>
          ))}
        </div>
        <p className="text-[10px] text-muted">起点归一化=100；在榜单勾选 2–6 只 ETF 后自动出图。不同跟踪标的的 ETF 对比看的是相对强弱，不是绝对收益。</p>
      </div>

      {failed.length > 0 && (
        <div className="card p-3">
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            {failed.map((f) => `${f.hit.name}：${f.error ?? "K 线暂缺"}`).join("；")}（其余标的仍正常对比）
          </p>
        </div>
      )}

      {items.length < 2 && (
        <div className="card p-6 text-center text-sm text-muted">请在上方榜单勾选至少 2 只 ETF，自动生成归一化对比图</div>
      )}

      {items.length >= 2 && (
        <div className="card p-3">
          {loading && !dates.length ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted">正在拉取 K 线…</div>
          ) : dates.length ? (
            <EChart option={option} height={320} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted">暂无可对齐的 K 线数据，请稍后重试</div>
          )}
        </div>
      )}

      {items.length >= 2 && stats.some((s) => s.ret != null) && (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left py-2 pl-3 pr-2 font-medium">标的</th>
                <th className="text-right px-2 py-2 font-medium">区间收益</th>
                <th className="text-right px-2 py-2 font-medium">最大回撤</th>
                <th className="text-right pr-3 pl-2 py-2 font-medium">最新价</th>
              </tr>
            </thead>
            <tbody>
              {stats
                .slice()
                .sort((a, b) => (b.ret ?? -999) - (a.ret ?? -999))
                .map((s) => (
                  <tr key={s.hit.secid} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pl-3 pr-2">
                      <button onClick={() => onOpen(s.hit)} className="font-medium hover:text-primary">
                        {s.hit.name}
                      </button>
                      <span className="ml-1.5 text-[10px] text-muted font-mono">{s.hit.code}</span>
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${(s.ret ?? 0) >= 0 ? "up" : "down"}`}>
                      {s.ret == null ? "—" : `${s.ret >= 0 ? "+" : ""}${s.ret.toFixed(2)}%`}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted">{s.mdd == null ? "—" : `${s.mdd.toFixed(2)}%`}</td>
                    <td className="pr-3 pl-2 py-1.5 text-right tabular-nums font-mono">{s.last == null ? "—" : s.last.toFixed(3)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
