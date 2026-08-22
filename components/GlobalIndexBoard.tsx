"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "@/components/charts/echarts";
import EChart from "@/components/charts/EChart";
import { Card, Badge } from "@/components/ui";
import { mkMainAxis } from "@/lib/data/axis";
import { mkKlineTooltip } from "@/lib/data/kline-tooltip";

interface GlobalIndex {
  code: string;
  name: string;
  secid: string;
  region: string;
  desc: string;
  sina?: string;
}

export const GLOBAL_INDEXES: GlobalIndex[] = [
  { code: "SPX", name: "标普500", secid: "100.SPX", region: "🇺🇸 美国", desc: "美股大盘蓝筹，覆盖约 80% 市值", sina: ".INX" },
  { code: "NDX", name: "纳斯达克", secid: "100.NDX", region: "🇺🇸 美国", desc: "科技成长股代表，AI 行情主战场", sina: ".IXIC" },
  { code: "DJIA", name: "道琼斯", secid: "100.DJIA", region: "🇺🇸 美国", desc: "30 家工业蓝筹，百年历史风向标", sina: ".DJI" },
  { code: "N225", name: "日经225", secid: "100.N225", region: "🇯🇵 日本", desc: "日本大盘蓝筹，半导体/汽车权重高" },
  { code: "KS11", name: "韩国KOSPI", secid: "100.KS11", region: "🇰🇷 韩国", desc: "三星/SK海力士领衔，半导体出口晴雨表" },
  { code: "HSI", name: "恒生指数", secid: "100.HSI", region: "🇭🇰 中国香港", desc: "港股蓝筹，互联互通核心标的" },
  { code: "GDAXI", name: "德国DAX", secid: "100.GDAXI", region: "🇩🇪 德国", desc: "欧洲工业龙头，汽车/化工权重高" },
  { code: "FTSE", name: "英国富时100", secid: "100.FTSE", region: "🇬🇧 英国", desc: "能源/金融蓝筹，英股风向标" },
];

interface Quote {
  code: string;
  name: string;
  price: number;
  changePct: number;
  changeAmount: number;
}

function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/** 国际指数迷你 K 线（新浪历史日线，近 60 日） */
function MiniSpark({ code, expanded, onExpand }: { code: string; expanded: boolean; onExpand: (c: string) => void }) {
  const [bars, setBars] = useState<any[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBars(null);
    setErr("");
    (async () => {
      try {
        const res = await fetch(`/api/global/kline?code=${code}&days=${expanded ? 250 : 60}`, { cache: "no-store" });
        const json = await res.json();
        if (json?.ok && Array.isArray(json.bars) && json.bars.length) {
          if (!cancelled) setBars(json.bars);
        } else if (!cancelled) setErr(json?.error ?? "不可用");
      } catch {
        if (!cancelled) setErr("不可用");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, expanded]);

  const option = useMemo<EChartsOption>(() => {
    if (!bars?.length) return {};
    const closes = bars.map((b) => b.close);
    const dates = bars.map((b) => b.date);
    return {
      animation: false,
      grid: { left: 4, right: 4, top: 8, bottom: 4 },
      xAxis: mkMainAxis({ dataLength: dates.length, period: "day", firstDate: dates[0], lastDate: dates[dates.length - 1] }),
      yAxis: { type: "value", scale: true, show: false },
      tooltip: mkKlineTooltip({ formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params];
        const i = arr[0]?.dataIndex ?? 0;
        const b = bars[i];
        if (!b) return "";
        const prev = i > 0 ? bars[i - 1].close : b.open;
        const pct = ((b.close - prev) / prev) * 100;
        return `<div style="font-size:12px;line-height:1.6"><b>${b.date}</b><br/>收 ${b.close.toFixed(2)}（<span style="color:${pct >= 0 ? "#dc2626" : "#16a34a"}">${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</span>）</div>`;
      } }),
      series: [
        {
          type: "line",
          data: closes,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1.2, color: closes[closes.length - 1] >= closes[0] ? "#dc2626" : "#16a34a" },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: closes[closes.length - 1] >= closes[0] ? "rgba(220,38,38,0.25)" : "rgba(22,163,74,0.25)" },
                { offset: 1, color: "rgba(0,0,0,0)" },
              ],
            },
          },
        },
      ],
    };
  }, [bars]);

  return (
    <div className="space-y-2">
      {err ? (
        <p className="text-[10px] text-muted py-4 text-center">{err}（该指数历史 K 线数据源受限）</p>
      ) : !bars ? (
        <p className="text-[10px] text-muted py-4 text-center">走势加载中…</p>
      ) : (
        <>
          <EChart option={option} height={expanded ? 240 : 72} />
          <p className="text-[10px] text-muted">近 {bars.length} 个交易日 · 新浪财经历史日线 · 悬停看点位</p>
        </>
      )}
    </div>
  );
}

export default function GlobalIndexBoard({ quotes }: { quotes: Quote[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const byCode = new Map(quotes.map((q) => [q.code, q]));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {GLOBAL_INDEXES.map((ix) => {
          const q = byCode.get(ix.code);
          const isOpen = expanded === ix.code;
          const up = (q?.changePct ?? 0) >= 0;
          return (
            <Card key={ix.code} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold">{ix.name}</p>
                  <p className="text-[10px] text-muted">{ix.region} · {ix.code}</p>
                </div>
                <Badge tone={up ? "red" : "green"}>{up ? "▲" : "▼"} {fmtPct(q?.changePct ?? 0)}</Badge>
              </div>
              {q ? (
                <p className="text-xl font-bold font-mono mt-1">
                  {q.price.toFixed(2)}
                  <span className="text-xs text-muted font-normal ml-1.5">
                    {q.changeAmount >= 0 ? "+" : ""}{q.changeAmount.toFixed(2)}
                  </span>
                </p>
              ) : (
                <p className="text-xl font-bold font-mono mt-1 text-muted">—</p>
              )}
              <p className="text-[10px] text-muted mt-1 mb-2 line-clamp-2">{ix.desc}</p>

              {ix.sina ? (
                <div onClick={() => setExpanded(isOpen ? null : ix.code)} className="cursor-pointer">
                  <MiniSpark code={ix.code} expanded={isOpen} onExpand={setExpanded} />
                  <p className="text-[10px] text-primary mt-1">{isOpen ? "收起走势 ▲" : "查看近一年走势 ▼"}</p>
                </div>
              ) : (
                <p className="text-[10px] text-muted">历史 K 线数据源暂未覆盖，实时行情有效</p>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-[10px] text-muted leading-relaxed">
        行情数据：东方财富实时接口（与上交所/纽交所/韩交所对齐）；走势数据：新浪财经历史日线（美股三大指数 2004 年起，其余指数数据源受限时标注说明）。
      </p>
    </div>
  );
}
