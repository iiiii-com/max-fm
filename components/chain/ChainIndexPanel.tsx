"use client";

import { useEffect, useRef, useState } from "react";
import { echarts, initResponsiveChart, type EChartsOption } from "@/components/charts/echarts";
import { Card, Badge } from "@/components/ui";
import { resolveChartTheme, readVar, withAlpha, TOOLTIP, ANIM_DURATION, GRID_DEFAULT } from "@/lib/charts/theme";
import ProGate from "@/components/ProGate";
import ChainStagePanel from "@/components/chain/ChainStagePanel";

interface Payload {
  ok: boolean;
  error?: string;
  hint?: string;
  updated: string;
  chain: { slug: string; name: string; prosperity: string };
  method: { weighting: string; base: number; alignment: string; minBars: number; suspended: string };
  coverage: {
    companiesInChain: number;
    withSecid: number;
    usedInIndex: number;
    excludedByData: Array<{ secid: string; name: string; reason: string }>;
    missingSecid: string[];
    truncated: number;
    fetchFailed: string[];
  };
  stats: { ret: number; vol: number; maxDrawdown: number; sessions: number };
  stages: Array<{ stage: string; ret: number; count: number; members: Array<{ secid: string; name: string; ret: number }> }>;
  interpretation: { points: string[]; insufficient: boolean };
  members: Array<{ secid: string; name: string; ret: number; bars: number }>;
  points: Array<{ date: string; value: number }>;
  benchmark: { name: string; points: Array<{ date: string; value: number }> } | null;
  relativeStrength: Array<{ date: string; excess: number }>;
  note: string;
}

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const THEME_NAME = "mx-chain-index";

/**
 * 链指数面板。
 *
 * 这个面板的价值全在"可复现"三个字上，所以：
 *  - 口径（等权 / 基点 / 共同交易日 / 停牌处理）直接印在图上，不藏在文档里；
 *  - 覆盖率如实展开：链上共几家、几家有代码、实际算进几家、谁被剔除及原因；
 *  - 取数失败单独列出，不伪装成"没有数据"。
 * 研究用途下，一个说得清来源的不完整数据，胜过一个看起来完整但来路不明的数字。
 */
export default function ChainIndexPanel({ slug }: { slug: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  /** 402：链指数属专业版能力 —— 与"取数失败"必须区分开，前者是升级引导，后者是故障 */
  const [needPro, setNeedPro] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    setNeedPro(false);
    fetch(`/api/chain/index?slug=${encodeURIComponent(slug)}`)
      .then(async (r) => ({ status: r.status, body: await r.json() }))
      .then(({ status, body }) => {
        if (!alive) return;
        if (status === 402) {
          setNeedPro(true);
          return;
        }
        if (!body.ok) setErr(`${body.error ?? "链指数不可用"}${body.hint ? ` · ${body.hint}` : ""}`);
        else setD(body as Payload);
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!ref.current || !d) return;
    echarts.registerTheme(THEME_NAME, resolveChartTheme());
    const { chart, dispose } = initResponsiveChart(ref.current, THEME_NAME);
    chartRef.current = chart;

    // canvas 不认识 var()：所有颜色先解析成具体值
    const muted = readVar("--muted", "#6b6862");
    const border = readVar("--border", "#e2e0dc");
    const up = readVar("--up", "#c0392b");
    const down = readVar("--down", "#1e8449");
    const primary = readVar("--primary", "#1a1a1a");

    const bmMap = new Map((d.benchmark?.points ?? []).map((p) => [p.date, p.value]));
    const bm = d.benchmark?.points ?? [];

    const series: any[] = [
      {
        name: `${d.chain.name}（等权）`,
        type: "line",
        data: d.points.map((p) => [p.date, p.value]),
        showSymbol: false,
        lineStyle: { width: 1.8, color: primary },
        itemStyle: { color: primary },
        areaStyle: { color: withAlpha(primary, 0.06) },
      },
    ];
    if (bm.length) {
      series.push({
        name: d.benchmark!.name,
        type: "line",
        // 基准在链指数的日期上取值：没有对应日期的点留空，不插值
        data: d.points.map((p) => [p.date, bmMap.get(p.date) ?? null]),
        showSymbol: false,
        lineStyle: { width: 1.2, color: muted, type: "dashed" },
        itemStyle: { color: muted },
      });
    }

    const option: EChartsOption = {
      animationDuration: ANIM_DURATION,
      tooltip: { ...TOOLTIP, trigger: "axis", valueFormatter: (v: any) => (v == null ? "—" : Number(v).toFixed(2)) },
      legend: { top: 0, right: 0, textStyle: { color: muted, fontSize: 11 } },
      grid: { ...GRID_DEFAULT, top: 34, left: 52, right: 16, bottom: 44 },
      xAxis: { type: "time", axisLabel: { color: muted, fontSize: 9 }, axisLine: { lineStyle: { color: border } } },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: muted, fontSize: 9 },
        splitLine: { lineStyle: { color: withAlpha(readVar("--foreground", "#1a1a1a"), 0.08), type: "dashed" } },
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 14, bottom: 6, start: 0, end: 100 },
      ],
      series,
      // up/down 仅用于 tooltip 的涨跌着色，不参与曲线本身
      color: [primary, muted],
    };
    chart.setOption(option);
    return () => {
      dispose();
      chartRef.current = null;
    };
    // up/down 在此仅声明语义色，实际未用于本图；保留以免未来加涨跌标注时再解析一次
  }, [d]);

  if (needPro) return <Card className="p-4"><ProGate feature="chain-index" /></Card>;
  if (loading) return <Card className="p-4"><p className="text-xs text-muted">正在取成员股日线并合成链指数…</p></Card>;
  if (err) return <Card className="p-4"><p className="text-xs text-amber-600">{err}</p></Card>;
  if (!d) return null;

  const c = d.coverage;
  const last = d.relativeStrength[d.relativeStrength.length - 1];

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
        <h3 className="font-bold text-sm">
          链指数（等权 · 基点 1000）
          <span className="ml-2 text-[11px] font-normal text-muted">
            由链上 {c.usedInIndex} 家代表公司的真实收盘价合成
          </span>
        </h3>
        <span className="text-[10px] text-muted">取数时间 {new Date(d.updated).toLocaleString("zh-CN")}</span>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
        {[
          { label: "区间收益", value: pct(d.stats.ret), tone: d.stats.ret >= 0 ? "up" : "down" },
          { label: "年化波动", value: `${d.stats.vol.toFixed(2)}%`, tone: "plain" },
          { label: "最大回撤", value: `${d.stats.maxDrawdown.toFixed(2)}%`, tone: "down" },
          { label: "交易日数", value: `${d.stats.sessions}`, tone: "plain" },
          {
            label: `相对${d.benchmark ? "沪深300" : "基准"}`,
            value: last ? pct(last.excess) : "—",
            tone: last ? (last.excess >= 0 ? "up" : "down") : "plain",
          },
        ].map((m) => (
          <div key={m.label} className="rounded-md border border-border/60 bg-border/20 px-2.5 py-2">
            <p className="text-[10px] text-muted">{m.label}</p>
            <p
              className={`font-mono font-bold text-sm mt-0.5 ${
                m.tone === "up" ? "text-[var(--up)]" : m.tone === "down" ? "text-[var(--down)]" : ""
              }`}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <div ref={ref} style={{ height: 320, width: "100%" }} />

      {/* 环节级拆解：整链涨 20% 可能是三段齐涨，也可能是中游涨 60% 而上游跌 —— 只看整链会抹掉这个差别 */}
      <div className="mt-3">
        <ChainStagePanel stages={d.stages ?? []} chainRet={d.stats.ret} interpretation={d.interpretation ?? { points: [], insufficient: true }} />
      </div>

      {/* 成员明细 */}
      <div className="mt-3">
        <div className="flex items-baseline gap-2 mb-1.5">
          <p className="text-[11px] font-bold tracking-wide text-primary">成员区间收益（同一共同窗口）</p>
          {d.members.length > 12 && (
            <button onClick={() => setShowAll(!showAll)} className="text-[10px] text-primary hover:underline">
              {showAll ? "收起" : `展开全部 ${d.members.length} 家`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {(showAll ? d.members : d.members.slice(0, 12)).map((m) => (
            <div key={m.secid} className="flex items-baseline justify-between gap-1 text-[11px] rounded border border-border/50 px-2 py-1">
              <span className="truncate">{m.name}</span>
              <span className={`font-mono shrink-0 ${m.ret >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{pct(m.ret)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 口径与覆盖率：研究用途下这部分和曲线一样重要 */}
      <div className="mt-3 border-t border-border/60 pt-2 space-y-1">
        <p className="text-[10px] text-muted leading-relaxed">
          <b className="text-foreground">口径</b>：{d.method.weighting}；{d.method.alignment}；
          {d.method.suspended}；成员不足 {d.method.minBars} 根日线不纳入。
        </p>
        <p className="text-[10px] text-muted leading-relaxed">
          <b className="text-foreground">覆盖率</b>：链上共 {c.companiesInChain} 家公司，
          {c.withSecid} 家有证券代码，实际纳入 {c.usedInIndex} 家
          {c.truncated > 0 && `（另有 ${c.truncated} 家超出单次上限未纳入）`}。
          {c.missingSecid.length > 0 && ` 无代码未纳入：${c.missingSecid.join("、")}。`}
        </p>
        {c.excludedByData.length > 0 && (
          <p className="text-[10px] text-amber-600 leading-relaxed">
            因数据不足剔除：{c.excludedByData.map((x) => `${x.name}（${x.reason}）`).join("；")}
          </p>
        )}
        {c.fetchFailed.length > 0 && (
          <p className="text-[10px] text-amber-600 leading-relaxed">
            取数失败：{c.fetchFailed.join("；")}
          </p>
        )}
        <p className="text-[10px] text-muted leading-relaxed">{d.note}</p>
      </div>
    </Card>
  );
}