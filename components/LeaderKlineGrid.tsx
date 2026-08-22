"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EChartsOption } from "@/components/charts/echarts";
import EChart from "@/components/charts/EChart";
import { Card, Badge } from "@/components/ui";
import { SECTOR_LEADERS } from "@/lib/data/leaders";
import { THEME_ETFS } from "@/lib/data/leaders";
import { mkMainAxis } from "@/lib/data/axis";
import { sma } from "@/lib/data/indicators";
import { mkKlineTooltip } from "@/lib/data/kline-tooltip";

interface MiniBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

function fmtVol(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return `${n.toFixed(0)}`;
}

/** 迷你 K 线（近 60 日 + MA5/MA20 + 涨跌幅） */
function MiniKline({ secid, name, onPick }: { secid: string; name: string; onPick?: () => void }) {
  const [bars, setBars] = useState<MiniBar[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stock/kline?secid=${secid}&period=day`, { cache: "no-store" });
        const json = await res.json();
        if (json?.klines?.length) {
          const k = (json.klines as any[]).slice(-60).map((b) => ({
            date: b.date, open: b.open, close: b.close, high: b.high, low: b.low,
          }));
          if (!cancelled) setBars(k);
        } else if (!cancelled) setErr("—");
      } catch {
        if (!cancelled) setErr("—");
      }
    })();
    return () => { cancelled = true; };
  }, [secid]);

  const option = useMemo<EChartsOption>(() => {
    if (!bars?.length) return {};
    const closes = bars.map((b) => b.close);
    const dates = bars.map((b) => b.date);
    const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const up = last >= first;
    const color = up ? "#dc2626" : "#16a34a";
    const m5 = sma(closes, 5);
    const m20 = sma(closes, 20);
    return {
      animation: false,
      grid: { left: 2, right: 2, top: 8, bottom: 2 },
      xAxis: mkMainAxis({ dataLength: dates.length, period: "day", firstDate: dates[0], lastDate: dates[dates.length - 1] }),
      yAxis: { type: "value", scale: true, show: false },
      tooltip: mkKlineTooltip({ formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params];
        const i = arr[0]?.dataIndex ?? 0;
        const b = bars[i];
        if (!b) return "";
        const prev = i > 0 ? bars[i - 1].close : b.open;
        const pct = ((b.close - prev) / prev) * 100;
        return `<div style="font-size:12px;line-height:1.6"><b>${b.date}</b><br/>收 ${b.close.toFixed(2)}（<span style="color:${pct >= 0 ? "#dc2626" : "#16a34a"}">${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</span>）<br/>高 ${b.high.toFixed(2)} · 低 ${b.low.toFixed(2)}</div>`;
      } }),
      series: [
        {
          name: "K线", type: "candlestick", data: ohlc,
          itemStyle: { color, color0: "#16a34a", borderColor: color, borderColor0: "#16a34a" },
        },
        { name: "MA5", type: "line", data: m5, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#f59e0b" } },
        { name: "MA20", type: "line", data: m20, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#3b82f6" } },
      ],
    };
  }, [bars]);

  if (err) return <div className="h-16 flex items-center justify-center text-[10px] text-muted">{err}</div>;
  if (!bars?.length) return <div className="h-16 flex items-center justify-center text-[10px] text-muted">加载中…</div>;
  const chg = ((bars[bars.length - 1].close - bars[0].close) / bars[0].close) * 100;
  return (
    <div onClick={onPick} className="cursor-pointer">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium truncate">{name}</span>
        <span className={`text-[10px] font-mono shrink-0 ${chg >= 0 ? "up" : "down"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</span>
      </div>
      <EChart option={option} height={64} />
    </div>
  );
}

export default function LeaderKlineGrid({ defaultTab = "stock" }: { defaultTab?: "stock" | "etf" }) {
  const [tab, setTab] = useState<"stock" | "etf">(defaultTab);
  const sectors = useMemo(() => SECTOR_LEADERS.slice(0, 10), []);
  const etfs = useMemo(() => THEME_ETFS.slice(0, 12), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          <button
            onClick={() => setTab("stock")}
            className={`px-2.5 py-1 ${tab === "stock" ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
          >
            板块龙头个股
          </button>
          <button
            onClick={() => setTab("etf")}
            className={`px-2.5 py-1 ${tab === "etf" ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
          >
            主题 ETF
          </button>
        </div>
        <span className="text-[10px] text-muted">
          {tab === "stock" ? "近 60 日 K 线 + MA5/MA20 · 点击卡片直达个股详情" : "热门主题 ETF 近 60 日走势 · 点击直达 ETF 详情"}
        </span>
      </div>

      {tab === "stock" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {sectors.map((s) => (
            <Card key={s.sector} className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Badge tone="red">{s.sector}</Badge>
                <span className="text-[10px] text-muted ml-auto">{s.stocks.length} 只</span>
              </div>
              <div className="space-y-2.5">
                {s.stocks.slice(0, 2).map((st) => (
                  <MiniKline
                    key={st.secid}
                    secid={st.secid}
                    name={st.name}
                    onPick={() => {
                      if (typeof window !== "undefined") {
                        window.location.href = `/market?tab=stocks&q=${encodeURIComponent(st.name)}`;
                      }
                    }}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {etfs.map((e) => (
            <Card key={e.secid} className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Badge tone="blue">{e.name}</Badge>
                <span className="text-[10px] text-muted font-mono ml-auto">{e.code}</span>
              </div>
              <MiniKline
                secid={e.secid}
                name={e.name}
                onPick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = `/market?tab=etf&q=${encodeURIComponent(e.name)}`;
                  }
                }}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
