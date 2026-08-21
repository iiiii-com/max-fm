"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import type { EChartsOption } from "echarts";
import EChart from "@/components/charts/EChart";
import { Badge, Card } from "@/components/ui";
import VirtualAccount, { type VirtualAccountHandle } from "./VirtualAccount";
import DecisionQuiz from "./DecisionQuiz";
import PanicGauge from "./PanicGauge";
import type { Crisis, CrisisStage, InvestorMove, Regime } from "@/lib/data/crisis/types";

type Phase = "intro" | "playing" | "finished";

const CAPITAL = 1_000_000;

const EXPOSURE: Record<InvestorMove["stance"], number> = { cut: 0.1, hold: 0.6, buy: 1 };

const STANCE_META: Record<InvestorMove["stance"], { label: string; cls: string }> = {
  cut: { label: "清仓避险", cls: "border-red-500/50 text-red-600 dark:text-red-400" },
  hold: { label: "减仓观望", cls: "border-amber-500/50 text-amber-600 dark:text-amber-400" },
  buy: { label: "重仓抄底", cls: "border-green-500/50 text-green-600 dark:text-green-400" },
};

const REGIME_META: Record<CrisisStage["regime"], { label: string; dot: string }> = {
  crash: { label: "回调", dot: "bg-red-600" },
  rally: { label: "上涨", dot: "bg-green-600" },
  range: { label: "震荡", dot: "bg-stone-500" },
};

interface StageTip {
  strategy: string;
  grade: "A" | "B" | "C";
  winRate: string;
  drawdown: string;
}

const GRADE_META: Record<StageTip["grade"], { label: string; cls: string }> = {
  A: { label: "A · 高确定性", cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
  B: { label: "B · 中等确定性", cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  C: { label: "C · 需谨慎", cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800" },
};

/** 各危机的阶段场景化策略（数据补丁层；未覆盖的危机走通用兜底） */
const STAGE_TIPS: Record<string, StageTip[]> = {
  "2008-subprime": [
    { strategy: "警惕利率与信用信号：拆借利率异动、基金冻结赎回即是警报，逐步降杠杆、保留现金，不参与最后的狂欢。", grade: "B", winRate: "历史胜率 55-65%", drawdown: "可躲过 -57% 主跌浪" },
    { strategy: "危机初期不猜底：传统利率工具已失灵，先清高杠杆仓位，持币等待「政策底」信号（存款担保、央行注资）。", grade: "A", winRate: "历史胜率 70-80%", drawdown: "过早抄底最大回撤约 -30%" },
    { strategy: "反弹不追：政策传闻驱动的反弹多为诱多，用仓位控制替代方向预判，反弹中继续降杠杆。", grade: "B", winRate: "历史胜率 50-60%", drawdown: "追反弹再套约 -15%" },
    { strategy: "极端恐慌不接飞刀：系统性风险未出清前现金为王，只在明确兜底信号（存款担保、大行注资）落地后分批介入。", grade: "A", winRate: "历史胜率 75-85%", drawdown: "接飞刀个股最大回撤 -90%" },
    { strategy: "区分政策底与市场底：QE 之后往往还有二次探底，等右侧确认（放量收复关键均线）再进场，避免抄在政策底与市场底之间。", grade: "B", winRate: "历史胜率 55-65%", drawdown: "二次探底再跌约 -20%" },
    { strategy: "复苏期重仓核心资产：政策底与市场底双确认后，用仓位与耐心吃完整轮反弹，避免频繁进出。", grade: "A", winRate: "历史胜率 70-80%", drawdown: "主要风险是踏空" },
  ],
  "2015-ashare-crash": [
    { strategy: "杠杆牛顶部信号：融资余额创高、监管喊话、新股天量发行即减仓信号，逐步兑现、不追高、不加杠杆。", grade: "B", winRate: "历史胜率 55-65%", drawdown: "满杠杆最大回撤 -60% 以上" },
    { strategy: "踩踏初期无条件降杠杆：千股跌停意味着流动性枯竭，此时现金为王，任何反弹都是减仓机会。", grade: "A", winRate: "历史胜率 70-80%", drawdown: "硬扛最大回撤 -45%" },
    { strategy: "救市不等于见底：政策底之后还有市场底，反弹分批减仓，不赌单一方向。", grade: "B", winRate: "历史胜率 50-60%", drawdown: "二次崩盘再跌 -15%" },
    { strategy: "熔断是流动性事件：连续熔断后短期超跌反弹概率高，但只适合轻仓博弈，不改变中期趋势判断。", grade: "C", winRate: "历史胜率 40-50%", drawdown: "博反弹被套约 -10%" },
    { strategy: "修复期关注核心资产：国家队入场与杠杆出清后，慢牛由白马核心资产主导，逢低分批布局、长期持有。", grade: "A", winRate: "历史胜率 70-80%", drawdown: "短期波动 -8%" },
  ],
};

/** 市场情绪刻度（贪婪 ↔ 恐慌）：按阶段状态映射，纯展示增强 */
const SENTIMENT_LEVEL: Record<Regime, { label: string; pct: number; color: string }> = {
  crash: { label: "恐慌", pct: 86, color: "#dc2626" },
  rally: { label: "贪婪", pct: 24, color: "#c8102e" },
  range: { label: "中性", pct: 55, color: "#6b7280" },
};

/** 未配置策略的阶段：按市场状态给通用纪律 */
function fallbackTip(regime: Regime): StageTip {
  if (regime === "crash") return { strategy: "熊市铁律：先保本金再谈收益——止损纪律优先，仓位是唯一可完全控制的变量。", grade: "C", winRate: "通用纪律", drawdown: "不设止损最大回撤不可控" };
  if (regime === "rally") return { strategy: "牛市铁律：趋势未破不轻易下车，但拒绝在情绪最亢奋时追加杠杆。", grade: "C", winRate: "通用纪律", drawdown: "高位加杠杆风险陡增" };
  return { strategy: "震荡铁律：区间思维，不满仓不空仓，用仓位波动换取心态稳定。", grade: "C", winRate: "通用纪律", drawdown: "追涨杀跌反复磨损" };
}

const LEVEL_META: Record<Crisis["level"], { label: string; tone: "red" | "blue" | "gray" }> = {
  major: { label: "特大危机", tone: "red" },
  standard: { label: "标准危机", tone: "blue" },
  brief: { label: "简版", tone: "gray" },
};

const fmtMoney = (n: number) => Math.round(n).toLocaleString("zh-CN");
const fmtPct = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

/** 全球市场地区分组（用于联动面板） */
const REGION_ORDER = ["美洲", "欧洲", "亚太", "商品与汇率"] as const;
function regionOf(name: string): (typeof REGION_ORDER)[number] {
  if (/标普|道琼|纳斯达克|纳指|S&P/.test(name)) return "美洲";
  if (/FTSE|DAX|CAC|伦敦|德国|法国|英国|欧洲/.test(name)) return "欧洲";
  if (/恒生|日经|KOSPI|韩国|上证|综指|深证|创业板|新加坡|印度|A股/.test(name)) return "亚太";
  return "商品与汇率";
}

interface Bar {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

/** 是否具备完整 OHLC（可画蜡烛图） */
function hasOHLC(bars: Bar[]): boolean {
  return bars.length > 0 && bars[0].open != null && bars[0].high != null && bars[0].low != null;
}

const CANDLE_UP = "#c8102e";
const CANDLE_DOWN = "#0f8a5f";

/**
 * 构造「蜡烛图 + 成交量」双区图表。
 * 数据完整（OHLC）时画蜡烛图，否则回退收盘价折线。
 */
function mkCandleOption(bars: Bar[], opts: { markData?: any[]; markArea?: any[]; dataZoom?: boolean } = {}): EChartsOption {
  if (!bars.length) return {};
  const dates = bars.map((b) => b.date);
  const base: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params: any) => {
        const arr = Array.isArray(params) ? params : [params];
        const i = arr[0]?.dataIndex ?? 0;
        const b = bars[i];
        if (!b) return "";
        const lines = arr.map((p: any) => `${p.marker}${p.seriesName}: ${p.value ?? "—"}`).join("<br/>");
        return `<b>${b.date}</b><br/>开 ${b.open ?? "—"}　高 ${b.high ?? "—"}<br/>收 ${b.close}　低 ${b.low ?? "—"}<br/>${lines}`;
      },
    },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: [
      { left: 56, right: 16, top: 36, height: "56%" },
      { left: 56, right: 16, top: "72%", height: "18%" },
    ],
    xAxis: [
      { type: "category", data: dates, gridIndex: 0, axisLabel: { fontSize: 10 }, boundaryGap: true },
      { type: "category", data: dates, gridIndex: 1, axisLabel: { show: false }, boundaryGap: true },
    ],
    yAxis: [
      {
        type: "value", scale: true, gridIndex: 0,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      { type: "value", gridIndex: 1, axisLabel: { fontSize: 9 }, splitLine: { show: false } },
    ],
    series: [],
  };

  if (opts.dataZoom) {
    base.dataZoom = [
      { type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 },
      { type: "slider", xAxisIndex: [0, 1], height: 14, bottom: 2, start: 0, end: 100 },
    ];
  }

  const candleSeries: any[] = [];
  if (hasOHLC(bars)) {
    candleSeries.push({
      name: "K 线",
      type: "candlestick",
      data: bars.map((b) => [b.open, b.close, b.low, b.high]),
      itemStyle: { color: CANDLE_UP, color0: CANDLE_DOWN, borderColor: CANDLE_UP, borderColor0: CANDLE_DOWN },
    });
    candleSeries.push({
      name: "成交量",
      type: "bar",
      xAxisIndex: 1,
      yAxisIndex: 1,
      barWidth: "60%",
      data: bars.map((b) => ({
        value: b.volume ?? 0,
        itemStyle: { color: (b.close ?? 0) >= (b.open ?? 0) ? "rgba(200,16,46,0.55)" : "rgba(15,138,95,0.55)" },
      })),
    });
  } else {
    candleSeries.push({
      name: "收盘价",
      type: "line",
      data: bars.map((b) => b.close),
      showSymbol: false,
      smooth: true,
      lineStyle: { color: CANDLE_UP, width: 2 },
      itemStyle: { color: CANDLE_UP },
      areaStyle: {
        color: {
          type: "linear", x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(200,16,46,0.22)" },
            { offset: 1, color: "rgba(200,16,46,0)" },
          ],
        },
      },
    });
  }
  if (opts.markData?.length) {
    candleSeries[0].markLine = { symbol: "none", silent: true, data: opts.markData };
  }
  if (opts.markArea?.length) {
    candleSeries[0].markArea = { silent: true, data: opts.markArea };
  }
  base.series = candleSeries;
  return base;
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
  const [stageIndex, setStageIndex] = useState(0);
  const [moveChosen, setMoveChosen] = useState<Record<number, number>>({});
  /** 阶段仓位（0-100）：三选一预设与滑杆统一写到这，作为结算依据 */
  const [positionPct, setPositionPct] = useState<Record<number, number>>({});
  /** intro 阶段：主市场真实 K 线（用于数据卡旁的事件标注图） */
  const [introKline, setIntroKline] = useState<Bar[] | null>(null);
  const [introKlineErr, setIntroKlineErr] = useState("");
  const [introMarket, setIntroMarket] = useState<string>("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [autoplay, setAutoplay] = useState(false);
  const accountRef = useRef<VirtualAccountHandle>(null);

  const hasStages = !!crisis.stages?.length;
  const stage = hasStages ? crisis.stages![Math.min(stageIndex, crisis.stages!.length - 1)] : null;

  const mainMarket = crisis.markets[0];
  const marketBars = series[mainMarket.name];

  // intro 阶段拉取真实 K 线：优先内置快照（历史时期在线接口覆盖不到），否则依次尝试各市场在线接口
  useEffect(() => {
    if (phase !== "intro") return;
    let cancelled = false;
    setIntroKlineErr("");
    setIntroKline(null);
    (async () => {
      // 1) 内置快照 K 线
      for (const m of crisis.markets) {
        const snap = crisis.snapshotKline?.[m.name];
        if (snap && snap.length > 2) {
          if (!cancelled) {
            setIntroKline(snap as Bar[]);
            setIntroMarket(`${m.name}（内置月度数据）`);
          }
          return;
        }
      }
      // 2) 在线接口
      for (const m of crisis.markets) {
        try {
          const url = `/api/crisis/kline?secid=${m.secid}&from=${crisis.period[0]}&to=${crisis.period[1]}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
          const json = await res.json();
          if (json?.ok && Array.isArray(json.bars) && json.bars.length) {
            if (!cancelled) {
              setIntroKline(json.bars as Bar[]);
              setIntroMarket(m.name);
            }
            return;
          }
        } catch {
          /* try next */
        }
      }
      if (!cancelled) {
        setIntroKline(null);
        setIntroKlineErr("历史 K 线暂不可用（数据源限制），已切换为事件时间轴模式");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, crisis]);
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
    // 播放中：当前节点之后用半透明遮罩标记“尚未发生”
    const markArea: any[] = [];
    if (phase === "playing") {
      const next = activeBars.find((b) => b.date > cur);
      const last = activeBars[activeBars.length - 1]?.date;
      if (next && last && next.date <= last) {
        markArea.push([
          { xAxis: next.date, itemStyle: { color: "rgba(139,139,133,0.14)" } },
          { xAxis: last },
        ]);
      }
    }
    return mkCandleOption(activeBars, { markData, markArea });
  }, [activeBars, node, crisis, viewKey, phase]);

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

  const stageRet = (s: CrisisStage): number => {
    if (!marketBars?.length) return 0;
    const c0 = closeAt(marketBars, s.from) ?? closeAt(marketBars, crisis.period[0]);
    const c1 = closeAt(marketBars, s.to) ?? closeAt(marketBars, crisis.period[1]);
    if (c0 == null || c1 == null || c0 <= 0) return 0;
    return c1 / c0 - 1;
  };

  const stageMoveRet = (s: CrisisStage, move: InvestorMove): number => stageRet(s) * EXPOSURE[move.stance];

  /** 阶段实际暴露度：滑杆仓位（或三选一预设）换算 */
  const exposureFor = (i: number): number => {
    if (positionPct[i] != null) return positionPct[i] / 100;
    const chosen = moveChosen[i];
    return chosen != null ? EXPOSURE[crisis.stages![i].moves[chosen].stance] : 0;
  };

  const pathRet = (stance: InvestorMove["stance"]): number => {
    if (!hasStages) return 0;
    let nav = CAPITAL;
    for (const s of crisis.stages!) nav *= 1 + stageRet(s) * EXPOSURE[stance];
    return nav / CAPITAL - 1;
  };

  const playerStageNav = useMemo(() => {
    if (!hasStages) return null;
    let nav = CAPITAL;
    const out: Array<{ name: string; date: string; ret: number; move: number | null; nav: number }> = [];
    for (let i = 0; i < crisis.stages!.length; i++) {
      const s = crisis.stages![i];
      const ret = stageRet(s);
      const chosen = moveChosen[i];
      const exp = exposureFor(i);
      nav *= 1 + ret * exp;
      out.push({ name: s.name, date: s.to, ret, move: chosen, nav });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crisis, marketBars, moveChosen, positionPct]);

  const stageOption: EChartsOption = useMemo(() => {
    if (!activeBars?.length || !stage) return {};
    const dates = activeBars.map((b) => b.date);
    const markArea: any[] = [];
    const sFrom = dates.includes(stage.from)
      ? stage.from
      : ([...activeBars].reverse().find((b) => b.date <= stage.from)?.date ?? dates[0]);
    const sTo = dates.includes(stage.to)
      ? stage.to
      : ([...activeBars].reverse().find((b) => b.date <= stage.to)?.date ?? dates[dates.length - 1]);
    const bg =
      stage.regime === "crash"
        ? { color: "rgba(220,38,38,0.10)" }
        : stage.regime === "rally"
          ? { color: "rgba(22,163,74,0.10)" }
          : { color: "rgba(139,139,133,0.10)" };
    if (sFrom && sTo) markArea.push([{ xAxis: sFrom, ...bg }, { xAxis: sTo }]);
    const markLines: any[] = [];
    for (const s of crisis.stages ?? []) {
      const d = dates.includes(s.to) ? s.to : [...activeBars].reverse().find((b) => b.date <= s.to)?.date;
      if (!d) continue;
      markLines.push({
        xAxis: d,
        lineStyle: { color: s.regime === "crash" ? "rgba(220,38,38,0.45)" : s.regime === "rally" ? "rgba(22,163,74,0.45)" : "rgba(139,139,133,0.5)", type: "dashed", width: 1 },
        label: { formatter: `${s.name}`, color: "#737373", fontSize: 9, position: "insideEndTop" },
      });
    }
    return mkCandleOption(activeBars, { markData: markLines, markArea });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBars, stage, viewKey, crisis]);

  const stageCompareOption: EChartsOption = useMemo(() => {
    if (!playerStageNav?.length) return {};
    const dates = playerStageNav.map((h) => h.date);
    const seriesData: Array<{ name: string; data: number[]; color: string; dash?: boolean }> = [
      { name: "你", data: [], color: "#dc2626" },
      { name: "全程重仓", data: [], color: "#16a34a" },
      { name: "全程半仓", data: [], color: "#d97706" },
      { name: "全程清仓", data: [], color: "#6b7280", dash: true },
    ];
    const path = (stance: InvestorMove["stance"]) => {
      let nav = CAPITAL;
      const out: number[] = [];
      for (const s of crisis.stages!) {
        nav *= 1 + stageRet(s) * EXPOSURE[stance];
        out.push((nav / CAPITAL) * 100);
      }
      return out;
    };
    const player: number[] = [];
    for (let i = 0; i < crisis.stages!.length; i++) {
      const nav = playerStageNav[i].nav;
      player.push((nav / CAPITAL) * 100);
    }
    seriesData[0].data = player;
    seriesData[1].data = path("buy");
    seriesData[2].data = path("hold");
    seriesData[3].data = path("cut");
    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 16, top: 30, bottom: 44 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
      yAxis: {
        type: "value", scale: true,
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      series: seriesData.map((s) => ({
        name: s.name, type: "line" as const, data: s.data, smooth: true,
        symbol: "circle", symbolSize: 5,
        lineStyle: { color: s.color, width: 2, type: s.dash ? ("dashed" as const) : ("solid" as const) },
        itemStyle: { color: s.color },
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerStageNav, crisis]);

  /** 播放中实时净值迷你图：你 vs 全程重仓 / 全程清仓（截至当前阶段） */
  const liveNavOption: EChartsOption = useMemo(() => {
    if (!hasStages || !playerStageNav?.length) return {};
    const upto = Math.min(stageIndex, playerStageNav.length - 1);
    const rows = playerStageNav.slice(0, upto + 1);
    const dates = rows.map((h) => h.name);
    const player = rows.map((h) => (h.nav / CAPITAL) * 100);
    const bench = (stance: InvestorMove["stance"]) => {
      let nav = CAPITAL;
      const out: number[] = [];
      for (let i = 0; i <= upto; i++) {
        nav *= 1 + stageRet(crisis.stages![i]) * EXPOSURE[stance];
        out.push((nav / CAPITAL) * 100);
      }
      return out;
    };
    return {
      tooltip: { trigger: "axis", valueFormatter: (v: any) => `${Number(v).toFixed(1)}` },
      legend: { bottom: 0, left: 8, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 10 } },
      grid: { left: 44, right: 12, top: 24, bottom: 40 },
      xAxis: { type: "category", data: dates, axisLabel: { fontSize: 9, rotate: 30 } },
      yAxis: {
        type: "value", scale: true, axisLabel: { fontSize: 9 },
        splitLine: { lineStyle: { color: "#e5e5e0", type: "dashed" } },
      },
      series: [
        { name: "你", type: "line", data: player, smooth: true, symbol: "circle", symbolSize: 5, lineStyle: { color: "#c8102e", width: 2 }, itemStyle: { color: "#c8102e" } },
        { name: "全程重仓", type: "line", data: bench("buy"), smooth: true, showSymbol: false, lineStyle: { color: "#16a34a", width: 1.5 }, itemStyle: { color: "#16a34a" } },
        { name: "全程清仓", type: "line", data: bench("cut"), smooth: true, showSymbol: false, lineStyle: { color: "#6b7280", width: 1.5, type: "dashed" }, itemStyle: { color: "#6b7280" } },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStages, playerStageNav, stageIndex, crisis]);

  /** intro：真实 K 线 + 事件标注图（事件日期映射到最近交易日，区间按涨跌上底色） */
  const narrativeChartOption: EChartsOption = useMemo(() => {
    if (!introKline?.length) return {};
    const tl = crisis.narrative?.timeline ?? [];
    if (!tl.length) return mkCandleOption(introKline, { dataZoom: true });
    const idxByDate = new Map(introKline.map((b, i) => [b.date, i]));
    const mapped = tl
      .map((t) => {
        const exact = idxByDate.get(t.date);
        if (exact != null) return { t, idx: exact, date: t.date };
        let prev: number | null = null;
        for (let i = 0; i < introKline.length; i++) {
          if (introKline[i].date > t.date) break;
          prev = i;
        }
        return prev != null ? { t, idx: prev, date: introKline[prev].date } : null;
      })
      .filter((x): x is { t: (typeof tl)[number]; idx: number; date: string } => x != null);

    const markData: any[] = [];
    const markArea: any[] = [];
    for (let i = 0; i < mapped.length; i++) {
      const m = mapped[i];
      const startIdx = i === 0 ? 0 : mapped[i - 1].idx;
      const startClose = introKline[startIdx]?.close ?? 0;
      const endClose = introKline[m.idx]?.close ?? 0;
      const up = endClose >= startClose;
      markData.push({
        xAxis: m.date,
        lineStyle: { color: up ? "rgba(200,16,46,0.55)" : "rgba(15,138,95,0.55)", width: 1 },
        label: {
          show: true,
          formatter: m.t.event.length > 9 ? `${m.t.event.slice(0, 9)}…` : m.t.event,
          fontSize: 9,
          color: up ? "#c8102e" : "#0f8a5f",
          position: "insideEndTop",
        },
      });
      if (i > 0) {
        markArea.push([
          { xAxis: mapped[i - 1].date, itemStyle: { color: up ? "rgba(200,16,46,0.05)" : "rgba(15,138,95,0.05)" } },
          { xAxis: m.date },
        ]);
      }
    }
    return mkCandleOption(introKline, { markData, markArea, dataZoom: true });
  }, [introKline, crisis]);

  useEffect(() => {
    if (!autoplay || phase !== "playing" || !hasStages) return;
    const t = setInterval(() => {
      if (!revealed.has(stageIndex)) return;
      if (stageIndex >= crisis.stages!.length - 1) {
        setAutoplay(false);
        handleStageFinish();
      } else {
        setStageIndex((i) => i + 1);
      }
    }, 5200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, phase, stageIndex, revealed, hasStages]);

  const chooseMove = (mi: number) => {
    setMoveChosen((m) => ({ ...m, [stageIndex]: mi }));
    // 预设仓位同步到滑杆：清仓10 / 减仓60 / 重仓100
    const stance = crisis.stages![stageIndex].moves[mi].stance;
    setPositionPct((p) => ({ ...p, [stageIndex]: Math.round(EXPOSURE[stance] * 100) }));
    setRevealed((r) => new Set(r).add(stageIndex));
    setAutoplay(false);
  };

  /** 滑杆自定义仓位：写入仓位并视为已决策 */
  const choosePosition = (pct: number) => {
    setPositionPct((p) => ({ ...p, [stageIndex]: pct }));
    setRevealed((r) => new Set(r).add(stageIndex));
    setAutoplay(false);
  };

  const handleStageNext = () => {
    if (!revealed.has(stageIndex)) return;
    if (stageIndex >= crisis.stages!.length - 1) {
      handleStageFinish();
    } else {
      setStageIndex((i) => i + 1);
      setAutoplay(true);
    }
  };

  const handleStageFinish = () => {
    const nav = playerStageNav?.[playerStageNav.length - 1]?.nav ?? CAPITAL;
    setFinalState({ cash: 0, position: 0, nav });
    setPhase("finished");
    setAutoplay(false);
  };

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
    setStageIndex(0);
    setMoveChosen({});
    setPositionPct({});
    setRevealed(new Set());
    setAutoplay(false);
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
@keyframes crisisFadeIn { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes crisisRevealPop { 0% { opacity: 0; transform: scale(0.92) translateY(4px); } 60% { opacity: 1; transform: scale(1.02) translateY(-1px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes crisisSlideUp { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
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
            {crisis.narrative?.prelude && (
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted mb-1.5">市场环境</p>
                  <p className="text-sm leading-relaxed text-foreground/85">{crisis.narrative.prelude.marketEnv}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted mb-1.5">当时的世界</p>
                  <p className="text-sm leading-relaxed text-foreground/85">{crisis.narrative.prelude.world}</p>
                </div>
              </div>
            )}
          </Card>

          {crisis.narrative?.dataCard && crisis.narrative.dataCard.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-bold">数据速览卡</h3>
                {introKlineErr && <span className="text-[10px] text-muted">{introKlineErr}</span>}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* 真实 K 线 + 事件标注 */}
                <div className="lg:col-span-3">
                  {introKline && introKline.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-semibold">{introMarket || mainMarket.name} 真实 K 线</span>
                        <span className="text-[10px] text-muted">红=上涨触发 · 绿=下跌触发 · 拖动/滚轮缩放 · 悬停看详情</span>
                      </div>
                      <EChart option={narrativeChartOption} height={340} />
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 border-t border-border/60 pt-2.5">
                        {crisis.narrative.timeline?.map((t) => (
                          <span key={t.date} className="text-[10px] text-muted" title={`${t.date} ${t.event}`}>
                            <span className="font-mono">{t.date}</span> {t.event.slice(0, 12)}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-full min-h-[220px] rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted px-4 text-center">
                      {introKlineErr || "K 线加载中…"}
                    </div>
                  )}
                </div>
                {/* 数据速览卡 */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 self-start">
                  {crisis.narrative.dataCard.map((d) => (
                    <div key={d.label} className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted mb-1">{d.label}</p>
                      <p className="text-sm font-semibold leading-snug">{d.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {crisis.narrative && (crisis.narrative.roots || crisis.narrative.timeline || crisis.narrative.aftermath) && (
            <Card className="p-6">
              <h3 className="font-bold mb-3">危机全景 · 从根到尾</h3>
              <div className="space-y-4">
                {crisis.narrative.roots && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1.5">根源：结构性失衡 · 制度缺陷 · 长期积累</p>
                    <p className="text-sm leading-relaxed text-foreground/85">{crisis.narrative.roots}</p>
                  </div>
                )}
                {crisis.narrative.timeline && crisis.narrative.timeline.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1.5">演进过程：关键节点</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted border-b border-border text-xs">
                            <th className="py-1.5 pr-3 font-medium">日期</th>
                            <th className="py-1.5 pr-3 font-medium">事件</th>
                            <th className="py-1.5 font-medium">影响</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crisis.narrative.timeline.map((t) => (
                            <tr key={t.date} className="border-b border-border/50 last:border-0 align-top">
                              <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">{t.date}</td>
                              <td className="py-2 pr-3 text-xs leading-relaxed">{t.event}</td>
                              <td className="py-2 text-xs text-muted leading-relaxed">{t.impact}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {crisis.narrative.aftermath && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1.5">结局与影响</p>
                    <p className="text-sm leading-relaxed text-foreground/85">{crisis.narrative.aftermath}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

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

          {hasStages && (
            <Card className="p-6">
              <h3 className="font-bold mb-1">危机全景 · 从根到尾</h3>
              <p className="text-xs text-muted mb-4">
                本轮危机可拆为 {crisis.stages!.length} 个阶段（红=回调 / 绿=上涨 / 灰=震荡），每个阶段你都要选择投资者的三种操作之一，并看到真实的市场结果。
              </p>
              <div className="flex items-stretch gap-1.5 overflow-x-auto pb-2">
                {crisis.stages!.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5 shrink-0" style={{ animation: `crisisFadeIn 0.4s ease ${i * 0.08}s both` }}>
                    <div className="rounded-lg border border-border px-3 py-2 min-w-[132px]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${REGIME_META[s.regime].dot}`} />
                        <span className="text-[10px] font-mono text-muted">阶段 {i + 1}</span>
                      </div>
                      <p className="text-xs font-semibold leading-tight">{s.name}</p>
                      <p className="text-[10px] text-muted mt-0.5 font-mono">
                        {s.from.slice(0, 7)} ~ {s.to.slice(0, 7)}
                      </p>
                    </div>
                    {i < crisis.stages!.length - 1 && <span className="text-muted">→</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {phase === "playing" && hasStages && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">
              阶段 <span className="text-primary font-bold">{stageIndex + 1}</span> / {crisis.stages!.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setStageIndex((i) => Math.max(0, i - 1))}
                disabled={stageIndex === 0}
                className="p-1.5 rounded-md border border-border hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="上一阶段"
              >
                <StepBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setAutoplay((p) => !p)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                  autoplay ? "bg-primary text-white border-primary" : "border-border text-muted hover:border-primary/50"
                }`}
                title={autoplay ? "暂停自动播放" : "自动播放（已作答阶段每 5 秒推进）"}
              >
                {autoplay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {autoplay ? "暂停" : "自动播放"}
              </button>
              <button
                onClick={handleStageNext}
                disabled={!revealed.has(stageIndex)}
                className="p-1.5 rounded-md border border-border hover:border-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="下一阶段"
              >
                <StepForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {crisis.stages!.map((s, i) => {
              const isCurrent = i === stageIndex;
              const isPast = i < stageIndex;
              const chosen = moveChosen[i];
              return (
                <button
                  key={s.name}
                  onClick={() => {
                    if (i > stageIndex && !revealed.has(stageIndex)) return;
                    setStageIndex(i);
                  }}
                  title={`${s.from} ~ ${s.to} · ${s.name}`}
                  className="group shrink-0 flex flex-col items-center gap-1 px-0.5"
                >
                  <span className="relative flex items-center justify-center h-5">
                    <span
                      className={`rounded-full transition-all duration-300 ${
                        isCurrent
                          ? "w-4 h-4 scale-110"
                          : isPast
                            ? "w-3 h-3 opacity-60"
                            : "w-2.5 h-2.5 opacity-40"
                      } ${REGIME_META[s.regime].dot}`}
                    />
                    {chosen !== undefined && (
                      <span className="absolute -top-0.5 -right-1 w-3.5 h-3.5 rounded-full text-[9px] leading-none flex items-center justify-center text-white font-bold bg-down">
                        ✓
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] whitespace-nowrap ${
                      isCurrent ? "text-primary font-bold" : "text-muted"
                    }`}
                  >
                    {s.name}
                  </span>
                  <span className="text-[9px] font-mono text-muted">{REGIME_META[s.regime].label}</span>
                </button>
              );
            })}
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, crisis.stages!.length - 1)}
            value={stageIndex}
            onChange={(e) => {
              const target = Number(e.target.value);
              if (target > stageIndex && !revealed.has(stageIndex)) return;
              setStageIndex(target);
            }}
            className="w-full h-1.5 cursor-pointer rounded-full"
            style={{ accentColor: "var(--primary)" }}
            aria-label="拖动时间轴切换阶段"
          />
          <div className="flex justify-between mt-1">
            {crisis.stages!.map((s, i) => (
              <span
                key={s.name}
                className={`text-[8px] font-mono truncate max-w-[60px] text-center ${
                  i === stageIndex ? "text-primary font-bold" : "text-muted/60"
                }`}
                title={s.name}
              >
                {s.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      {phase === "playing" && !hasStages && (
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          {/* ── Left: Narrative Panel ── */}
          <div className="space-y-4 min-w-0">
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
            ) : hasStages && stage ? (
              <Card className="p-5">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                    {stage.from.slice(0, 10)} ~ {stage.to.slice(0, 10)}
                  </span>
                  <h3 className="font-bold">{stage.name}</h3>
                  <Badge tone={stage.regime === "crash" ? "red" : stage.regime === "rally" ? "green" : "gray"}>
                    {REGIME_META[stage.regime].label}
                  </Badge>
                </div>
                <div className="relative pl-4 border-l-2 border-primary/30">
                  <p className="text-sm leading-relaxed italic text-foreground/80">{stage.narrative}</p>
                </div>

                {/* 市场情绪刻度 */}
                {(() => {
                  const s = SENTIMENT_LEVEL[stage.regime];
                  return (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted">贪婪</span>
                        <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label} {s.pct}</span>
                        <span className="text-[10px] text-muted">恐慌</span>
                      </div>
                      <div className="relative h-1.5 rounded-full" style={{ background: "linear-gradient(to right, #c8102e, #e5e5e0 50%, #dc2626)" }}>
                        <span
                          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all duration-300"
                          style={{ left: `${s.pct}%`, background: s.color, transform: "translate(-50%, -50%)" }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 阶段策略卡：场景策略 + 可执行等级 + 胜率/回撤 + 风险提示 */}
                {(() => {
                  const tip = STAGE_TIPS[crisis.id]?.[stageIndex] ?? fallbackTip(stage.regime);
                  return (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20 p-3">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[10px] font-semibold tracking-wide text-blue-700 dark:text-blue-300">本阶段策略</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${GRADE_META[tip.grade].cls}`}>
                          {GRADE_META[tip.grade].label}
                        </span>
                        <span className="ml-auto text-[10px] text-muted font-mono">{tip.winRate}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/85">{tip.strategy}</p>
                      <p className="text-[10px] text-muted mt-1.5">
                        风险提示：{tip.drawdown}。历史数据不代表未来，本内容仅供学习，不构成投资建议。
                      </p>
                    </div>
                  );
                })()}

                {stage.globalMarkets && stage.globalMarkets.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <p className="text-[11px] font-semibold text-muted mb-1.5">全球市场联动</p>
                    {stage.globalSummary && (
                      <p className="text-xs text-foreground/80 mb-2 leading-relaxed">{stage.globalSummary}</p>
                    )}
                    <div className="space-y-1.5">
                      {REGION_ORDER.map((region) => {
                        const list = stage.globalMarkets!.filter((gm) => regionOf(gm.name) === region);
                        if (!list.length) return null;
                        return (
                          <div key={region}>
                            <p className="text-[9px] font-semibold text-muted/70 mb-0.5">{region}</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                              {list.map((gm) => (
                                <div key={gm.name} className="flex items-center justify-between gap-1.5 text-xs" title={gm.note}>
                                  <span className="text-muted truncate">{gm.name}</span>
                                  <span className={`font-mono font-semibold shrink-0 ${gm.change >= 0 ? "up" : "down"}`}>
                                    {gm.change >= 0 ? "+" : ""}{(gm.change * 100).toFixed(1)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-muted/70 mt-1.5 leading-relaxed">
                      {stage.globalMarkets!.map((gm) => `${gm.name}：${gm.note}`).join("；")}
                    </p>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-muted mb-2">
                    站在当时，你打算投入多少仓位？（点击预设或拖动滑杆精确设定）
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {stage.moves.map((mv, mi) => {
                      const presetPct = Math.round(EXPOSURE[mv.stance] * 100);
                      const chosen = moveChosen[stageIndex] === mi;
                      const activeByPct = positionPct[stageIndex] === presetPct;
                      const revealedHere = revealed.has(stageIndex);
                      const isBest = mi === stage.bestMove;
                      return (
                        <button
                          key={mv.label}
                          onClick={() => chooseMove(mi)}
                          disabled={revealedHere}
                          className={`text-left rounded-lg border p-3 transition-all ${
                            revealedHere
                              ? chosen || activeByPct
                                ? `border-2 ${isBest ? "border-down" : "border-primary"} bg-primary/5`
                                : isBest
                                  ? "border-down/60 bg-down/5"
                                  : "border-border opacity-60"
                              : activeByPct
                                ? "border-primary/70 bg-primary/5"
                                : "border-border hover:border-primary/60 hover:shadow-sm"
                          }`}
                          style={revealedHere ? { animation: "crisisRevealPop 0.4s ease" } : undefined}
                        >
                          <p className={`text-[10px] font-bold tracking-wide ${STANCE_META[mv.stance].cls}`}>
                            {STANCE_META[mv.stance].label} · {presetPct}% 仓位
                          </p>
                          <p className="text-sm font-semibold mt-0.5">{mv.label}</p>
                          <p className="text-xs text-muted mt-1 leading-relaxed">{mv.desc}</p>
                          {revealedHere && (
                            <div className="mt-2 pt-2 border-t border-border/60" style={{ animation: "crisisFadeIn 0.35s ease 0.1s both" }}>
                              <p className="text-[13px] leading-relaxed">{mv.outcome}</p>
                              <p className={`mt-1.5 text-xs font-bold font-mono ${
                                stageMoveRet(stage, mv) >= 0 ? "up" : "down"
                              }`}>
                                该操作收益 {fmtPct(stageMoveRet(stage, mv))}
                                {isBest && <span className="ml-2 text-down font-semibold">✓ 本阶段最佳</span>}
                              </p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 精确仓位滑杆 */}
                  <div className="mt-3 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium">精确仓位</span>
                      <span className="text-xs font-mono font-semibold text-primary">
                        {positionPct[stageIndex] ?? 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={positionPct[stageIndex] ?? 0}
                      onChange={(e) => choosePosition(Number(e.target.value))}
                      className="w-full h-1.5 cursor-pointer rounded-full"
                      style={{ accentColor: "var(--primary)" }}
                      aria-label="自定义仓位"
                    />
                    <p className="text-[10px] text-muted mt-1.5">
                      拖动即决策（无需点预设）。本阶段真实涨跌 {stageRet(stage) >= 0 ? "+" : ""}
                      {(stageRet(stage) * 100).toFixed(2)}%，按此仓位结算
                      <b className={stageRet(stage) * (positionPct[stageIndex] ?? 0) / 100 >= 0 ? "up" : "down"}>
                        {" "}
                        {fmtPct(stageRet(stage) * (positionPct[stageIndex] ?? 0) / 100)}
                      </b>
                    </p>
                  </div>
                </div>

                {revealed.has(stageIndex) && (
                  <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3" style={{ animation: "crisisSlideUp 0.4s ease 0.15s both" }}>
                    <p className="text-xs text-muted">
                      本阶段市场真实涨跌 <b className={stageRet(stage) >= 0 ? "up" : "down"}>{fmtPct(stageRet(stage))}</b>
                      ，最优操作是"{stage.moves[stage.bestMove].label}"。
                    </p>
                  </div>
                )}
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

          {/* ── Right: Data Dashboard ── */}
          <div className="space-y-3">
            {/* K-line chart */}
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold">K 线回放</h3>
                {phase === "playing" && hasStages && stage && (
                  <span className="text-[10px] text-muted font-mono">
                    真实涨跌：<b className={stageRet(stage) >= 0 ? "up" : "down"}>{fmtPct(stageRet(stage))}</b>
                  </span>
                )}
                {phase === "playing" && !hasStages && <span className="text-[10px] text-muted">截至 {node.date}</span>}
              </div>
              {viewOptions.length > 1 && (
                <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                  {viewOptions.map((key) => (
                    <button
                      key={key}
                      onClick={() => setViewKey(key)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors shrink-0 ${
                        viewKey === key
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted hover:border-primary/50"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}
              {stockRole && <p className="text-[10px] text-muted mb-1">{stockRole}</p>}
              {isNameOnlyView ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
                  <p className="font-medium text-foreground/80 mb-1">该股已退市或历史行情不可得</p>
                  <p className="leading-relaxed max-w-sm mx-auto">{stockRole ?? "危机期间该股大幅波动，具体走势未收录。"}</p>
                </div>
              ) : activeBars === undefined ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted">加载中…</div>
              ) : activeBars === null ? (
                <div className="h-48 flex items-center justify-center text-xs text-muted">K 线不可用</div>
              ) : (
                <div
                  key={pulseKey ?? "chart-static"}
                  className="rounded-lg"
                  style={pulseKey ? { animation: `crisisPulse${pulseKey > 0 ? "Green" : "Red"} 1.2s ease` } : undefined}
                >
                  <EChart option={hasStages && phase === "playing" ? stageOption : option} height={244} />
                </div>
              )}
              {viewKey === mainMarket.name && vixFiltered.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold text-muted mb-0.5">VIX 恐慌指数</p>
                  <EChart option={vixOption} height={80} />
                </div>
              )}
            </Card>

            {/* Global markets */}
            {phase === "playing" && hasStages && stage?.globalMarkets && stage.globalMarkets.length > 0 && (
              <Card className="p-3">
                <p className="text-[10px] font-semibold text-muted mb-2 tracking-wide">全球市场联动</p>
                {stage.globalSummary && (
                  <p className="text-[11px] text-foreground/80 leading-relaxed mb-2">{stage.globalSummary}</p>
                )}
                <div className="space-y-1.5">
                  {REGION_ORDER.map((region) => {
                    const list = stage.globalMarkets!.filter((gm) => regionOf(gm.name) === region);
                    if (!list.length) return null;
                    return (
                      <div key={region}>
                        <p className="text-[9px] font-semibold text-muted/70 mb-0.5">{region}</p>
                        <div className="space-y-0.5">
                          {list.map((gm) => (
                            <div key={gm.name} className="flex items-center justify-between gap-1.5 text-xs" title={gm.note}>
                              <span className="text-muted truncate">{gm.name}</span>
                              <span className={`font-mono font-semibold shrink-0 ${gm.change >= 0 ? "up" : "down"}`}>
                                {gm.change >= 0 ? "+" : ""}{(gm.change * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Panic gauge */}
            <Card className="p-3 flex justify-center">
              <PanicGauge value={panicValue} />
            </Card>

            {/* Decision record / Account */}
            {phase === "playing" && hasStages ? (
              <Card className="p-3">
                <h3 className="text-xs font-semibold mb-2">决策记录 · ¥{fmtMoney(CAPITAL)}</h3>
                <div className="space-y-2">
                  {crisis.stages!.map((s, i) => {
                    const mi = moveChosen[i];
                    const pct = positionPct[i];
                    const exp = exposureFor(i);
                    const r = stageRet(s);
                    return (
                      <div
                        key={s.name}
                        className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${
                          i === stageIndex ? "border-primary/50 bg-primary/5" : "border-border/70"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${REGIME_META[s.regime].dot}`} />
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="shrink-0 font-mono">
                          {pct != null || mi != null ? (
                            <span className={r * exp >= 0 ? "up" : "down"}>
                              {mi != null ? STANCE_META[s.moves[mi].stance].label.slice(0, 2) : "自设"} {pct ?? Math.round(EXPOSURE[s.moves[mi].stance] * 100)}% {fmtPct(r * exp)}
                            </span>
                          ) : (
                            <span className="text-muted">待决策</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {revealed.has(stageIndex) && (
                  <p className="mt-3 text-xs text-muted">
                    当前累计：{playerStageNav ? fmtPct(playerStageNav[stageIndex].nav / CAPITAL - 1) : "—"}
                  </p>
                )}
                {revealed.has(stageIndex) && playerStageNav && (
                  <div className="mt-3 rounded-lg border border-border p-2">
                    <p className="text-[10px] font-semibold text-muted mb-1">实时净值对比（起点 100）</p>
                    <EChart option={liveNavOption} height={120} />
                  </div>
                )}
                <button
                  onClick={handleStageNext}
                  disabled={!revealed.has(stageIndex)}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
                    !revealed.has(stageIndex)
                      ? "bg-border/60 text-muted cursor-not-allowed"
                      : "bg-primary text-white hover:bg-primary-dark"
                  }`}
                >
                  {stageIndex >= crisis.stages!.length - 1 ? "进入结算" : "进入下一阶段"} <span className="text-base">→</span>
                </button>
              </Card>
            ) : (
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
            )}
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
              {[
                { label: "初始资金", value: `¥${fmtMoney(CAPITAL)}`, cls: "" },
                { label: "最终资产", value: `¥${fmtMoney(finalState.nav)}`, cls: "" },
                { label: "本场收益", value: fmtPct(playerRet), cls: playerRet >= 0 ? "up" : "down" },
                { label: "最终仓位", value: `${finalState.position.toFixed(0)}%`, cls: "" },
              ].map((item, i) => (
                <div key={item.label} className="rounded-lg border border-border p-3" style={{ animation: `crisisSlideUp 0.4s ease ${i * 0.08}s both` }}>
                  <p className="text-xs text-muted mb-1">{item.label}</p>
                  <p className={`text-sm font-semibold font-mono ${item.cls}`}>{item.value}</p>
                </div>
              ))}
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
            {hasStages ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {(
                    [
                      { name: "你", desc: "你的阶段决策组合", ret: playerRet, cls: "border-primary" },
                      { name: "全程重仓", desc: "每阶段都满仓抄底", ret: pathRet("buy"), cls: "border-border" },
                      { name: "全程半仓", desc: "每阶段都减仓观望", ret: pathRet("hold"), cls: "border-border" },
                      { name: "全程清仓", desc: "每阶段都清仓避险", ret: pathRet("cut"), cls: "border-border" },
                    ] as const
                  ).map((s) => (
                    <div key={s.name} className={`rounded-lg border p-4 ${s.cls}`}>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-muted mt-0.5 mb-2">{s.desc}</p>
                      <p className={`text-lg font-bold font-mono ${s.ret >= 0 ? "up" : "down"}`}>{fmtPct(s.ret)}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">
                  演算规则：每种操作按固定仓位暴露参与本阶段真实涨跌——清仓 10% / 减仓观望 60% / 重仓抄底 100%。
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </Card>

          {hasStages && playerStageNav && (
            <Card className="p-6">
              <h3 className="font-bold mb-4">阶段操作回顾</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="py-2 pr-3 font-medium">阶段</th>
                      <th className="py-2 pr-3 font-medium text-right">主市场涨跌</th>
                      <th className="py-2 pr-3 font-medium text-right">全球市场</th>
                      <th className="py-2 pr-3 font-medium text-right">你的操作</th>
                      <th className="py-2 pr-3 font-medium text-right">你的阶段收益</th>
                      <th className="py-2 pr-3 font-medium text-right">累计净值</th>
                      <th className="py-2 font-medium text-right">最佳操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crisis.stages!.map((s, i) => {
                      const r = stageRet(s);
                      const mi = moveChosen[i];
                      const chosen = mi != null ? s.moves[mi] : null;
                      const isBestRow = mi != null && mi === s.bestMove;
                      return (
                        <tr
                          key={s.name}
                          className={`border-b border-border/50 ${isBestRow ? "bg-down/5" : i === stageIndex ? "bg-primary/5" : ""}`}
                        >
                          <td className="py-2 pr-3 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${REGIME_META[s.regime].dot}`} />
                            {s.name}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">
                            {s.globalMarkets && s.globalMarkets.length > 0 ? (
                              <div className="flex flex-wrap justify-end gap-x-2">
                                {s.globalMarkets.slice(0, 3).map((gm) => (
                                  <span key={gm.name} className={gm.change >= 0 ? "up" : "down"} title={gm.note}>
                                    {gm.name.slice(0, 4)} {gm.change >= 0 ? "+" : ""}{(gm.change * 100).toFixed(1)}%
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className={`py-2 pr-3 text-right font-mono ${r >= 0 ? "up" : "down"}`}>{fmtPct(r)}</td>
                          <td className="py-2 pr-3 text-right font-mono">
                            {chosen || positionPct[i] != null
                              ? `${chosen ? STANCE_META[chosen.stance].label.slice(0, 2) : "自设"} ${Math.round(exposureFor(i) * 100)}%`
                              : "未选择"}
                          </td>
                          <td className={`py-2 pr-3 text-right font-mono ${chosen || positionPct[i] != null ? (r * exposureFor(i) >= 0 ? "up" : "down") : "text-muted"}`}>
                            {chosen || positionPct[i] != null ? fmtPct(r * exposureFor(i)) : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono font-semibold">
                            ¥{fmtMoney(playerStageNav[i].nav)}
                          </td>
                          <td className={`py-2 text-right font-mono ${mi === s.bestMove ? "up" : ""}`}>
                            {s.moves[s.bestMove].label}
                            {chosen && mi !== s.bestMove && <span className="ml-1 text-muted">(你: {STANCE_META[chosen.stance].label.slice(0, 2)})</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {hasStages && playerStageNav && (
            <Card className="p-6">
              <h3 className="font-bold mb-4">收益曲线对比</h3>
              <p className="text-xs text-muted mb-3">
                以 100 为起点：你的净值 · 全程重仓 / 半仓 / 清仓四种策略在真实阶段涨跌下的累计结果
              </p>
              <EChart option={stageCompareOption} height={320} />
            </Card>
          )}

          {!hasStages && navHistory.length > 0 && (
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

          <Card className="p-6">
            <h3 className="font-bold mb-3">交易心得</h3>
            <ul className="text-sm text-muted space-y-2 leading-relaxed mb-4">
              <li>· 你与"最佳策略"的差距，往往不在判断力，而在仓位与纪律。</li>
              <li>· 危机中少亏即多赚：回撤 50% 需要上涨 100% 才能回本。</li>
              <li>· 政策底 ≠ 市场底：右侧确认比猜底更可执行。</li>
            </ul>
            <p className="text-[11px] text-muted border-t border-border pt-3">
              本内容基于历史公开数据整理，仅供学习交流，不构成任何投资建议。市场有风险，投资需谨慎。
            </p>
          </Card>
        </>
      )}
    </div>
  );
}