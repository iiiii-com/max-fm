"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, RefreshCw } from "lucide-react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import type { SectorKline } from "@/app/api/sector/kline/route";

interface SectorStock {
  name: string;
  secid: string;
  price: number;
  pct: number;
  mainNet: number;
}

interface FundPoint {
  date: string;
  main: number | null;
}

export interface DetailSector {
  code: string;
  name: string;
  changePct: number;
  mainNetIn: number;
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

/** 板块详情面板：K线收盘 + 主力资金联动 · 近 10 日资金历史 · 成分股主力 Top10 */
export default function SectorKlinePanel({ sector, onClose }: { sector: DetailSector; onClose: () => void }) {
  const [rows, setRows] = useState<SectorKline[]>([]);
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null); // 源限频回落缓存时的数据时点
  const [trend, setTrend] = useState<FundPoint[]>([]);
  const [stocks, setStocks] = useState<SectorStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [klineErr, setKlineErr] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [err, setErr] = useState("");

  // K 线单独请求（服务端带缓存兜底：源限频时返回最近成功数据并标注 asOf）；资金历史/成分股并行且独立容错
  useEffect(() => {
    let alive = true;
    setRows([]);
    setTrend([]);
    setStocks([]);
    setKlineErr(false);
    setStaleAsOf(null);
    setLoading(true);
    setErr("");

    const loadKline = (isRetry: boolean): void => {
      if (isRetry) setRetrying(true);
      fetch(`/api/sector/kline?bk=${sector.code}&lmt=60`, { cache: "no-store" })
        .then((r) => r.json())
        .then((k) => {
          if (!alive) return;
          if (k?.ok && Array.isArray(k.list) && k.list.length) {
            setRows(k.list);
            setStaleAsOf(k.stale ? String(k.asOf ?? "") : null);
            setKlineErr(false);
          } else if (isRetry) {
            setKlineErr(true);
          } else {
            // 首次失败：2.5s 后自动重试一次
            setTimeout(() => {
              if (alive) loadKline(true);
            }, 2500);
          }
        })
        .catch(() => {
          if (!alive) return;
          if (isRetry) setKlineErr(true);
          else
            setTimeout(() => {
              if (alive) loadKline(true);
            }, 2500);
        })
        .finally(() => {
          if (alive && isRetry) setRetrying(false);
        });
    };
    loadKline(false);

    Promise.all([
      fetch(`/api/market/sector-fund-history?secid=90.${sector.code}&days=10`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/sector/flow/detail?bk=${sector.code}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([f, d]) => {
        if (!alive) return;
        if (f?.ok && Array.isArray(f.trend)) setTrend(f.trend);
        setStocks(Array.isArray(d?.list) ? d.list : []);
      })
      .catch(() => {
        if (alive) setErr("部分详情加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [sector.code]);

  // 主图：收盘价（右轴）+ 每日主力净流入柱（左轴）
  const mainOption = useMemo<EChartsOption>(() => {
    if (!rows.length) return {};
    const dates = rows.map((r) => r.date.slice(5));
    const hasNeg = rows.some((r) => r.main < 0);
    return {
      animation: false,
      grid: { left: 56, right: 56, top: 18, bottom: 24 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0]?.dataIndex;
          if (i == null || !rows[i]) return "";
          const r = rows[i];
          return `${r.date}<br/>收盘：${r.close.toFixed(2)}（${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)}%）<br/>主力净流入：${r.main >= 0 ? "+" : ""}${fmtMoney(r.main)}`;
        },
      },
      legend: { top: 0, textStyle: { fontSize: 10 }, data: ["主力净流入", "收盘价"] },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 9 } },
      yAxis: [
        {
          type: "value",
          name: "净流入(亿)",
          nameTextStyle: { fontSize: 9 },
          axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 1e8).toFixed(0)}` },
          splitLine: { lineStyle: { color: "rgba(128,128,128,0.15)" } },
          min: hasNeg ? undefined : 0,
        },
        {
          type: "value",
          name: "收盘价",
          nameTextStyle: { fontSize: 9 },
          scale: true,
          axisLabel: { fontSize: 9 },
          splitLine: { show: false },
        },
      ],
      dataZoom: [{ type: "inside", start: 30, end: 100 }],
      series: [
        {
          name: "主力净流入",
          type: "bar",
          barWidth: "50%",
          yAxisIndex: 0,
          data: rows.map((r) =>
            r.main === 0
              ? { value: 0, itemStyle: { color: "rgba(128,128,128,0.25)" } }
              : {
                  value: r.main,
                  itemStyle: {
                    color:
                      r.main >= 0
                        ? { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#dc2626" }, { offset: 1, color: "rgba(220,38,38,0.25)" }] }
                        : { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#16a34a" }, { offset: 1, color: "rgba(22,163,74,0.25)" }] },
                  },
                },
          ),
        },
        {
          name: "收盘价",
          type: "line",
          yAxisIndex: 1,
          symbol: "none",
          lineStyle: { width: 1.5, color: "#f59e0b" },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(245,158,11,0.25)" }, { offset: 1, color: "rgba(245,158,11,0.02)" }] } },
          data: rows.map((r) => r.close),
        },
      ],
    };
  }, [rows]);

  // 近 10 日主力净流入
  const fundOption = useMemo<EChartsOption>(() => {
    if (!trend.length) return {};
    return {
      animation: false,
      grid: { left: 52, right: 14, top: 16, bottom: 22 },
      tooltip: {
        trigger: "axis",
        formatter: (params: any) => {
          const i = Array.isArray(params) ? params[0]?.dataIndex ?? 0 : 0;
          const pt = trend[i];
          return pt ? `<b>${pt.date}</b><br/>主力净流入 ${(pt.main ?? 0) >= 0 ? "+" : ""}${((pt.main ?? 0) / 1e8).toFixed(2)}亿` : "";
        },
      },
      xAxis: { type: "category", data: trend.map((p) => p.date.slice(5)), axisLabel: { fontSize: 9 } },
      yAxis: { type: "value", axisLabel: { fontSize: 9, formatter: (v: number) => `${(v / 1e8).toFixed(0)}亿` }, splitLine: { lineStyle: { color: "rgba(128,128,128,0.12)", type: "dashed" } } },
      series: [
        {
          type: "bar",
          data: trend.map((p) => p.main),
          barWidth: "55%",
          itemStyle: { color: (p: any) => ((p.value ?? 0) >= 0 ? "rgba(215,0,11,0.75)" : "rgba(10,160,110,0.75)"), borderRadius: 2 },
        },
      ],
    };
  }, [trend]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3 min-w-0">
          <p className="font-bold truncate">{sector.name}</p>
          <span className="text-[10px] text-muted font-mono shrink-0">{sector.code}</span>
          <span className={`text-sm font-mono font-bold shrink-0 ${sector.changePct >= 0 ? "up" : "down"}`}>
            {sector.changePct >= 0 ? "+" : ""}{sector.changePct.toFixed(2)}%
          </span>
          <span className={`text-xs font-mono shrink-0 ${sector.mainNetIn >= 0 ? "up" : "down"}`}>
            主力 {fmtMoney(sector.mainNetIn)}
          </span>
        </div>
        <button onClick={onClose} className="text-sm px-2 py-1 rounded-md border border-border hover:border-primary/50 shrink-0" aria-label="关闭">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {err ? (
        <p className="text-sm text-muted py-6 text-center">{err}</p>
      ) : loading ? (
        <div className="p-4 space-y-3">
          <div className="h-72 animate-pulse bg-muted/10 rounded-lg" />
          <div className="h-32 animate-pulse bg-muted/10 rounded-lg" />
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div>
              <p className="text-xs font-medium mb-1.5 text-muted flex items-center gap-2 flex-wrap">
                <span>近 60 日 · 收盘价 + 主力资金联动</span>
                {staleAsOf && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    数据时点 {staleAsOf.slice(5, 16).replace("T", " ")} · 源限频，暂展示缓存
                  </span>
                )}
              </p>
              {rows.length ? (
                <EChart option={mainOption} height={300} />
              ) : klineErr ? (
                <div className="rounded-md border border-border h-[300px] flex flex-col items-center justify-center gap-2.5 px-6 text-center">
                  <p className="text-xs text-muted">板块 K 线数据源（东方财富）偶发限频，暂时无法获取</p>
                  <div className="flex items-center gap-4 text-[11px] text-muted">
                    <span>
                      当日涨跌 <b className={sector.changePct >= 0 ? "up" : "down"}>{sector.changePct >= 0 ? "+" : ""}{sector.changePct.toFixed(2)}%</b>
                    </span>
                    <span>
                      主力净流入 <b className={sector.mainNetIn >= 0 ? "up" : "down"}>{fmtMoney(sector.mainNetIn)}</b>
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setKlineErr(false);
                      setRows([]);
                      setStaleAsOf(null);
                      setRetrying(true);
                      fetch(`/api/sector/kline?bk=${sector.code}&lmt=60`, { cache: "no-store" })
                        .then((r) => r.json())
                        .then((k) => {
                          if (k?.ok && Array.isArray(k.list) && k.list.length) {
                            setRows(k.list);
                            setStaleAsOf(k.stale ? String(k.asOf ?? "") : null);
                          } else setKlineErr(true);
                        })
                        .catch(() => setKlineErr(true))
                        .finally(() => setRetrying(false));
                    }}
                    className="text-xs px-3 py-1.5 rounded-md border border-border text-muted hover:text-primary hover:border-primary/50 transition-colors inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} /> 重试
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] rounded-md border border-border text-xs text-muted">
                  {retrying ? "K 线加载中（重试）…" : "加载中…"}
                </div>
              )}
              {rows.length > 0 && (
                <p className="text-[11px] text-muted mt-2 leading-relaxed">
                  解读：柱为每日主力净流入（红=流入、绿=流出，左轴），黄线为收盘价走势（右轴）。价升量入（资金推动上涨）为强势信号；价跌资金流出但收窄，常是底部信号。
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5 text-muted">近 10 日 · 主力净流入历史</p>
              {trend.length ? (
                <EChart option={fundOption} height={140} />
              ) : (
                <div className="flex items-center justify-center h-[140px] rounded-md border border-border text-xs text-muted">暂无资金历史</div>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-1.5 text-muted">板块个股 · 主力净流入 Top10</p>
            {stocks.length ? (
              <div className="rounded-md border border-border divide-y divide-border/50 max-h-[460px] overflow-y-auto">
                {stocks.map((st, i) => (
                  <Link
                    key={st.secid}
                    href={`/stock/${st.secid}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/20"
                  >
                    <span className="text-muted font-mono w-4 shrink-0">{i + 1}</span>
                    <span className="font-medium truncate flex-1">{st.name}</span>
                    <span className={`font-mono shrink-0 ${st.pct >= 0 ? "up" : "down"}`}>
                      {st.pct >= 0 ? "+" : ""}{st.pct.toFixed(2)}%
                    </span>
                    <span className={`font-mono shrink-0 ${st.mainNet >= 0 ? "up" : "down"}`}>{fmtMoney(st.mainNet)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 rounded-md border border-border text-xs text-muted">暂无成分股数据</div>
            )}
            <p className="text-[10px] text-muted mt-2 leading-relaxed">
              数据源：东方财富板块 K 线 / 资金流（fflow）· 5 分钟缓存 · 点击个股进入深度页。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
