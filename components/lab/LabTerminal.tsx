"use client";

/* ============================================================
   LabTerminal —— MX//K线实验室 终端总装
   复刻 GMT//全球市场终端 的布局与交互：
   命令栏(F1/E/D/I) → 行情跑马灯(点击联动标的) → 工具栏(预设/编辑布局)
   → 12 列可编辑组件网格（8 教学模块 + 全球指数/市场宽度/市场脉搏/数据状态）
   → 数据来源检查器 + 键盘帮助
   全部数据基于真实行情与财报接口，严禁虚构。
   ============================================================ */
import { cstToday as cstDateKey } from "@/lib/data/ym";
import { fetchJson, fetchKline } from "@/lib/client/api-cache";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, Lock, RefreshCw, Search, Upload } from "lucide-react";
import "./terminal.css";
import GmtCard from "./GmtCard";
import { GAP, ROWH, makeLayout, useLabGrid, type GridLayout } from "./useLabGrid";
import { CmdBar, Tape, LabToolbar, Inspector, HelpOverlay, useClock, useInspectorDelegate, type InspData, type TapeQuote } from "./TermChrome";
import KlineLab, { type LabBar, type LabMark } from "./KlineLab";
import { detectPatterns } from "./patterns";
import { scanSignals } from "./signals";
import nextDynamic from "next/dynamic";

/*
 * 02～12 号卡片各自带着图表初始化与接口请求，是 /lab 首屏 JS 的主要构成。
 * 它们全部在首屏之下（由 GmtCard 按纵坐标延迟挂载），代码也不必进首屏 chunk——
 * 改成动态 import 后，用户滚动到附近时才下载对应 chunk。
 * 01 号 K 线主图保持静态引入：它是首屏要画的东西，拆开只会多一次往返。
 */
const PatternCard = nextDynamic(() => import("./PatternCard"), { ssr: false });
const RadarCard = nextDynamic(() => import("./RadarCard"), { ssr: false });
const ValuationCard = nextDynamic(() => import("./ValuationCard"), { ssr: false });
const ScanCard = nextDynamic(() => import("./ScanCard"), { ssr: false });
const LevelsCard = nextDynamic(() => import("./LevelsCard"), { ssr: false });
const TrendCard = nextDynamic(() => import("./TrendCard"), { ssr: false });
const BacktestCard = nextDynamic(() => import("./BacktestCard"), { ssr: false });
const IndexListCard = nextDynamic(() => import("./RefCards").then((m) => m.IndexListCard), { ssr: false });
const BreadthCard = nextDynamic(() => import("./RefCards").then((m) => m.BreadthCard), { ssr: false });
const PulseCard = nextDynamic(() => import("./RefCards").then((m) => m.PulseCard), { ssr: false });
const DataStatusCard = nextDynamic(() => import("./RefCards").then((m) => m.DataStatusCard), { ssr: false });
import { isPageHidden } from "@/lib/hooks/visibility";

type Kind = "stock" | "index" | "etf";
interface StockHit {
  code: string;
  name: string;
  secid: string;
  kind: Kind;
}
interface SymbolSel {
  secid: string;
  name: string;
  kind: Kind;
}
type Period = "day" | "week" | "month";
/** 卡片研究分组：决定卡片在默认布局中的阅读顺序与标题标签 */
type CardGroup = "行情走势" | "基本面" | "市场环境" | "系统";

/** 快捷标的：指数 / 龙头 / ETF 分组，避免「只有几只单调代表股」 */
const QUICK_GROUPS: Array<{ label: string; items: SymbolSel[] }> = [
  {
    label: "指数",
    items: [
      { secid: "1.000001", name: "上证指数", kind: "index" },
      { secid: "1.000300", name: "沪深300", kind: "index" },
      { secid: "0.399001", name: "深证成指", kind: "index" },
      { secid: "0.399006", name: "创业板指", kind: "index" },
      { secid: "1.000688", name: "科创50", kind: "index" },
    ],
  },
  {
    label: "龙头",
    items: [
      { secid: "1.600519", name: "贵州茅台", kind: "stock" },
      { secid: "0.300750", name: "宁德时代", kind: "stock" },
      { secid: "1.601318", name: "中国平安", kind: "stock" },
      { secid: "0.002594", name: "比亚迪", kind: "stock" },
      { secid: "0.300059", name: "东方财富", kind: "stock" },
      { secid: "1.688981", name: "中芯国际", kind: "stock" },
    ],
  },
  {
    label: "ETF",
    items: [
      { secid: "1.510300", name: "沪深300ETF", kind: "etf" },
      { secid: "1.512480", name: "半导体ETF", kind: "etf" },
      { secid: "1.588000", name: "科创50ETF", kind: "etf" },
      { secid: "1.518880", name: "黄金ETF", kind: "etf" },
      { secid: "1.513100", name: "纳指ETF", kind: "etf" },
      { secid: "1.515790", name: "光伏ETF", kind: "etf" },
    ],
  },
];
const QUICK: SymbolSel[] = QUICK_GROUPS[0].items;

/**
 * 预设布局（x/y: 列/行，w/h 尺寸）。
 * v2 起按「研究逻辑」排：主图 → 技术分析 → 基本面 → 市场环境 → 系统，
 * 默认总览第一屏就能看到 K 线 + 形态 + 技术位/买卖点/回测，向下才是财务与市场。
 */
const L_ALL = makeLayout([
  { id: "kline", x: 0, y: 0, w: 8, h: 8 },
  { id: "pattern", x: 8, y: 0, w: 4, h: 8 },
  { id: "levels", x: 0, y: 8, w: 4, h: 5 },
  { id: "scan", x: 4, y: 8, w: 4, h: 5 },
  { id: "backtest", x: 8, y: 8, w: 4, h: 5 },
  { id: "radar", x: 0, y: 13, w: 4, h: 6 },
  { id: "valuation", x: 4, y: 13, w: 4, h: 6 },
  { id: "trend", x: 8, y: 13, w: 4, h: 6 },
  { id: "indexes", x: 0, y: 19, w: 4, h: 5 },
  { id: "breadth", x: 4, y: 19, w: 4, h: 5 },
  { id: "pulse", x: 8, y: 19, w: 4, h: 5 },
  { id: "datastatus", x: 0, y: 24, w: 4, h: 5 },
]);
/** 行情视角：看盘用，K 线与技术分析放大，市场环境保留，基本面弱化到下方 */
const L_QUOTES: GridLayout = {
  ...JSON.parse(JSON.stringify(L_ALL)),
  kline: { x: 0, y: 0, w: 8, h: 8, visible: true, mobileOrder: 1 },
  pattern: { x: 8, y: 0, w: 4, h: 8, visible: true, mobileOrder: 2 },
  levels: { x: 0, y: 8, w: 4, h: 5, visible: true, mobileOrder: 3 },
  scan: { x: 4, y: 8, w: 4, h: 5, visible: true, mobileOrder: 4 },
  indexes: { x: 8, y: 8, w: 4, h: 5, visible: true, mobileOrder: 5 },
  breadth: { x: 0, y: 13, w: 4, h: 5, visible: true, mobileOrder: 6 },
  pulse: { x: 4, y: 13, w: 4, h: 5, visible: true, mobileOrder: 7 },
  backtest: { x: 8, y: 13, w: 4, h: 5, visible: true, mobileOrder: 8 },
  radar: { x: 0, y: 18, w: 6, h: 6, visible: true, mobileOrder: 9 },
  valuation: { x: 6, y: 18, w: 6, h: 6, visible: true, mobileOrder: 10 },
  trend: { x: 0, y: 24, w: 6, h: 6, visible: true, mobileOrder: 11 },
  datastatus: { x: 6, y: 24, w: 6, h: 5, visible: true, mobileOrder: 12 },
};
/** 基本面视角：财务/估值/三表优先，K 线与形态作为对照 */
const L_FUND: GridLayout = {
  ...JSON.parse(JSON.stringify(L_ALL)),
  kline: { x: 0, y: 0, w: 8, h: 7, visible: true, mobileOrder: 5 },
  radar: { x: 8, y: 0, w: 4, h: 7, visible: true, mobileOrder: 1 },
  valuation: { x: 0, y: 7, w: 4, h: 6, visible: true, mobileOrder: 2 },
  trend: { x: 4, y: 7, w: 4, h: 6, visible: true, mobileOrder: 3 },
  pattern: { x: 8, y: 7, w: 4, h: 6, visible: true, mobileOrder: 4 },
  levels: { x: 0, y: 13, w: 4, h: 5, visible: true, mobileOrder: 6 },
  scan: { x: 4, y: 13, w: 4, h: 5, visible: true, mobileOrder: 7 },
  backtest: { x: 8, y: 13, w: 4, h: 5, visible: true, mobileOrder: 8 },
  indexes: { x: 0, y: 18, w: 4, h: 5, visible: true, mobileOrder: 9 },
  breadth: { x: 4, y: 18, w: 4, h: 5, visible: true, mobileOrder: 10 },
  pulse: { x: 8, y: 18, w: 4, h: 5, visible: true, mobileOrder: 11 },
  datastatus: { x: 0, y: 23, w: 4, h: 5, visible: true, mobileOrder: 12 },
};
/** 策略视角：形态/技术位/买卖点/回测放大，基本面作为参考 */
const L_STRAT: GridLayout = {
  ...JSON.parse(JSON.stringify(L_ALL)),
  kline: { x: 0, y: 0, w: 8, h: 9, visible: true, mobileOrder: 1 },
  pattern: { x: 8, y: 0, w: 4, h: 9, visible: true, mobileOrder: 2 },
  scan: { x: 0, y: 9, w: 6, h: 7, visible: true, mobileOrder: 3 },
  levels: { x: 6, y: 9, w: 6, h: 7, visible: true, mobileOrder: 4 },
  backtest: { x: 0, y: 16, w: 12, h: 6, visible: true, mobileOrder: 5 },
  radar: { x: 0, y: 22, w: 4, h: 6, visible: true, mobileOrder: 6 },
  valuation: { x: 4, y: 22, w: 4, h: 6, visible: true, mobileOrder: 7 },
  trend: { x: 8, y: 22, w: 4, h: 6, visible: true, mobileOrder: 8 },
  indexes: { x: 0, y: 28, w: 4, h: 5, visible: true, mobileOrder: 9 },
  breadth: { x: 4, y: 28, w: 4, h: 5, visible: true, mobileOrder: 10 },
  pulse: { x: 8, y: 28, w: 4, h: 5, visible: true, mobileOrder: 11 },
  datastatus: { x: 0, y: 33, w: 4, h: 5, visible: true, mobileOrder: 12 },
};

const PRESETS = [
  { key: "ALL", label: "总览", title: "研究全貌：主图 + 技术分析 + 基本面 + 市场环境", layout: L_ALL },
  { key: "QUOTES", label: "行情", title: "看盘视角：K 线与技术分析放大，市场环境保留", layout: L_QUOTES },
  { key: "FUND", label: "基本面", title: "基本面视角：财务/估值/三表优先，K 线作对照", layout: L_FUND },
  { key: "STRAT", label: "策略", title: "策略视角：形态/技术位/买卖点/回测放大", layout: L_STRAT },
];

/** 卡片元数据：编号按阅读顺序，标签告诉用户「这张卡属于哪段研究」 */
const CARD_META: Record<string, { num: string; title: string; group: CardGroup; hint: string }> = {
  kline: {
    num: "01",
    title: "K 线实验台",
    group: "行情走势",
    hint: "主图看所选标的的 K 线/指标/历史回放，其他卡片共用这个标的",
  },
  pattern: {
    num: "02",
    title: "K 线形态与买卖点识别",
    group: "行情走势",
    hint: "最近 K 线是否出现经典形态，买卖点标注同步到 01 主图",
  },
  levels: {
    num: "03",
    title: "技术位分析",
    group: "行情走势",
    hint: "支撑/压力与均线位置：现在离关键位有多远",
  },
  scan: {
    num: "04",
    title: "买卖点扫描器",
    group: "行情走势",
    hint: "技术指标最近的买卖信号记录，规则公开可复算",
  },
  backtest: {
    num: "05",
    title: "策略回测",
    group: "行情走势",
    hint: "简单策略跑一遍历史，与买入持有对比",
  },
  radar: {
    num: "06",
    title: "企业财务质量多维评估雷达",
    group: "基本面",
    hint: "企业财务质量五个维度（仅个股）",
  },
  valuation: {
    num: "07",
    title: "估值区间测算",
    group: "基本面",
    hint: "当前估值处在自身历史的什么分位",
  },
  trend: {
    num: "08",
    title: "财务三表趋势",
    group: "基本面",
    hint: "营收/净利与毛利率/ROE 的近 8 期趋势",
  },
  indexes: {
    num: "09",
    title: "全球指数一览",
    group: "市场环境",
    hint: "全球主要指数实时表现，点击一行切换分析标的",
  },
  breadth: {
    num: "10",
    title: "市场宽度",
    group: "市场环境",
    hint: "全市场涨跌家数与宽度，判断普涨/普跌",
  },
  pulse: {
    num: "11",
    title: "市场脉搏 · 全球时钟",
    group: "市场环境",
    hint: "全球市场时钟与交易时段",
  },
  datastatus: {
    num: "12",
    title: "数据状态 · 数据源",
    group: "系统",
    hint: "各数据源的可用性与更新时间",
  },
};
const CARD_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CARD_META).map(([id, m]) => [id, `${m.num} ${m.title}`])
);

/** 已知指数代码（用于 kind 判定：财报/估值模块需区分指数与个股） */
const INDEX_CODES_REF = new Set(["000001", "399001", "399006", "000300", "000905", "000688", "000016", "399005", "000852"]);
/** 场内基金代码段：沪市 5xxxxx、深市 15xxxx/16xxxx */
const FUND_CODE_REF = /^(5\d{5}|1[56]\d{4})$/;

/**
 * 6 位代码 → 东财 secid。
 * 沪市：6xxxxx 股票 / 5xxxxx ETF·LOF / 9xxxxx B股；深市：0/1/2/3 开头。
 * 修正：旧规则只把 6 开头当沪市，510300、512480 等 ETF 全被错判成深市 → K 线接口 404，
 * 表现为「搜到 ETF 但点进去没有 K 线」。
 */
const toSecid = (code: string) => (/^\d{6}$/.test(code) ? `${/^[569]/.test(code) ? "1" : "0"}.${code}` : code);
const kindOfCode = (code: string): Kind =>
  INDEX_CODES_REF.has(code) ? "index" : FUND_CODE_REF.test(code) ? "etf" : "stock";

const NEED_PRO_MSG = "研究留档为专业版能力：可在 /pricing 查看能力对照与开通方式";

export default function LabTerminal({ pro = false }: { pro?: boolean }) {
  // ---- 标的与数据（原 LabPage 状态逻辑） ----
  // 支持 /lab?secid=1.600519&name=贵州茅台 预选标的（跨板块互通：从板块中心/个股页带上下文进入）
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState<SymbolSel>(() => {
    const secid = searchParams.get("secid")?.trim();
    if (secid && /^\d+\.\w+$/.test(secid)) {
      const name = searchParams.get("name")?.trim() || secid;
      const code = secid.split(".")[1] ?? "";
      return { secid, name, kind: kindOfCode(code) };
    }
    return QUICK[0];
  });
  const [period, setPeriod] = useState<Period>(() => {
    const p = searchParams.get("period");
    return p === "week" || p === "month" ? p : "day";
  });
  const [bars, setBars] = useState<LabBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [asOf, setAsOf] = useState("");
  const [showMarks, setShowMarks] = useState(true);
  // 实时快照（/api/stock/quote，15s 轮询）：K 线只到当日收盘，盘中需要看实时价
  const [live, setLive] = useState<{
    price: number;
    changePct: number;
    changeAmount: number;
    timestamp: number;
    /** 快照对应的交易日（北京时间），用于区分「盘中实时」与「收盘快照」 */
    tradeDate?: string;
  } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  // 专业版研究留档（布局导入/导出、K 线 CSV）
  const [archiveMsg, setArchiveMsg] = useState("");
  const importRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StockHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [openList, setOpenList] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  /** 快捷标的分组页签（指数/龙头/ETF），只展示当前分组，避免一排 17 个 chip 太挤 */
  const [quickGroup, setQuickGroup] = useState(0);
  /** 使用路径提示：可关闭，选择记住 */
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem("lab-guide-v1") === "off") setGuideOpen(false);
    } catch {
      /* 忽略隐私模式限制 */
    }
  }, []);
  const dismissGuide = () => {
    setGuideOpen(false);
    try {
      localStorage.setItem("lab-guide-v1", "off");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const kw = q.trim();
    if (!kw) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/stock/search?q=${encodeURIComponent(kw)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setHits(Array.isArray(j?.hits) ? j.hits.slice(0, 8) : []))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setOpenList(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const pick = (h: StockHit) => {
    setSymbol({ secid: h.secid, name: h.name, kind: h.kind });
    setQ("");
    setHits([]);
    setOpenList(false);
  };

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      setErr("");
      // 同参 K 线请求合并：主图 / 形态卡 / 扫描器可能同时要同一个 secid 的同一批 K 线
      fetchKline<any>(symbol.secid, period as "day" | "week" | "month", 8000)
        .then((j) => {
          if (Array.isArray(j?.klines) && j.klines.length) {
            setBars(j.klines);
            setAsOf(j.klines[j.klines.length - 1].date);
            // API 返回的 name 可能是代码形式（sh601318/601318），此时保留用户传入的中文名
            if (j.name && !/^[a-z]{1,3}\d{6}$/i.test(String(j.name)) && j.name !== symbol.secid)
              setSymbol((s) => ({ ...s, name: j.name }));
          } else {
            setBars([]);
            setErr(j?.error ?? "K 线数据暂不可用，请重试");
          }
        })
        .catch(() => setErr("K 线数据加载失败"))
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [symbol.secid, period]
  );

  useEffect(() => {
    load();
  }, [symbol.secid, period]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动刷新：15 秒实时快照 + 60 秒 K 线静默重载（日线最后一根会跟随盘中价更新）。
  // 后台标签页暂停轮询；切回前台立刻补一次，避免「数据半天不动」。
  useEffect(() => {
    let dead = false;
    setLive(null);
    const pullQuote = () => {
      if (document.hidden) return;
      fetch(`/api/stock/quote?secid=${encodeURIComponent(symbol.secid)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (dead || !j?.ok || !j?.quote) return;
          const qt = j.quote;
          if (typeof qt.price === "number" && qt.price > 0)
            setLive({
              price: qt.price,
              changePct: Number(qt.changePct) || 0,
              changeAmount: Number(qt.changeAmount) || 0,
              timestamp: Number(qt.timestamp) || Date.now(),
              tradeDate: typeof qt.tradeDate === "string" ? qt.tradeDate : undefined,
            });
        })
        .catch(() => {
          /* 实时源不可用：保留 K 线收盘价，界面标「日线收盘」 */
        });
    };
    if (!autoRefresh) {
      pullQuote();
      return () => {
        dead = true;
      };
    }
    pullQuote();
    const quoteTimer = setInterval(() => {
      if (isPageHidden()) return;
      pullQuote();
    }, 15000);
    const klineTimer = setInterval(() => {
      if (!document.hidden) load(true);
    }, 60000);
    const onVisible = () => {
      if (!document.hidden) {
        pullQuote();
        load(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      dead = true;
      clearInterval(quoteTimer);
      clearInterval(klineTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [symbol.secid, autoRefresh, load]);

  // 标的/周期写回 URL（replaceState 不产生历史记录）：
  // 刷新页面、把链接发给同学、从别的板块返回时都能恢复同一张实验台。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    params.set("secid", symbol.secid);
    if (symbol.name) params.set("name", symbol.name);
    params.set("period", period);
    window.history.replaceState(null, "", `/lab?${params.toString()}`);
  }, [symbol.secid, symbol.name, period]);

  const marks = useMemo<LabMark[]>(() => {
    if (bars.length < 35) return [];
    const pats = detectPatterns(bars).map((h) => ({ index: h.index, type: h.signal, label: h.name }));
    const sigs = scanSignals(bars).map((s) => ({ index: s.index, type: s.type, label: s.source }));
    const seen = new Set<number>();
    const out: LabMark[] = [];
    for (const m of [...pats, ...sigs]) {
      const key = m.index * 2 + (m.type === "buy" ? 0 : 1);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
    return out.sort((a, b) => a.index - b.index);
  }, [bars]);

  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2] ?? last;
  const pct = last && prev ? (prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0) : 0;
  // 指数与 ETF 没有个股口径的财报/估值数据，相关卡片走「非个股」提示分支
  const isIndex = symbol.kind !== "stock";
  // 实时快照优先；没有实时源（如全球指数）时回落到日线收盘
  const livePct = live ? live.changePct : pct;
  const shownPrice = live?.price ?? last?.close;
  const priceUp = livePct >= 0;
  const liveAsOf = live
    ? `快照 ${new Date(live.timestamp).toLocaleTimeString("zh-CN", { hour12: false })}`
    : asOf;
  // 倍率口径说明：快照交易日=今天才算「盘中实时」，周末/节假日是「收盘快照」
  // 复用 lib/data/ym 的北京时间日期（模块级纯函数，渲染期调用不违反幂等要求）
  const cstToday = cstDateKey();
  const liveIsToday = !!live?.tradeDate && live.tradeDate === cstToday;
  const latestTradeDate = asOf || live?.tradeDate || "";
  // ---- 终端骨架状态 ----
  const clock = useClock();
  const [helpOpen, setHelpOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [insp, setInsp] = useState<InspData | null>(null);
  const [tapePaused, setTapePaused] = useState(false);
  const grid = useLabGrid(PRESETS);
  const { editing, zoomed, focused, preset, layout, removedIds } = grid;

  // 桌面/移动判定 + 网格容器宽度测量
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerW(el.clientWidth);
      setDesktop(window.innerWidth >= 768);
    });
    ro.observe(el);
    setContainerW(el.clientWidth);
    setDesktop(window.innerWidth >= 768);
    return () => ro.disconnect();
  }, []);

  /**
   * 网格最小高度：桌面端卡片是绝对定位，容器高度完全由卡片撑开。
   * 而卡片内容（K 线、形态、回测…）依赖数据请求，首帧还没画出来时容器只有 css 里的
   * 60vh，等卡片挂载后瞬间跳到 2600+ px —— 下方区块整体位移，实测贡献了 0.49 的 CLS。
   * 这里按「当前布局的最大行数」预先占位，让首帧高度就与最终一致（移动端是普通流式布局，
   * 不适用绝对定位，故不设）。
   */
  const gridMinHeight = useMemo(() => {
    if (!desktop || !layout) return undefined;
    let rows = 0;
    for (const it of Object.values(layout)) {
      const item = it as { visible?: boolean; y?: number; h?: number } | undefined;
      if (!item || item.visible === false) continue;
      if (typeof item.y !== "number" || typeof item.h !== "number") continue;
      rows = Math.max(rows, item.y + item.h);
    }
    return rows > 0 ? rows * (ROWH + GAP) + GAP * 2 : undefined;
  }, [desktop, layout]);

  // ---- 跑马灯（/api/quotes 30s 轮询） ----
  const [tapeItems, setTapeItems] = useState<TapeQuote[]>([]);
  const [globalQuotes, setGlobalQuotes] = useState<TapeQuote[]>([]);
  const [quotesAsOf, setQuotesAsOf] = useState("");
  useEffect(() => {
    let dead = false;
    const fetchTape = () =>
      // 与顶部滚动条/大盘卡片共享同一次 /api/quotes（5s 本地复用），
      // 否则打开实验室会同时发出 3 份相同请求，各自命中冷实例等上游。
      fetchJson<any>("/api/quotes", { ttlMs: 5000 }).then((j) => {
        if (dead || !j) return;
          const pick = (a: any[]): TapeQuote[] =>
            (Array.isArray(a) ? a : []).slice(0, 12).map((x) => ({ code: x.code, secid: x.secid ?? toSecid(x.code), name: x.name, price: x.price, changePct: x.changePct }));
          const g = pick(j.global);
          const idx = pick((j.quotes ?? []).filter((x: any) => ["000001", "399001", "399006", "000300", "000905", "000688"].includes(x.code)));
          const sec = pick(j.sectors ?? []);
          setTapeItems([...idx, ...g, ...sec]);
          setGlobalQuotes(g);
          setQuotesAsOf(new Date(j.time ?? Date.now()).toLocaleString("zh-CN", { hour12: false }));
        });
    fetchTape();
    const t = setInterval(() => {
      if (isPageHidden()) return;
      fetchTape();
    }, 30000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  // ---- 卡片动作 ----
  const onCardAction = useCallback(
    (id: string, act: "up" | "down" | "lock" | "min" | "zoom" | "close") => {
      const it = layout[id];
      if (!it) return;
      if (act === "up") grid.moveMobile(id, -1);
      else if (act === "down") grid.moveMobile(id, 1);
      else if (act === "lock") grid.update(id, { locked: !it.locked });
      else if (act === "min") grid.update(id, { minimized: !it.minimized });
      else if (act === "zoom") grid.setZoomed((z) => (z === id ? null : id));
      else if (act === "close") {
        grid.update(id, { visible: false });
        grid.setZoomed(null);
      }
    },
    [layout, grid]
  );

  const restore = useCallback(
    (id: string) => {
      grid.update(id, { visible: true });
    },
    [grid]
  );

  // ---- 键盘快捷键 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // 按 / 聚焦标的搜索框（终端式快捷操作）
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (e.key === "e" || e.key === "E") {
        grid.toggleEdit();
      } else if (e.key === "d" || e.key === "D") {
        const vis = layout.datastatus?.visible !== false;
        grid.update("datastatus", { visible: !vis });
      } else if (e.key === "i" || e.key === "I") {
        setInspectorOpen((v) => !v);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
        setInspectorOpen(false);
        grid.setZoomed(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grid, layout]);

  // ---- 检查器点击委托 ----
  const inspRootRef = useInspectorDelegate(
    useCallback((d: InspData) => {
      setInsp(d);
      setInspectorOpen(true);
    }, [])
  );

  /** 跑马灯点击联动：仅 A 股代码（6 位数字）可下钻为教学标的，
   *  全球指数（DJI/HSI…）与板块（BK…）仅作行情参考——其财报/估值为不同口径，切进去会报参数错误 */
  const onTapePick = useCallback((tq: TapeQuote) => {
    const code = tq.code;
    if (!/^\d{6}$/.test(code)) return;
    setSymbol({ secid: toSecid(code), name: tq.name, kind: kindOfCode(code) });
  }, []);

  const periodBtn = (p: Period, label: string) => (
    <button key={p} className={`gmt-chip${period === p ? " on" : ""}`} onClick={() => setPeriod(p)} aria-pressed={period === p}>
      {label}
    </button>
  );

  /* ---- 专业版研究留档：K 线 CSV + 工作台布局 JSON ---- */
  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportKlineCsv = () => {
    if (!pro) {
      setArchiveMsg(NEED_PRO_MSG);
      return;
    }
    if (!bars.length) {
      setArchiveMsg("当前还没有可导出的 K 线数据，请稍后再试");
      return;
    }
    const lines = ["date,open,high,low,close,volume,amount"];
    for (const b of bars) {
      lines.push([b.date, b.open, b.high, b.low, b.close, b.volume, b.amount ?? ""].join(","));
    }
    lines.push("");
    lines.push(`# ${symbol.name}（${symbol.secid}）· ${period === "day" ? "日K" : period === "week" ? "周K" : "月K"} · 前复权 · 导出 ${new Date().toLocaleString("zh-CN", { hour12: false })}`);
    download("\ufeff" + lines.join("\n"), `lab-${symbol.secid}-${period}-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
    setArchiveMsg(`已导出 ${bars.length} 根 K 线（CSV）`);
  };

  const exportLayoutJson = () => {
    if (!pro) {
      setArchiveMsg(NEED_PRO_MSG);
      return;
    }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      preset,
      symbol: { secid: symbol.secid, name: symbol.name },
      period,
      layout,
    };
    download(JSON.stringify(payload, null, 2), `lab-layout-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setArchiveMsg("布局配置已导出（JSON）");
  };

  const onImportLayoutFile = async (file: File | null) => {
    if (!pro) {
      setArchiveMsg(NEED_PRO_MSG);
      return;
    }
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { layout?: unknown };
      const raw = json.layout;
      if (!raw || typeof raw !== "object") throw new Error("bad shape");
      const next: GridLayout = {};
      for (const [id, item] of Object.entries(raw as Record<string, unknown>)) {
        const it = item as Record<string, unknown>;
        if (typeof it?.x !== "number" || typeof it?.y !== "number" || typeof it?.w !== "number" || typeof it?.h !== "number") continue;
        next[id] = {
          x: Math.max(0, Math.round(it.x)),
          y: Math.max(0, Math.round(it.y)),
          w: Math.min(12, Math.max(1, Math.round(it.w))),
          h: Math.min(12, Math.max(1, Math.round(it.h))),
          visible: it.visible !== false,
          locked: it.locked === true,
          minimized: it.minimized === true,
          ...(typeof it.mobileOrder === "number" ? { mobileOrder: it.mobileOrder } : {}),
        };
      }
      if (!Object.keys(next).length) throw new Error("no valid cards");
      grid.importLayout(next);
      setArchiveMsg(`已导入布局（${Object.keys(next).length} 个组件）`);
    } catch {
      setArchiveMsg("布局文件解析失败：请选择本站导出的 JSON 文件");
    }
  };

  return (
    <div id="lab-root" className={editing ? "editing" : undefined} ref={inspRootRef}>
      <CmdBar
        editing={editing}
        inspector={inspectorOpen}
        dataOn={layout.datastatus?.visible !== false}
        onHelp={() => setHelpOpen((v) => !v)}
        onEdit={grid.toggleEdit}
        onData={() => grid.update("datastatus", { visible: layout.datastatus?.visible === false })}
        onInspector={() => setInspectorOpen((v) => !v)}
        clock={clock}
      />

      <Tape items={tapeItems} paused={tapePaused} onPause={() => setTapePaused((v) => !v)} activeSecid={symbol.secid} onPick={onTapePick} />

      {/* 工作台工具条：布局控制 + 研究留档同排（原来分两行，太多条状控件） */}
      <LabToolbar
        editing={editing}
        preset={preset}
        presets={PRESETS.map(({ key, label, title }) => ({ key, label, title }))}
        removedIds={removedIds}
        onPreset={grid.applyPreset}
        onEdit={grid.toggleEdit}
        onReset={grid.reset}
        onRestore={restore}
        cardLabels={CARD_LABELS}
        rightSlot={
          <>
            <span className="gmt-tb-sep" />
            <span className="gmt-tb-label">留档&gt;</span>
            <button className="gmt-tb-btn" onClick={exportKlineCsv} title="导出当前标的与周期的 K 线数据（CSV）">
              {pro ? <Download className="w-3 h-3" /> : <Lock className="w-3 h-3" />} K 线 CSV
            </button>
            <button className="gmt-tb-btn" onClick={exportLayoutJson} title="导出当前工作台布局配置（JSON）">
              {pro ? <Download className="w-3 h-3" /> : <Lock className="w-3 h-3" />} 布局 JSON
            </button>
            <button
              className="gmt-tb-btn"
              onClick={() => (pro ? importRef.current?.click() : setArchiveMsg(NEED_PRO_MSG))}
              title="导入工作台布局配置（JSON）"
            >
              <Upload className="w-3 h-3" /> 导入布局
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onImportLayoutFile(f);
              }}
            />
            {!pro && (
              <Link className="gmt-tb-btn" href="/pricing" title="研究留档为专业版能力">专业版开通</Link>
            )}
            {archiveMsg && <span className="gmt-tb-hint">{archiveMsg}</span>}
          </>
        }
      />

      {err && (
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--line)", color: "var(--danger)", fontSize: 11 }}>
          {err}{" "}
          <button className="gmt-chip" onClick={() => load()} style={{ marginLeft: 8 }}>
            重试
          </button>
        </div>
      )}

      {/*
        标的控制条（两行，按使用顺序自上而下）：
        ① 标的：搜索 / 指数·龙头·ETF 快捷分组
        ② 周期与视图：日/周/月K、买卖点、自动刷新、刷新 + 实时报价
      */}
      <div className="gmt-symbol-bar">
        <div className="gmt-sb-row">
          <span className="gmt-sb-step">① 标的</span>
          <div className="gmt-sb-search" ref={searchBoxRef}>
            <div className="gmt-sb-input">
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-dim)" }} />
              <input
                ref={searchInputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpenList(true);
                }}
                onFocus={() => setOpenList(true)}
                placeholder="搜索股票 / 指数 / ETF：600519、510300、半导体 （/ 聚焦）"
                aria-label="搜索标的"
              />
              {q && (
                <button
                  className="gmt-chip"
                  style={{ border: "none", padding: "0 4px" }}
                  onClick={() => {
                    setQ("");
                    setHits([]);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="清空搜索"
                >
                  ✕
                </button>
              )}
            </div>
            {openList && q.trim() !== "" && (
              hits.length ? (
                <div className="gmt-hitlist" role="listbox" aria-label="搜索结果">
                  {hits.map((h) => (
                    <button
                      key={h.secid}
                      role="option"
                      aria-selected={symbol.secid === h.secid}
                      onClick={() => pick(h)}
                    >
                      <span className="hi-name">{h.name}</span>
                      <span className="hi-code">{h.code}</span>
                      <span className="hi-kind">{h.kind === "index" ? "指数" : h.kind === "etf" ? "ETF" : "个股"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="gmt-hitlist-empty">
                  {searching ? "搜索中…" : "未找到标的：试试 6 位代码或名称（如 510300、半导体）"}
                </div>
              )
            )}
          </div>

          <div className="gmt-sb-groups">
            <div className="gmt-sb-tabs" role="tablist" aria-label="快捷标的分类">
              {QUICK_GROUPS.map((g, gi) => (
                <button
                  key={g.label}
                  role="tab"
                  aria-selected={quickGroup === gi}
                  className={`gmt-sb-tab${quickGroup === gi ? " on" : ""}`}
                  onClick={() => setQuickGroup(gi)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="gmt-sb-quick">
              {QUICK_GROUPS[quickGroup].items.map((s) => (
                <button
                  key={s.secid}
                  className={`gmt-chip${symbol.secid === s.secid ? " on" : ""}`}
                  onClick={() => setSymbol(s)}
                  title={s.secid}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="gmt-sb-row gmt-sb-row-sub">
          <span className="gmt-sb-step">② 周期</span>
          {periodBtn("day", "日K")}
          {periodBtn("week", "周K")}
          {periodBtn("month", "月K")}
          <span className="gmt-tb-sep" />
          <span className="gmt-sb-step">③ 视图</span>
          <button className={`gmt-chip${showMarks ? " on" : ""}`} onClick={() => setShowMarks(!showMarks)} aria-pressed={showMarks}>
            买卖点 {showMarks ? "开" : "关"}
          </button>
          <button
            className={`gmt-chip${autoRefresh ? " on" : ""}`}
            onClick={() => setAutoRefresh((v) => !v)}
            aria-pressed={autoRefresh}
            title="15 秒实时快照 + 60 秒 K 线静默刷新；切后台自动暂停"
          >
            自动刷新 {autoRefresh ? "开" : "关"}
          </button>
          <button className="gmt-chip" onClick={() => load()} aria-label="刷新数据">
            <RefreshCw className={`w-3 h-3 inline${loading ? " animate-spin" : ""}`} /> 刷新
          </button>

          <div className="gmt-sb-live">
            {shownPrice != null ? (
              <>
                <b className={`gmt-sb-price ${priceUp ? "up" : "down"}`}>{shownPrice.toFixed(2)}</b>
                <span className={priceUp ? "up" : "down"}>
                  {livePct >= 0 ? "+" : ""}
                  {livePct.toFixed(2)}%
                </span>
                <span className={`gmt-sb-tag${liveIsToday ? "" : " delay"}`}>
                  {live ? (liveIsToday ? "实时" : "收盘") : "日线收盘"}
                </span>
                <span className="gmt-sb-meta">
                  {live ? `${liveAsOf} · ` : ""}
                  最新交易日 {latestTradeDate || "—"} · {bars.length} 根
                  {period === "day" ? "日" : period === "week" ? "周" : "月"}K
                  {symbol.kind === "etf" ? " · ETF" : symbol.kind === "index" ? " · 指数" : ""}
                </span>
              </>
            ) : (
              <span className="gmt-sb-meta">{loading ? "行情加载中…" : "暂无行情"}</span>
            )}
          </div>
        </div>
      </div>

      {/* 使用路径提示（首次进入显示，可关闭并记住） */}
      {guideOpen && (
        <div className="gmt-guide" role="note">
          <b>使用路径</b>
          <span>① 选标的</span>
          <span aria-hidden="true">→</span>
          <span>② 选周期</span>
          <span aria-hidden="true">→</span>
          <span>③ 看 01 主图与 02-05 技术分析</span>
          <span aria-hidden="true">→</span>
          <span>④ 向下 06-08 基本面 · 09-11 市场环境</span>
          <span aria-hidden="true">→</span>
          <span>⑤ 12 查数据源状态</span>
          <button className="gmt-guide-close" onClick={dismissGuide} aria-label="不再显示使用路径提示">
            ✕
          </button>
        </div>
      )}

      <main className="gmt-grid" ref={gridRef} style={gridMinHeight ? { minHeight: gridMinHeight } : undefined} aria-label="终端组件网格">
        {/* 01 K线实验台（行情走势 · 主图） */}
        {layout.kline?.visible !== false && (
          <GmtCard
            id="kline" num={CARD_META.kline.num} title={`${CARD_META.kline.title} · ${symbol.name}`}
            group={CARD_META.kline.group} hint={CARD_META.kline.hint} asOf={asOf}
            layout={layout.kline} editing={editing} focused={focused === "kline"} zoomed={zoomed === "kline"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            fill
            note={<>数据源：东方财富 / 新浪 / 腾讯多源容错（前复权）。回放模式下指标仅用「已显示数据」计算 —— 不窥视未来。红=阳线（涨）绿=阴线（跌），A 股惯例。绿三角=买点标注，红针=卖点标注（02/04 联动）。</>}
          >
            <KlineLab bars={bars} symbol={symbol.name} period={period} marks={marks} showMarks={showMarks} loading={loading} onRetry={() => load()} />
          </GmtCard>
        )}

        {/* 02 形态识别（行情走势） */}
        {layout.pattern?.visible !== false && (
          <GmtCard
            id="pattern" num={CARD_META.pattern.num} title={CARD_META.pattern.title}
            group={CARD_META.pattern.group} hint={CARD_META.pattern.hint} asOf={asOf}
            layout={layout.pattern} editing={editing} focused={focused === "pattern"} zoomed={zoomed === "pattern"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>形态判定（《日本蜡烛图技术》通用定义的工程化简化）：影线/实体倍数阈值固定，趋势前提用前 5 根累计涨跌幅近似。形态是概率提示而非确定性信号；标注同步至 01 实验台。</>}
          >
            <PatternCard bars={bars} />
          </GmtCard>
        )}

        {/* 03 技术位（行情走势） */}
        {layout.levels?.visible !== false && (
          <GmtCard
            id="levels" num={CARD_META.levels.num} title={CARD_META.levels.title}
            group={CARD_META.levels.group} hint={CARD_META.levels.hint} asOf={asOf}
            layout={layout.levels} editing={editing} focused={focused === "levels"} zoomed={zoomed === "levels"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>支撑/压力：局部极值（前后 5 根窗口）按 1.5% 价格容差聚类，≥2 次触及有效；均线 MA5/10/20/60/120/250 简单平均。均为公开可复算的统计口径。</>}
          >
            <LevelsCard bars={bars} />
          </GmtCard>
        )}

        {/* 04 买卖点扫描（行情走势） */}
        {layout.scan?.visible !== false && (
          <GmtCard
            id="scan" num={CARD_META.scan.num} title={CARD_META.scan.title}
            group={CARD_META.scan.group} hint={CARD_META.scan.hint} asOf={asOf}
            layout={layout.scan} editing={editing} focused={focused === "scan"} zoomed={zoomed === "scan"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>信号 = 指标穿越事件的规则触发记录（MACD/KDJ/RSI/均线四套规则，阈值全部公开可复算），标注同步至 01 实验台。历史信号统计不等于未来胜率。</>}
          >
            <ScanCard bars={bars} />
          </GmtCard>
        )}

        {/* 05 策略回测（行情走势） */}
        {layout.backtest?.visible !== false && (
          <GmtCard
            id="backtest" num={CARD_META.backtest.num} title={CARD_META.backtest.title}
            group={CARD_META.backtest.group} hint={CARD_META.backtest.hint} asOf={asOf}
            layout={layout.backtest} editing={editing} focused={focused === "backtest"} zoomed={zoomed === "backtest"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>回测引擎：全仓买卖、T+1 次日开盘成交近似、双边佣金万三。净值对比买入持有基准。历史回测不代表未来表现，参数为教学用固定值（无过拟合优化）。</>}
          >
            <BacktestCard bars={bars} symbol={symbol.name} />
          </GmtCard>
        )}

        {/* 06 财务雷达（基本面） */}
        {layout.radar?.visible !== false && (
          <GmtCard
            id="radar" num={CARD_META.radar.num} title={CARD_META.radar.title}
            group={CARD_META.radar.group} hint={CARD_META.radar.hint}
            layout={layout.radar} editing={editing} focused={focused === "radar"} zoomed={zoomed === "radar"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>数据源：东方财富 F10 主要财务指标（近 8 期财报）。财报为年初至今累计口径，成长性与稳定性按<b>同报告期同比</b>计算（中报比中报、年报比年报），不跨口径比较。归一化口径：同比增速 [-50%,50%]→[0,100]，毛利率 [0,60%]→[0,100]，ROE [0,30%]→[0,100]，稳定性=100−5σ。教学对比用途，不构成评级。</>}
          >
            <RadarCard secid={symbol.secid} isIndex={isIndex} />
          </GmtCard>
        )}

        {/* 07 估值区间（基本面） */}
        {layout.valuation?.visible !== false && (
          <GmtCard
            id="valuation" num={CARD_META.valuation.num} title={CARD_META.valuation.title}
            group={CARD_META.valuation.group} hint={CARD_META.valuation.hint} asOf={asOf}
            layout={layout.valuation} editing={editing} focused={focused === "valuation"} zoomed={zoomed === "valuation"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>数据源：东方财富 RPT_VALUEANALYSIS_DET（近 5 年约 1240 交易日每日估值）。分位 = 历史序列中小于当前值的样本占比。相对估值仅衡量「相对自身历史贵贱」，不同行业不可横向比较。</>}
          >
            <ValuationCard secid={symbol.secid} isIndex={isIndex} />
          </GmtCard>
        )}

        {/* 08 三表趋势（基本面） */}
        {layout.trend?.visible !== false && (
          <GmtCard
            id="trend" num={CARD_META.trend.num} title={CARD_META.trend.title}
            group={CARD_META.trend.group} hint={CARD_META.trend.hint}
            layout={layout.trend} editing={editing} focused={focused === "trend"} zoomed={zoomed === "trend"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>数据源：东方财富 F10 主要财务指标（季报累计口径）。营收/净利单位亿元（左轴），毛利率/加权 ROE 百分比（右轴）。</>}
          >
            <TrendCard secid={symbol.secid} isIndex={isIndex} />
          </GmtCard>
        )}

        {/* 09 全球指数一览（市场环境） */}
        {layout.indexes?.visible !== false && (
          <GmtCard
            id="indexes" num={CARD_META.indexes.num} title={CARD_META.indexes.title}
            group={CARD_META.indexes.group} hint={CARD_META.indexes.hint} asOf={quotesAsOf}
            layout={layout.indexes} editing={editing} focused={focused === "indexes"} zoomed={zoomed === "indexes"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>点击行联动全终端切换分析标的 · 快照存在 15–20 秒级延迟 · 来源：东方财富/腾讯公开行情</>}
          >
            <IndexListCard quotes={globalQuotes} activeSecid={symbol.secid} onPick={(secid) => setSymbol((s) => ({ ...s, secid }))} asOf={quotesAsOf} />
          </GmtCard>
        )}

        {/* 10 市场宽度（市场环境） */}
        {layout.breadth?.visible !== false && (
          <GmtCard
            id="breadth" num={CARD_META.breadth.num} title={CARD_META.breadth.title}
            group={CARD_META.breadth.group} hint={CARD_META.breadth.hint}
            layout={layout.breadth} editing={editing} focused={focused === "breadth"} zoomed={zoomed === "breadth"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
          >
            <BreadthCard />
          </GmtCard>
        )}

        {/* 11 市场脉搏（市场环境） */}
        {layout.pulse?.visible !== false && (
          <GmtCard
            id="pulse" num={CARD_META.pulse.num} title={CARD_META.pulse.title}
            group={CARD_META.pulse.group} hint={CARD_META.pulse.hint}
            layout={layout.pulse} editing={editing} focused={focused === "pulse"} zoomed={zoomed === "pulse"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
          >
            <PulseCard />
          </GmtCard>
        )}

        {/* 12 数据状态（系统） */}
        {layout.datastatus?.visible !== false && (
          <GmtCard
            id="datastatus" num={CARD_META.datastatus.num} title={CARD_META.datastatus.title}
            group={CARD_META.datastatus.group} hint={CARD_META.datastatus.hint}
            layout={layout.datastatus} editing={editing} focused={focused === "datastatus"} zoomed={zoomed === "datastatus"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
          >
            <DataStatusCard />
          </GmtCard>
        )}
      </main>

      <Inspector open={inspectorOpen} data={insp} onClose={() => setInspectorOpen(false)} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
