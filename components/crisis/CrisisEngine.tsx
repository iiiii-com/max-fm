"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Play, RotateCcw } from "lucide-react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/charts/EChart";
import { Badge, Card } from "@/components/ui";
import VirtualAccount, { type VirtualAccountHandle } from "./VirtualAccount";
import DecisionQuiz from "./DecisionQuiz";
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
  const [series, setSeries] = useState<Record<string, Bar[] | null>>({});
  const [finalState, setFinalState] = useState<AccountState | null>(null);
  const accountRef = useRef<VirtualAccountHandle>(null);

  const mainMarket = crisis.markets[0];
  const mainBars: Bar[] | undefined | null = series[mainMarket.name];
  const node = crisis.nodes[stepIndex];
  const levelMeta = LEVEL_META[crisis.level];

  useEffect(() => {
    accountRef.current?.start();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        crisis.markets.map(async (m): Promise<[string, Bar[] | null]> => {
          const snap = crisis.snapshotData?.[m.name];
          if (snap?.length) {
            return [m.name, snap.map((s) => ({ date: s.date, close: s.value }))];
          }
          try {
            const url = `/api/crisis/kline?secid=${m.secid}&from=${crisis.period[0]}&to=${crisis.period[1]}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json?.ok && Array.isArray(json.bars) && json.bars.length) return [m.name, json.bars as Bar[]];
          } catch {
            /* fallthrough */
          }
          return [m.name, null];
        }),
      );
      if (!cancelled) setSeries(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [crisis]);

  const option: EChartsOption = useMemo(() => {
    if (!mainBars?.length) return {};
    const dates = mainBars.map((b) => b.date);
    const cur = node.date;
    const data = mainBars.map((b) => (b.date <= cur ? b.close : null));
    const markData: any[] = [
      {
        xAxis: cur,
        lineStyle: { color: "#dc2626", width: 2 },
        label: { formatter: "当前节点", color: "#dc2626", fontSize: 11, position: "insideEndTop" },
      },
    ];
    for (const n of crisis.nodes) {
      if (n.date <= cur) continue;
      const nearest = [...mainBars].reverse().find((b) => b.date <= n.date);
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
        name: mainMarket.name,
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
  }, [mainBars, node, crisis, mainMarket.name]);

  const anchorDate =
    stepIndex === 0
      ? closeAt(mainBars ?? [], crisis.period[0]) != null
        ? crisis.period[0]
        : (mainBars?.[0]?.date ?? crisis.period[0])
      : crisis.nodes[stepIndex - 1].date;
  const hasQuiz = !!node.quiz;
  const quizAnswered = answeredSteps.has(stepIndex);
  const nextDisabled = hasQuiz && !quizAnswered;

  const handleNext = () => {
    const c0 = closeAt(mainBars ?? [], anchorDate);
    const c1 = closeAt(mainBars ?? [], node.date);
    let ret = 0;
    if (c0 != null && c1 != null && c0 > 0) ret = c1 / c0 - 1;
    accountRef.current?.step(ret);
    if (stepIndex >= crisis.nodes.length - 1) {
      setFinalState(accountRef.current?.getState() ?? null);
      setPhase("finished");
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const handleQuizAnswer = (correct: boolean) => {
    setQuizScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
    setAnsweredSteps((prev) => new Set(prev).add(stepIndex));
  };

  const handleRestart = () => {
    setPhase("intro");
    setStepIndex(0);
    setQuizScore({ correct: 0, total: 0 });
    setAnsweredSteps(new Set());
    setFinalState(null);
    accountRef.current?.start();
  };

  const playerRet = finalState ? finalState.nav / CAPITAL - 1 : 0;

  const fullPeriodRet = useMemo(() => {
    if (!mainBars?.length) return null;
    const c0 = closeAt(mainBars, crisis.period[0]) ?? mainBars[0].close;
    const c1 = closeAt(mainBars, crisis.period[1]) ?? mainBars[mainBars.length - 1].close;
    return c0 > 0 ? c1 / c0 - 1 : null;
  }, [mainBars, crisis]);

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
          </Card>
        </>
      )}

      {phase === "playing" && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">
              节点 <span className="text-primary font-bold">{stepIndex + 1}</span> / {crisis.nodes.length}
            </p>
            <p className="text-xs text-muted font-mono">
              {crisis.period[0]} ~ {crisis.period[1]}
            </p>
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{mainMarket.name} · 收盘价回放</h3>
            {phase === "playing" && <span className="text-xs text-muted">截至 {node.date}</span>}
          </div>
          {mainBars === undefined && (
            <div className="h-72 flex items-center justify-center text-sm text-muted">
              正在加载历史行情…
            </div>
          )}
          {mainBars === null && (
            <div className="h-72 flex items-center justify-center text-sm text-muted">
              主市场历史 K 线暂不可用，行情回放与结算将按 0% 处理
            </div>
          )}
          {mainBars?.length ? <EChart option={option} height={300} /> : null}
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
                  {node.policy && (
                    <div className="mt-3 rounded-md border-l-4 border-amber-500 bg-amber-500/5 p-3">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">政策应对</p>
                      <p className="text-[13px] leading-relaxed">{node.policy}</p>
                    </div>
                  )}
                  {node.marketNote && (
                    <p className="mt-3 text-[13px] text-muted italic">市场环境：{node.marketNote}</p>
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

      {phase === "finished" && (
        <>
          <Card className="p-6 border-l-4 border-l-primary">
            <h3 className="font-bold mb-2">对市场的实际影响</h3>
            <p className="text-sm leading-relaxed">{crisis.impact}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-bold mb-4">你的战绩</h3>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-bold font-mono">¥ {fmtMoney(finalState?.nav ?? CAPITAL)}</p>
                <p className={`text-lg font-mono font-bold ${playerRet >= 0 ? "up" : "down"}`}>{fmtPct(playerRet)}</p>
              </div>
              <p className="text-xs text-muted mt-1">初始资金 ¥ {fmtMoney(CAPITAL)}</p>
              <div className="mt-4 rounded-lg border border-border p-3">
                <p className="text-xs text-muted mb-1">决策测验得分</p>
                <p className="text-xl font-bold font-mono">
                  {quizScore.correct}<span className="text-muted font-normal"> / {quizScore.total}</span>
                </p>
                <p className="text-xs text-muted mt-1">{scoreTier}</p>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold mb-4">策略对照</h3>
              <div className="space-y-3">
                {crisis.cohorts.map((c) => {
                  let cmp: { text: string; diff?: number } | null = null;
                  if (c.label.includes("满仓") && fullPeriodRet != null) {
                    cmp = { text: "你 vs 满仓持有指数", diff: playerRet - fullPeriodRet };
                  } else if (c.label.includes("现金")) {
                    cmp = { text: "你 vs 现金为王（收益 0%）", diff: playerRet };
                  }
                  return (
                    <div key={c.label} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-semibold">{c.label}</p>
                      <p className="text-[13px] text-muted leading-relaxed mt-1">{c.description}</p>
                      {cmp ? (
                        <p className={`text-xs font-mono mt-2 ${(cmp.diff ?? 0) >= 0 ? "up" : "down"}`}>
                          {cmp.text}：{fmtPct(cmp.diff ?? 0)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted mt-2">
                          你的收益 {fmtPct(playerRet)}，请与该策略描述对照复盘
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-bold mb-4">专业建议</h3>
            <div className="space-y-3">
              {crisis.advice.map((a, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border p-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary-dark transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> 重新经历
            </button>
            <button
              onClick={onExit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border hover:border-primary/50 text-muted font-medium transition-colors"
            >
              <Check className="w-4 h-4" /> 返回列表
            </button>
          </div>
        </>
      )}
    </div>
  );
}