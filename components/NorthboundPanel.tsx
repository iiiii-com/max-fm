"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";

interface Holding {
  name: string;
  secid: string;
  marketCap: number;
  ratio: number;
}

interface NorthboundResp {
  ok: boolean;
  date?: string;
  delay?: boolean;
  today?: { sh: number; sz: number; total: number } | null;
  history30?: { date: string; value: number }[];
  trend5?: number[];
  holdings?: { list: Holding[]; source: "eastmoney" | "static"; date?: string };
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

function arrow(v: number) {
  if (v > 0) return "↑";
  if (v < 0) return "↓";
  return "→";
}

export default function NorthboundPanel() {
  const [resp, setResp] = useState<NorthboundResp | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/northbound", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setResp(j);
        else setErr(j?.error ?? "加载失败");
      })
      .catch(() => {
        if (alive) setErr("北向资金数据暂不可用");
      });
    return () => {
      alive = false;
    };
  }, []);

  const barOption = useMemo<EChartsOption>(() => {
    const rows = resp?.history30 ?? [];
    const vals = rows.map((r) => r.value / 1e8);
    const min = Math.min(0, ...vals) * 1.1;
    const max = Math.max(0, ...vals) * 1.1;
    return {
      grid: { left: 8, right: 8, top: 8, bottom: 24, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const p = params?.[0];
          if (!p) return "";
          const r = rows[p.dataIndex];
          return r ? `${r.date}<br/>北向净买入：${r.value >= 0 ? "+" : ""}${fmtMoney(r.value)}` : "";
        },
      },
      xAxis: {
        type: "category",
        data: rows.map((r) => r.date.slice(5)),
        axisLabel: { fontSize: 9, interval: 4 },
      },
      yAxis: {
        type: "value",
        min,
        max,
        axisLabel: { fontSize: 9, formatter: "{value}亿" },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
      },
      series: [
        {
          type: "bar",
          barWidth: 7,
          data: rows.map((r) => ({
            value: r.value / 1e8,
            itemStyle: {
              borderRadius: [1, 1, 0, 0],
              color:
                r.value >= 0
                  ? { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#dc2626" }, { offset: 1, color: "rgba(220,38,38,0.3)" }] }
                  : { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#16a34a" }, { offset: 1, color: "rgba(22,163,74,0.3)" }] },
            },
          })),
        },
      ],
    };
  }, [resp]);

  const today = resp?.today;
  const trend5 = resp?.trend5 ?? [];
  const holdings = resp?.holdings;
  const delay = resp?.delay;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">北向资金</h2>
        <span className="text-[10px] text-muted">{resp?.date ? `数据日期 ${resp.date}` : ""}</span>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {!resp && !err && <p className="text-xs text-muted">北向资金加载中…</p>}
      {resp && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4 space-y-4">
            <div>
              <p className="text-xs text-muted">今日北向净买入</p>
              {delay && !today ? (
                <p className="text-xs text-muted mt-1">数据延迟</p>
              ) : today ? (
                <>
                  <p className={`text-2xl font-bold font-mono ${today.total >= 0 ? "up" : "down"}`}>
                    {today.total >= 0 ? "+" : ""}
                    {fmtMoney(today.total)}
                  </p>
                  <div className="text-xs space-y-1 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted">沪股通</span>
                      <span className={`font-mono font-medium ${today.sh >= 0 ? "up" : "down"}`}>{today.sh >= 0 ? "+" : ""}{fmtMoney(today.sh)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">深股通</span>
                      <span className={`font-mono font-medium ${today.sz >= 0 ? "up" : "down"}`}>{today.sz >= 0 ? "+" : ""}{fmtMoney(today.sz)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted mt-1">—</p>
              )}
            </div>

            <div>
              <p className="text-xs text-muted mb-1.5">近 5 日趋势</p>
              {trend5.length === 0 ? (
                <p className="text-xs text-muted">数据延迟</p>
              ) : (
                <div className="flex items-end gap-2">
                  {trend5.map((v, i) => (
                    <div key={i} className="flex-1 text-center">
                      <p className={`text-sm font-mono ${v >= 0 ? "up" : "down"}`}>{arrow(v)}</p>
                      <p className="text-[9px] text-muted font-mono mt-0.5">
                        {v >= 0 ? "+" : ""}
                        {fmtMoney(v)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-muted mb-1.5">30 日净买入历史</p>
              {(resp.history30 ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-[180px] rounded-md border border-border text-xs text-muted">
                  数据延迟
                </div>
              ) : (
                <EChart option={barOption} height={180} />
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold">北向重仓股 Top 10</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted">
                {holdings?.source === "eastmoney" ? `月频披露 ${holdings.date ?? ""}` : "静态数据"}
              </span>
            </div>
            {!holdings?.list?.length ? (
              <p className="text-xs text-muted">暂无数据</p>
            ) : (
              <div className="divide-y divide-border/50">
                {holdings.list.map((h, i) => (
                  <Link
                    key={h.secid}
                    href={`/stock?q=${encodeURIComponent(h.name)}`}
                    className="flex items-center gap-2 py-1.5 text-xs hover:text-primary"
                  >
                    <span className="w-4 text-[10px] text-muted font-mono">{i + 1}</span>
                    <span className="font-medium flex-1 truncate">{h.name}</span>
                    <span className="font-mono text-muted">{fmtMoney(h.marketCap)}</span>
                    <span className="font-mono text-muted w-12 text-right">{h.ratio.toFixed(1)}%</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}