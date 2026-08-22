"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "@/components/charts/echarts";
import EChart from "@/components/charts/EChart";
import { Card } from "@/components/ui";
import { sma, macd, boll, kdj, rsi, detectSwings, buildSwingMarkPoints, type IndicatorKey } from "@/lib/data/indicators";
import { mkMainAxis, mkSubAxis } from "@/lib/data/axis";
import { mkKlineTooltip, mkPctLabel } from "@/lib/data/kline-tooltip";
import AnnotatableChart from "@/components/charts/AnnotatableChart";
import usMarket from "@/data/us-market.json";

interface YearBar {
  year: number;
  open: number | null;
  close: number | null;
  high: number | null;
  low: number | null;
  note?: string;
}

type UsIndex = "spx" | "ndx";

const INDEX_META: Record<UsIndex, { name: string; desc: string }> = {
  spx: { name: "标普 500", desc: "美国大盘蓝筹代表，覆盖约 80% 美股市值" },
  ndx: { name: "纳斯达克", desc: "科技成长股代表，含 FAANG 等权重股" },
};

/** 美股关键事件（年度视角，真实事件） */
const US_EVENTS = [
  { year: 2007, name: "次贷危机顶点", direction: "down" as const },
  { year: 2008, name: "雷曼破产·金融危机", direction: "down" as const },
  { year: 2009, name: "QE1·触底反弹", direction: "up" as const },
  { year: 2015, name: "加息周期开启", direction: "volatile" as const },
  { year: 2018, name: "贸易摩擦·缩表", direction: "down" as const },
  { year: 2020, name: "疫情熔断·无限QE", direction: "volatile" as const },
  { year: 2022, name: "激进加息·熊市", direction: "down" as const },
  { year: 2024, name: "降息·AI浪潮", direction: "up" as const },
];

function fmtVol(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}

/** 统一标注标签样式：强制水平 + 白底描边 + 高对比（与 BullBearKline 保持一致） */
function mkLabel(text: string, color: string, position: "start" | "end" | "top" | "bottom" = "end") {
  return {
    show: true,
    formatter: text,
    color,
    fontSize: 10,
    fontWeight: "bold" as const,
    rotate: 0,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: color,
    borderWidth: 1,
    borderRadius: 3,
    padding: [2, 5],
    position,
    distance: 6,
  };
}

export default function UsMarketKline() {
  const [index, setIndex] = useState<UsIndex>("spx");
  const [indicators, setIndicators] = useState<IndicatorKey[]>(["ma"]);
  const [showPct, setShowPct] = useState(true);
  const [pctPos, setPctPos] = useState<"top" | "bottom">("top");
  const [pctFont, setPctFont] = useState(9);

  const toggleIndicator = (k: IndicatorKey) => {
    setIndicators((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  };

  const bars = useMemo(() => {
    const rows = usMarket[index] as YearBar[];
    return rows.map((r, i) => {
      let { open, close, high, low } = r;
      if (close == null) close = open;
      if (open == null) open = close;
      if (high == null) high = close;
      if (low == null) low = close;
      return {
        year: r.year,
        date: String(r.year), // x 轴对齐用年份字符串
        open: open ?? 0,
        close: close ?? 0,
        high: high ?? 0,
        low: low ?? 0,
        volume: Math.max(0, Math.round((high ?? 0) * (i + 1))), // 年度K无量能，用高位占位供指标计算
        note: r.note,
      };
    });
  }, [index]);

  const option = useMemo<EChartsOption>(() => {
    const years = bars.map((b) => String(b.year));
    const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
    const closes = bars.map((b) => b.close);
    const hasMacd = indicators.includes("macd");

    const grid = [
      { left: 64, right: 16, top: 36, height: hasMacd ? "52%" : "62%" },
      { left: 64, right: 16, top: hasMacd ? "74%" : "84%", height: "12%" },
    ];
    if (hasMacd) grid.push({ left: 64, right: 16, top: "86%", height: "8%" });
    const xAxes = [
      {
        ...mkMainAxis({ dataLength: years.length, period: "year", firstDate: years[0], lastDate: years[years.length - 1] }),
        data: years,
      },
      { ...mkSubAxis(years.length, 1), data: years },
    ];
    if (hasMacd) xAxes.push({ ...mkSubAxis(years.length, 2), data: years });
    const yAxes: any[] = [
      { type: "value", scale: true, gridIndex: 0, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } } },
      { type: "value", gridIndex: 1, axisLabel: { fontSize: 8 }, splitLine: { show: false } },
    ];
    if (hasMacd) yAxes.push({ type: "value", gridIndex: 2, axisLabel: { fontSize: 8 }, splitLine: { show: false }, scale: true });

    // 事件标注：统一竖直虚线 + 标签（交替上下防重叠，文字强制水平）
    const markLines: any[] = [];
    const markAreas: any[] = [];
    let onTop = true;
    for (const ev of US_EVENTS) {
      const color = ev.direction === "down" ? "#16a34a" : ev.direction === "up" ? "#dc2626" : "#d97706";
      onTop = !onTop;
      markLines.push({
        xAxis: String(ev.year),
        lineStyle: { color, width: 1.2, type: "dashed" },
        label: mkLabel(ev.name.length > 7 ? `${ev.name.slice(0, 7)}…` : ev.name, color, onTop ? "start" : "end"),
      });
    }
    markAreas.push([
      { xAxis: "2007", itemStyle: { color: "rgba(22,163,74,0.05)" } },
      { xAxis: "2009" },
    ]);
    markAreas.push([
      { xAxis: "2020", itemStyle: { color: "rgba(217,119,6,0.05)" } },
      { xAxis: "2021" },
    ]);
    markAreas.push([
      { xAxis: "2022", itemStyle: { color: "rgba(22,163,74,0.05)" } },
      { xAxis: "2023" },
    ]);

    const indicatorSeries: any[] = [];
    const legendData = ["K 线", "成交量"];
    if (indicators.includes("ma")) {
      const m5 = sma(closes, 3), m10 = sma(closes, 5), m20 = sma(closes, 10);
      for (const [name, data, color] of [["MA3Y", m5, "#f59e0b"], ["MA5Y", m10, "#3b82f6"], ["MA10Y", m20, "#8b5cf6"]] as const) {
        indicatorSeries.push({ name, type: "line", data, smooth: true, showSymbol: false, lineStyle: { width: 1, color } });
        legendData.push(name);
      }
    }
    if (indicators.includes("boll")) {
      const b = boll(closes, 5);
      indicatorSeries.push({ name: "BOLL上", type: "line", data: b.upper, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#94a3b8", type: "dashed" } });
      indicatorSeries.push({ name: "BOLL中", type: "line", data: b.mid, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#64748b" } });
      indicatorSeries.push({ name: "BOLL下", type: "line", data: b.lower, smooth: true, showSymbol: false, lineStyle: { width: 0.8, color: "#94a3b8", type: "dashed" } });
      legendData.push("BOLL上", "BOLL中", "BOLL下");
    }
    if (indicators.includes("kdj")) {
      const k = kdj(bars);
      for (const [name, data, color] of [["K", k.k, "#f59e0b"], ["D", k.d, "#3b82f6"], ["J", k.j, "#a855f7"]] as const) {
        indicatorSeries.push({ name, type: "line", data, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color } });
        legendData.push(name);
      }
    }
    if (indicators.includes("rsi")) {
      const r6 = rsi(closes, 3), r14 = rsi(closes, 5);
      for (const [name, data, color] of [["RSI3", r6, "#f59e0b"], ["RSI5", r14, "#8b5cf6"]] as const) {
        indicatorSeries.push({ name, type: "line", data, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color } });
        legendData.push(name);
      }
    }
    if (hasMacd) {
      const m = macd(closes);
      indicatorSeries.push({ name: "DIF", type: "line", data: m.dif, xAxisIndex: 2, yAxisIndex: 2, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color: "#3b82f6" } });
      indicatorSeries.push({ name: "DEA", type: "line", data: m.dea, xAxisIndex: 2, yAxisIndex: 2, smooth: true, showSymbol: false, lineStyle: { width: 0.9, color: "#f59e0b" } });
      indicatorSeries.push({
        name: "MACD", type: "bar", data: m.hist.map((v) => ({ value: v, itemStyle: { color: (v ?? 0) >= 0 ? "rgba(220,38,38,0.55)" : "rgba(22,163,74,0.55)" } })),
        xAxisIndex: 2, yAxisIndex: 2,
      });
      legendData.push("DIF", "DEA", "MACD");
    }

    return {
      animation: false,
      tooltip: mkKlineTooltip({ formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params];
        const i = arr[0]?.dataIndex ?? 0;
        const b = bars[i];
        if (!b) return "";
        const lines = arr.map((p: any) => `${p.marker}${p.seriesName}: ${p.value ?? "—"}`).join("<br/>");
        return `<div style="font-size:12px;line-height:1.6"><b>${b.year} 年</b><br/>开 ${b.open}　高 ${b.high}<br/>收 ${b.close}　低 ${b.low}<br/>${lines}${b.note ? `<br/><span style="color:#888">${b.note}</span>` : ""}</div>`;
      } }),
      legend: { top: 4, right: 8, textStyle: { fontSize: 11 }, data: legendData },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid,
      xAxis: xAxes,
      yAxis: yAxes,
      dataZoom: [
        { type: "inside", xAxisIndex: hasMacd ? [0, 1, 2] : [0, 1], start: 0, end: 100 },
        { type: "slider", xAxisIndex: hasMacd ? [0, 1, 2] : [0, 1], height: 14, bottom: 2, start: 0, end: 100 },
      ],
      series: [
        {
          name: "K 线",
          type: "candlestick",
          data: ohlc,
          itemStyle: { color: "#dc2626", color0: "#16a34a", borderColor: "#dc2626", borderColor0: "#16a34a" },
          markLine: { symbol: "none", silent: true, data: markLines },
          markArea: { silent: true, data: markAreas },
          markPoint: {
            symbol: "pin",
            symbolSize: 40,
            data: buildSwingMarkPoints(detectSwings(bars.map((b) => b.close), 25), {
              maxCount: 30,
              minAbsPct: 25,
            }),
            tooltip: { formatter: (p: any) => p.value },
            label: { show: true },
          },
        },
        // 逐年涨跌幅标注（scatter 叠加）
        mkPctLabel({ bars, show: showPct, position: pctPos, fontSize: pctFont }),
        ...indicatorSeries,
        {
          name: "成交量",
          type: "bar",
          data: bars.map((b) => ({
            value: b.high,
            itemStyle: { color: b.close >= b.open ? "rgba(220,38,38,0.5)" : "rgba(22,163,74,0.5)" },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ],
    };
  }, [bars, index, indicators, showPct, pctPos, pctFont]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm">{INDEX_META[index].name} · 年度 K 线（2005-2025）</h3>
          <span className="text-[10px] text-muted hidden sm:inline">{INDEX_META[index].desc}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["spx", "ndx"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setIndex(k)}
                className={`px-2.5 py-1 ${index === k ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                {INDEX_META[k].name}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {([
              ["ma", "MA"],
              ["macd", "MACD"],
              ["boll", "BOLL"],
              ["kdj", "KDJ"],
              ["rsi", "RSI"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => toggleIndicator(k)}
                className={`px-2 py-1 ${indicators.includes(k) ? "bg-primary/15 text-primary font-medium" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
            <span className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => setShowPct((v) => !v)}
              className={`px-2 py-1 rounded text-[11px] border ${showPct ? "border-primary/40 text-primary bg-primary/10 font-medium" : "border-border text-muted hover:border-primary/40"}`}
              title="逐年标注涨跌幅（涨红跌绿）"
            >
              {showPct ? "逐年涨跌幅：开" : "逐年涨跌幅：关"}
            </button>
            {showPct && (
              <>
                <button
                  onClick={() => setPctPos((v) => (v === "top" ? "bottom" : "top"))}
                  className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40"
                >
                  {pctPos === "top" ? "位置：上方" : "位置：下方"}
                </button>
                <select
                  value={pctFont}
                  onChange={(e) => setPctFont(Number(e.target.value))}
                  className="px-1 py-0.5 rounded text-[11px] border border-border bg-transparent text-muted"
                >
                  {[8, 9, 10, 11, 12].map((s) => <option key={s} value={s}>{s}px</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> 危机/加息区间</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> 疫情冲击区间</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> 关键事件</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 bg-red-500 inline-block rounded-sm" /> +涨幅</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2.5 bg-green-500 inline-block rounded-sm" /> -回调</span>
        <span className="text-muted/70">年度 OHLC · 事件标注判定：事件发生年份</span>
      </div>

      <AnnotatableChart
        option={option}
        height={420}
        storageKey="usmarket-ann"
        snapBars={bars}
        hint="画线标注：趋势线/水平线/垂直线/射线/通道线/矩形；选择模式拖动端点编辑，Del/Backspace 或双击删除；样式面板可调颜色/线型/线宽；开启吸附后端点贴近 K 线最高/最低价；标注自动保存，刷新后恢复，可导出/导入 JSON。"
      />

      <p className="text-[10px] text-muted mt-2 leading-relaxed border-t border-border/60 pt-2">
        数据来源：标普500/纳指年度 OHLC 为公开历史行情（雅虎财经/标准普尔官方口径）；2025 年标普收盘为 2026-08-21 腾讯接口实测值，纳指 2025 未确证故不展示。
        MA 采用 3/5/10 年短窗口适配年度数据；KDJ/RSI 同理使用缩短期参数。
      </p>
    </Card>
  );
}
