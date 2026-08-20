"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Play, RotateCcw } from "lucide-react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/charts/EChart";
import { Badge, Card } from "@/components/ui";
import VirtualAccount, { type VirtualAccountHandle } from "./VirtualAccount";
import DecisionQuiz from "./DecisionQuiz";
import PanicGauge from "./PanicGauge";
import type { Crisis } from "@/lib/data/crisis/types";

type Phase = "intro" | "playing" | "finished";

const CAPITAL = 1_000_000;

const LEVEL_META: Record<Crisis["level"], { label: string; tone: "red" | "blue" | "gray" }> = {
  major: { label: "特大危机", tone: "red" },
  standard: { label: "标准危机", tone: "blue" },
  brief: { label: "简版", tone: "gray" },
};

const fmtMoney = (n: number) => Math.round(n).toLocaleString("zh-CN");
const fmtPct = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

interface Bar {
  date: string;
  close: number;
}

function closeAt(bars: Bar[], date: string): number | null {
  if (!bars.length) return null;
  const exact = bars.find((b) => b.date === date);
  if (exact) return exact.close;
  let prev: Bar | null = null;
  for (const b of bars) {
    if (b.date > date) break;
    prev = b;
  }
  return prev ? prev.close : null;
}

interface AccountState {
  cash: number;
  position: number;
  nav: number;
}

export default function CrisisEngine({ crisis, onExit }: { crisis: Crisis; onExit?: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [answeredSteps, setAnsweredSteps] = useState<Set<number>>(new Set());
  const [quizResults, setQuizResults] = useState<Record<number, boolean>>({});
  const [series, setSeries] = useState<Record<string, Bar[] | null>>({});
  const [finalState, setFinalState] = useState<AccountState | null>(null);
  const [viewKey, setViewKey] = useState(crisis.markets[0].name);
  const [navHistory, setNavHistory] = useState<Array<{ date: string; nav: number }>>([]);
  const [lastStep, setLastStep] = useState<{ ret: number; at: number } | null>(null);
  const accountRef = useRef<VirtualAccountHandle>(null);

  const mainMarket = crisis.markets[0];
  const marketBars = series[mainMarket.name];
  const activeBars = series[viewKey];
  const node = crisis.nodes[stepIndex];
  const levelMeta = LEVEL_META[crisis.level];
  const stockMeta = useMemo(() => new Map((crisis.stocks ?? []).map((s) => [s.name, s])), [crisis]);
  const viewOptions = useMemo(
    () => [mainMarket.name, ...(crisis.stocks ?? []).map((s) => s.name)],
    [crisis, mainMarket.name],
  );
  const isNameOnlyView = stockMeta.get(viewKey)?.nameOnly === true;
  const stockRole = viewKey === mainMarket.name ? undefined : stockMeta.get(viewKey)?.role;

  useEffect(() => {
    accountRef.current?.start();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sources: Array<{ key: string; secid: string; snap?: Array<{ date: string; value: number }> }> = [
        ...crisis.markets.map((m) => ({ key: m.name, secid: m.secid, snap: crisis.snapshotData?.[m.name] })),
        ...(crisis.stocks ?? [])
          .filter((s) => !s.nameOnly)
          .map((s) => ({ key: s.name, secid: s.secid })),
      ];
      const entries = await Promise.all(
        sources.map(async (src): Promise<[string, Bar[] | null]> => {
          if (src.snap?.length) {
            return [src.key, src.snap.map((s) => ({ date: s.date, close: s.value }))];
          }
          try {
            const url = `/api/crisis/kline?secid=${src.secid}&from=${crisis.period[0]}&to=${crisis.period[1]}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json?.ok && Array.isArray(json.bars) && json.bars.length) return [src.key, json.bars as Bar[]];
          } catch {
            /* fallthrough */
          }
          return [src.key, null];
        }),
      );
      if (!cancelled) setSeries(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [crisis]);

  const option: EChartsOption = useMemo(() => {
    if (!activeBars?.length) return {};
    const dates = activeBars.map((b) => b.date);
    const cur = node.date;
    const data = activeBars.map((b) => (b.date <= cur ? b.close : null));
    const markData: any[] = [];
    if (dates.includes(cur)) {
      markData.push({
        xAxis: cur,
        lineStyle: { color: "#dc2626", width: 2 },
        label: { formatter: "当前节点", color: "#dc2626", fontSize: 11, position: "insideEndTop" },
      });
    }
    for (const n of crisis.nodes) {
      if (n.date <= cur) continue;
      const nearest = [...activeBars].reverse().find((b) => b.date <= n.date);
      if (!nearest) continue;
      markData.push({
        xAxis: nearest.date,
        lineStyle: { color: "#a3a3a3", type: "dashed", width: 1 },
        label: { formatter: "后续节点", color: "#a3a3a3", fontSize: 10 },
      });
    }
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 56, right: 16, top: 34, bottom: 30 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 10 } },
      yAxis: {
        type: "value", scale: true,
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      series: [{
        name: viewKey,
        type: "line",
        data,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: "#c8102e", width: 2 },
        itemStyle: { color: "#c8102e" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(200,16,46,0.22)" },
              { offset: 1, color: "rgba(200,16,46,0)" },
            ],
          },
        },
        markLine: { symbol: "none", silent: true, data: markData },
      }],
    };
  }, [activeBars, node, crisis, viewKey]);

  const vixFiltered = useMemo(() => {
    const vix = crisis.vixData;
    if (!vix?.length) return [];
    return vix.filter((v) => v.date <= node.date);
  }, [crisis, node]);

  const vixOption: EChartsOption = useMemo(() => {
    if (!vixFiltered.length) return {};
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 12, top: 16, bottom: 20 },
      xAxis: { type: "category", data: vixFiltered.map((v) => v.date), axisLabel: { fontSize: 9 } },
      yAxis: {
        type: "value", scale: true,
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
        axisLabel: { fontSize: 9 },
      },
      series: [{
        name: "VIX",
        type: "line",
        data: vixFiltered.map((v) => v.value),
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: "#dc2626", width: 1.5 },
        itemStyle: { color: "#dc2626" },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(220,38,38,0.28)" },
              { offset: 1, color: "rgba(220,38,38,0)" },
            ],
          },
        },
      }],
    };
  }, [vixFiltered]);

  const anchorDate =
    stepIndex === 0
      ? closeAt(marketBars ?? [], crisis.period[0]) != null
        ? crisis.period[0]
        : (marketBars?.[0]?.date ?? crisis.period[0])
      : crisis.nodes[stepIndex - 1].date;
  const hasQuiz = !!node.quiz;
  const quizAnswered = answeredSteps.has(stepIndex);
  const nextDisabled = hasQuiz && !quizAnswered;

  const cumReturn = useMemo(() => {
    if (!marketBars?.length) return 0;
    const c0 = closeAt(marketBars, crisis.period[0]) ?? marketBars[0].close;
    const c1 = closeAt(marketBars, node.date);
    if (c0 == null || c1 == null || c0 <= 0) return 0;
    return c1 / c0 - 1;
  }, [marketBars, node, crisis]);

  const panicValue = useMemo(() => {
    const vix = crisis.vixData;
    if (vix?.length) {
      const recent = [...vix].reverse().find((v) => v.date <= node.date);
      if (recent) {
        const mean = vix.reduce((s, v) => s + v.value, 0) / vix.length;
        if (mean > 0) {
          const dev = (recent.value - mean) / mean;
          return Math.max(0, Math.min(100, dev * 200 + 50));
        }
      }
    }
    if (cumReturn < 0) return Math.max(0, Math.min(100, 50 + Math.abs(cumReturn) * 300));
    return 50;
  }, [crisis, node, cumReturn]);

  const nearestContext = useMemo(() => {
    if (!crisis.context?.length) return null;
    const norm = (d: string) => (d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d);
    const t = Date.parse(norm(node.date));
    if (Number.isNaN(t)) return null;
    let best: { date: string; event: string } | null = null;
    let bestDiff = Infinity;
    for (const c of crisis.context) {
      const ct = Date.parse(norm(c.date));
      if (Number.isNaN(ct)) continue;
      const diff = Math.abs(ct - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    }
    return best;
  }, [crisis, node]);

  const handleNext = () => {
    const c0 = closeAt(marketBars ?? [], anchorDate);
    const c1 = closeAt(marketBars ?? [], node.date);
    let ret = 0;
    if (c0 != null && c1 != null && c0 > 0) ret = c1 / c0 - 1;
    accountRef.current?.step(ret);
    const state = accountRef.current?.getState();
    setLastStep({ ret, at: Date.now() });
    setNavHistory((h) => [...h, { date: node.date, nav: state?.nav ?? CAPITAL }]);
    if (stepIndex >= crisis.nodes.length - 1) {
      setFinalState(state ?? null);
      setPhase("finished");
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const handleJump = (i: number) => {
    setStepIndex(i);
  };

  const handleQuizAnswer = (correct: boolean) => {
    setQuizScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    setAnsweredSteps((prev) => new Set(prev).add(stepIndex));
    setQuizResults((prev) => ({ ...prev, [stepIndex]: correct }));
  };

  const handleRestart = () => {
    setPhase("intro");
    setStepIndex(0);
    setQuizScore({ correct: 0, total: 0 });
    setAnsweredSteps(new Set());
    setQuizResults({});
    setFinalState(null);
    setNavHistory([]);
    setLastStep(null);
    setViewKey(mainMarket.name);
    accountRef.current?.start();
  };

  const playerRet = finalState ? finalState.nav / CAPITAL - 1 : 0;

  const fullPeriodRet = useMemo(() => {
    if (!marketBars?.length) return null;
    const c0 = closeAt(marketBars, crisis.period[0]) ?? marketBars[0].close;
    const c1 = closeAt(marketBars, crisis.period[1]) ?? marketBars[marketBars.length - 1].close;
    return c0 > 0 ? c1 / c0 - 1 : null;
  }, [marketBars, crisis]);

  const compareOption: EChartsOption = useMemo(() => {
    if (!navHistory.length) return {};
    const dates = navHistory.map((h) => h.date);
    const player = navHistory.map((h) => (h.nav / CAPITAL) * 100);
    const bars = marketBars ?? [];
    const base = closeAt(bars, dates[0]) ?? bars[0]?.close;
    const index = base && base > 0
      ? dates.map((d) => {
          const c = closeAt(bars, d);
          return c != null ? (c / base) * 100 : null;
        })
      : [];
    const c0 = closeAt(bars, crisis.period[0]) ?? bars[0]?.close;
    const buffett = c0 && c0 > 0
      ? dates.map((d) => {
          const c = closeAt(bars, d);
          return c != null ? 100 * (1 + (c / c0 - 1) * 0.5) : null;
        })
      : [];
    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 16, top: 30, bottom: 44 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
      yAxis: {
        type: "value", scale: true,
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      series: [
        {
          name: "你", type: "line", data: player, smooth: true,
          symbol: "circle", symbolSize: 5,
          lineStyle: { color: "#dc2626", width: 2 }, itemStyle: { color: "#dc2626" },
        },
        {
          name: "指数", type: "line", data: index, smooth: true,
          symbol: "circle", symbolSize: 5,
          lineStyle: { color: "#2563eb", width: 2 }, itemStyle: { color: "#2563eb" },
        },
        {
          name: "巴菲特式", type: "line", data: buffett, smooth: true,
          symbol: "circle", symbolSize: 5,
          lineStyle: { color: "#6b7280", width: 2, type: "dashed" }, itemStyle: { color: "#6b7280" },
        },
      ],
    };
  }, [navHistory, marketBars, crisis]);

  const scoreTier =
    quizScore.total === 0
      ? "本场未设置决策题，直接看市场如何演绎"
      : quizScore.correct === quizScore.total
        ? "满分：教科书级的关键抉择"
        : quizScore.correct / quizScore.total >= 0.66
          ? "不错：多数关键节点做出了正确判断"
          : quizScore.correct / quizScore.total >= 0.33
            ? "及格：方向感尚可，建议复盘专业点评"
            : "危险：多数决策被市场教训了，请仔细阅读专业点评";

  const pulseKey =
    lastStep && Math.abs(lastStep.ret) >= 0.03 ? (lastStep.ret > 0 ? lastStep.at : -lastStep.at) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <style>{`
@keyframes crisisPulseRed { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.45); } 100% { box-shadow: 0 0 0 24px rgba(220,38,38,0); } }
@keyframes crisisPulseGreen { 0% { box-shadow: 0 0 0 0 rgba(22,163,74,0.45); } 100% { box-shadow: 0 0 0 24px rgba(22,163,74,0); } }
@keyframes crisisJump { 0%, 100% { transform: scale(1); } 35% { transform: scale(1.35); } 70% { transform: scale(0.92); } }
      `}</style>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold">{crisis.title}</h2>
            <Badge tone={levelMeta.tone}>{levelMeta.label}</Badge>
          </div>
          <p className="text-sm text-muted mt-1 font-mono">
            {crisis.period[0]} ~ {crisis.period[1]} · {crisis.nodes.length} 个节点
          </p>
        </div>
        {onExit && (
          <button
            onClick={onExit}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 text-sm text-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 返回列表
          </button>
        )}
      </div>

      {phase === "intro" && (
        <>
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="font-bold">危机前夜 · 背景叙事</h3>
            </div>
            <p className="text-sm leading-relaxed">{crisis.heroStory}</p>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-3">市场环境</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {crisis.markets.map((m) => (
                <div key={m.secid} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted mt-1 font-mono">{m.secid}</p>
                  <p className="text-xs text-muted mt-1">
                    {crisis.snapshotData?.[m.name] ? "内置快照数据（无需联网）" : "实时历史 K 线（联网获取）"}
                  </p>
                </div>
              ))}
            </div>
            {crisis.stocks?.length ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted mb-2">本场关键个股（回放中可切换视角）</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {crisis.stocks.map((s) => (
                    <div key={s.name} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-semibold">
                        {s.name}
                        {s.nameOnly && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted border border-border rounded px-1 py-px align-middle">
                            快照
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted mt-1">{s.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {crisis.context?.length ? (
            <Card className="p-6">
              <h3 className="font-bold mb-3">当时的世界</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {crisis.context.map((c) => (
                  <div
                    key={`${c.date}-${c.event}`}
                    className="flex items-baseline gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="shrink-0 text-xs font-mono font-semibold text-primary">{c.date}</span>
                    <span className="text-[13px] leading-snug">{c.event}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      )}

      {phase === "playing" && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">
              节点 <span className="text-primary font-bold">{stepIndex + 1}</span> / {crisis.nodes.length}
            </p>
            <p className="text-xs text-muted font-mono">
              {crisis.period[0]} ~ {crisis.period[1]}
            </p>
          </div>
          <div className="flex items-start gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {crisis.nodes.map((n, i) => {
              const isCurrent = i === stepIndex;
              const isPast = i < stepIndex;
              const res = quizResults[i];
              return (
                <button
                  key={n.date}
                  onClick={() => handleJump(i)}
                  title={`${n.date} ${n.title}`}
                  className="group shrink-0 flex flex-col items-center gap-1 px-0.5"
                >
                  <span className="relative flex items-center justify-center h-5">
                    <span
                      className={`rounded-full transition-all duration-300 ${
                        isCurrent
                          ? "w-4 h-4 bg-primary scale-110"
                          : isPast
                            ? "w-3 h-3 bg-primary/50 group-hover:bg-primary/70"
                            : "w-2.5 h-2.5 bg-border group-hover:bg-primary/40"
                      }`}
                    />
                    {res !== undefined && (
                      <span
                        className={`absolute -top-0.5 -right-1 w-3.5 h-3.5 rounded-full text-[9px] leading-none flex items-center justify-center text-white font-bold ${
                          res ? "bg-down" : "bg-primary"
                        }`}
                      >
                        {res ? "✓" : "✗"}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-mono whitespace-nowrap ${isCurrent ? "text-primary font-bold" : "text-muted"}`}
                  >
                    {n.date.slice(0, 7)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-1.5 rounded bg-border/60 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / crisis.nodes.length) * 100}%` }}
            />
          </div>
        </Card>
      )}

      {(phase === "intro" || phase === "playing") && (
        <Card className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-sm mr-1">收盘价回放</h3>
              {viewOptions.map((key) => (
                <button
                  key={key}
                  onClick={() => setViewKey(key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    viewKey === key
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted hover:border-primary/50"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {phase === "playing" && <span className="text-xs text-muted">截至 {node.date}</span>}
              {lastStep && (
                <span
                  key={lastStep.at}
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                    lastStep.ret >= 0 ? "up border-down/40 bg-down/5" : "down border-primary/30 bg-primary/5"
                  }`}
                  style={Math.abs(lastStep.ret) >= 0.03 ? { animation: "crisisJump 1.2s ease" } : undefined}
                >
                  本段 {fmtPct(lastStep.ret)}
                </span>
              )}
            </div>
          </div>
          {stockRole && <p className="text-xs text-muted mb-2">{stockRole}</p>}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_230px] gap-4">
            <div className="space-y-3 min-w-0">
              {isNameOnlyView ? (
                <div className="h-72 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm text-muted">
                  <p>该股无历史行情数据</p>
                  {stockRole && <p className="text-xs">{stockRole}</p>}
                </div>
              ) : activeBars === undefined ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted">
                  正在加载历史行情…
                </div>
              ) : activeBars === null ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted">
                  {viewKey === mainMarket.name
                    ? "主市场历史 K 线暂不可用，行情回放与结算将按 0% 处理"
                    : "该股历史 K 线暂不可用"}
                </div>
              ) : (
                <div
                  key={pulseKey ?? "chart-static"}
                  className="rounded-lg"
                  style={pulseKey ? { animation: `crisisPulse${pulseKey > 0 ? "Green" : "Red"} 1.2s ease` } : undefined}
                >
                  <EChart option={option} height={300} />
                </div>
              )}
              {viewKey === mainMarket.name && vixFiltered.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted mb-1">VIX 恐慌指数</p>
                  <EChart option={vixOption} height={110} />
                </div>
              )}
            </div>
            <div className="flex items-start justify-center lg:pt-1">
              <PanicGauge value={panicValue} />
            </div>
          </div>
        </Card>
      )}

      {(phase === "intro" || phase === "playing") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {phase === "intro" ? (
              <Card className="p-6">
                <h3 className="font-bold mb-3">玩法说明</h3>
                <ul className="text-sm text-muted space-y-2 leading-relaxed">
                  <li>· 你手握 100 万虚拟资金，站在危机前夜，可以随时调整股票仓位（0-100%，不产生手续费）。</li>
                  <li>· 每进入一个节点，账户按主市场（{mainMarket.name}）在上一节点到本节点之间的实际涨跌幅结算。</li>
                  <li>· 部分节点设有决策测验，需先作答才能继续——专业点评是本场重演的核心价值。</li>
                  <li>· 最后进入结算页，与“满仓持有”“现金为王”等策略对照你的战绩。</li>
                </ul>
                <button
                  onClick={() => setPhase("playing")}
                  className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark transition-colors"
                >
                  <Play className="w-4 h-4" /> 进入重演
                </button>
              </Card>
            ) : (
              <>
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                      {node.date}
                    </span>
                    <h3 className="font-bold">{node.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed">{node.story}</p>
                  {node.news?.length ? (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-red-700 dark:text-red-400 mb-1.5">
                        当年头条
                      </p>
                      <div className="space-y-2">
                        {node.news.map((t, i) => (
                          <p
                            key={i}
                            className="pl-3 border-l-2 border-red-600 text-[13px] leading-relaxed font-serif font-semibold text-foreground/90"
                          >
                            “{t}”
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {node.policy && (
                    <div className="mt-3 rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-3">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">政策应对</p>
                      <p className="text-[13px] leading-relaxed">{node.policy}</p>
                    </div>
                  )}
                  {node.marketNote && (
                    <p className="mt-3 text-[13px] text-muted italic">市场环境：{node.marketNote}</p>
                  )}
                  {nearestContext && (
                    <p className="mt-3 pt-2 border-t border-border text-xs text-muted">
                      <span className="font-semibold">时代背景</span>：{nearestContext.date} · {nearestContext.event}
                    </p>
                  )}
                </Card>

                <DecisionQuiz key={node.date} quiz={node.quiz} onAnswer={handleQuizAnswer} />

                {nextDisabled && (
                  <p className="text-xs text-primary">请先完成本节点决策题，再进入下一节点。</p>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">
                  {phase === "intro" ? "虚拟账户 · 100 万初始资金" : "虚拟账户"}
                </h3>
              </div>
              <VirtualAccount ref={accountRef} capital={CAPITAL} marketName={mainMarket.name} />
              {phase === "playing" && (
                <>
                  <p className="mt-4 text-xs text-muted leading-relaxed">
                    提示：你可以像真实投资者一样调整仓位（不产生手续费）。点击“进入下一节点”后，账户将按主市场
                    {mainMarket.name} 在 {anchorDate} → {node.date} 区间的实际涨跌幅结算。
                  </p>
                  <button
                    onClick={handleNext}
                    disabled={nextDisabled}
                    className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
                      nextDisabled
                        ? "bg-border/60 text-muted cursor-not-allowed"
                        : "bg-primary text-white hover:bg-primary-dark"
                    }`}
                  >
                    {stepIndex >= crisis.nodes.length - 1 ? "进入结算" : "进入下一节点"} <span className="text-base">→</span>
                  </button>
                </>
              )}
            </Card>
          </div>
        </div>
      )}

      {phase === "finished" && finalState && (
        <>
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="font-bold">危机尘埃落定 · 历史影响</h3>
            </div>
            <p className="text-sm leading-relaxed">{crisis.impact}</p>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4">最终战绩</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted mb-1">初始资金</p>
                <p className="text-sm font-semibold font-mono">¥{fmtMoney(CAPITAL)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted mb-1">最终资产</p>
                <p className="text-sm font-semibold font-mono">¥{fmtMoney(finalState.nav)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted mb-1">本场收益</p>
                <p className={`text-sm font-bold font-mono ${playerRet >= 0 ? "up" : "down"}`}>
                  {fmtPct(playerRet)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted mb-1">最终仓位</p>
                <p className="text-sm font-semibold font-mono">{finalState.position.toFixed(0)}%</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-border p-3">
              <p className="text-xs text-muted mb-1">主市场全程涨跌（{mainMarket.name}）</p>
              <p className={`text-sm font-bold font-mono ${(fullPeriodRet ?? 0) >= 0 ? "up" : "down"}`}>
                {fullPeriodRet == null ? "数据不可用" : fmtPct(fullPeriodRet)}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4">策略对照</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  { name: "你", desc: "随机应变的组合", ret: playerRet, cls: "border-primary" },
                  { name: "满仓持有", desc: "从头拿到尾", ret: fullPeriodRet ?? 0, cls: "border-border" },
                  { name: "现金为王", desc: "全程空仓", ret: 0, cls: "border-border" },
                ] as const
              ).map((s) => (
                <div key={s.name} className={`rounded-lg border p-4 ${s.cls}`}>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted mt-0.5 mb-2">{s.desc}</p>
                  <p className={`text-lg font-bold font-mono ${s.ret >= 0 ? "up" : "down"}`}>{fmtPct(s.ret)}</p>
                </div>
              ))}
            </div>
          </Card>

          {navHistory.length > 0 && (
            <Card className="p-6">
              <h3 className="font-bold mb-4">收益曲线对比</h3>
              <p className="text-xs text-muted mb-3">
                三条曲线均以 100 为起点：你的净值 · 指数基准（满仓持有）· 巴菲特式（50% 仓位折半参与）
              </p>
              <EChart option={compareOption} height={320} />
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-bold mb-3">专业点评</h3>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 mb-4">
              <p className="text-sm leading-relaxed">{crisis.impact}</p>
            </div>
            <ul className="text-sm text-muted space-y-2 leading-relaxed mb-4">
              {crisis.advice.map((a, i) => (
                <li key={i}>· {a}</li>
              ))}
            </ul>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm">
                <span className="font-bold">决策测评</span>
                <span className="text-muted ml-2">
                  {quizScore.correct} / {quizScore.total} 答对
                </span>
                <span className="text-muted text-xs ml-2">{scoreTier}</span>
              </p>
              <div className="flex items-center gap-2">
                {onExit && (
                  <button
                    onClick={onExit}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:border-primary/50 text-sm text-muted transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> 返回列表
                  </button>
                )}
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> 重新挑战
                </button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}