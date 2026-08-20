"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "@/components/charts/echarts";
import type { SectorKline } from "@/app/api/sector/kline/route";

export interface DrawerSector {
  name: string;
  code: string;
  changePct: number;
  mainNetIn: number;
}

function fmtMoney(n: number) {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

export default function SectorDrawer({ sector, onClose }: { sector: DrawerSector | null; onClose: () => void }) {
  const [rows, setRows] = useState<SectorKline[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sector) return;
    let alive = true;
    setRows([]);
    setLoading(true);
    fetch(`/api/sector/kline?bk=${sector.code}&lmt=60`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.list) setRows(j.list);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [sector]);

  useEffect(() => {
    if (!sector) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sector, onClose]);

  const option = useMemo<EChartsOption>(() => {
    if (!rows.length) return {};
    const dates = rows.map((r) => r.date.slice(5));
    const hasFlow = rows.some((r) => r.main !== 0);
    const hasNeg = rows.some((r) => r.main < 0);
    return {
      grid: { left: 48, right: 48, top: 16, bottom: 22 },
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
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: { fontSize: 9 },
      },
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

  if (!sector) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 right-0 w-full max-w-[560px] bg-background border-l border-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-background/95 backdrop-blur border-b border-border">
          <div>
            <p className="font-bold">{sector.name}</p>
            <p className="text-[10px] text-muted font-mono">{sector.code}</p>
          </div>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-md border border-border hover:border-primary/50" aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <span className={`text-xl font-bold font-mono ${sector.changePct >= 0 ? "up" : "down"}`}>
              {sector.changePct >= 0 ? "+" : ""}{sector.changePct.toFixed(2)}%
            </span>
            <span className={`text-sm font-mono font-medium ${sector.mainNetIn >= 0 ? "up" : "down"}`}>
              主力净流入 {fmtMoney(sector.mainNetIn)}
            </span>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">近 60 日：K 线收盘 + 主力资金联动</p>
            {loading ? (
              <div className="flex items-center justify-center h-[340px] rounded-md border border-border text-xs text-muted">加载中…</div>
            ) : rows.length ? (
              <EChart option={option} height={340} />
            ) : (
              <div className="flex items-center justify-center h-[340px] rounded-md border border-border text-xs text-muted">暂无数据</div>
            )}
            {rows.length > 0 && (
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                解读：柱为每日主力净流入（红=流入、绿=流出，左轴），黄线为收盘价走势（右轴）。价升量入（资金推动上涨）为强势信号；
                价跌资金流出但收窄，常是底部信号。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}