"use client";

/* ============================================================
   LabTerminal —— MX//K线实验室 终端总装
   复刻 GMT//全球市场终端 的布局与交互：
   命令栏(F1/E/D/I) → 行情跑马灯(点击联动标的) → 工具栏(预设/编辑布局)
   → 12 列可编辑组件网格（8 教学模块 + 全球指数/市场宽度/市场脉搏/数据状态）
   → 数据来源检查器 + 键盘帮助
   全部数据基于真实行情与财报接口，严禁虚构。
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import "./terminal.css";
import GmtCard from "./GmtCard";
import { makeLayout, useLabGrid, type GridLayout } from "./useLabGrid";
import { CmdBar, Tape, LabToolbar, Inspector, HelpOverlay, useClock, useInspectorDelegate, type InspData, type TapeQuote } from "./TermChrome";
import { IndexListCard, BreadthCard, PulseCard, DataStatusCard } from "./RefCards";
import KlineLab, { type LabBar, type LabMark } from "./KlineLab";
import PatternCard from "./PatternCard";
import RadarCard from "./RadarCard";
import ValuationCard from "./ValuationCard";
import ScanCard from "./ScanCard";
import LevelsCard from "./LevelsCard";
import TrendCard from "./TrendCard";
import BacktestCard from "./BacktestCard";
import { detectPatterns } from "./patterns";
import { scanSignals } from "./signals";

interface StockHit {
  code: string;
  name: string;
  secid: string;
  kind: "stock" | "index";
}
interface SymbolSel {
  secid: string;
  name: string;
  kind: "stock" | "index";
}
type Period = "day" | "week" | "month";

const QUICK: SymbolSel[] = [
  { secid: "1.600519", name: "贵州茅台", kind: "stock" },
  { secid: "0.300750", name: "宁德时代", kind: "stock" },
  { secid: "1.000001", name: "上证指数", kind: "index" },
  { secid: "1.000300", name: "沪深300", kind: "index" },
  { secid: "1.601318", name: "中国平安", kind: "stock" },
];

/** 预设布局（x/y: 列/行，w/h 尺寸） */
const L_ALL = makeLayout([
  { id: "kline", x: 0, y: 0, w: 8, h: 7 },
  { id: "pattern", x: 8, y: 0, w: 4, h: 7 },
  { id: "radar", x: 0, y: 7, w: 4, h: 6 },
  { id: "valuation", x: 4, y: 7, w: 4, h: 6 },
  { id: "scan", x: 8, y: 7, w: 4, h: 6 },
  { id: "levels", x: 0, y: 13, w: 4, h: 6 },
  { id: "trend", x: 4, y: 13, w: 4, h: 6 },
  { id: "backtest", x: 8, y: 13, w: 4, h: 6 },
  { id: "indexes", x: 0, y: 19, w: 4, h: 5 },
  { id: "breadth", x: 4, y: 19, w: 4, h: 5 },
  { id: "pulse", x: 8, y: 19, w: 4, h: 5 },
  { id: "datastatus", x: 0, y: 24, w: 4, h: 5 },
]);
const L_QUOTES: GridLayout = {
  ...JSON.parse(JSON.stringify(L_ALL)),
  kline: { x: 4, y: 0, w: 8, h: 9, visible: true, mobileOrder: 1 },
  indexes: { x: 0, y: 0, w: 4, h: 5, visible: true, mobileOrder: 2 },
  breadth: { x: 0, y: 5, w: 4, h: 4, visible: true, mobileOrder: 3 },
  pulse: { x: 0, y: 9, w: 4, h: 5, visible: true, mobileOrder: 4 },
  datastatus: { x: 0, y: 14, w: 4, h: 5, visible: true, mobileOrder: 12 },
  pattern: { x: 4, y: 9, w: 8, h: 6, visible: true, mobileOrder: 5 },
  scan: { x: 4, y: 15, w: 8, h: 6, visible: true, mobileOrder: 6 },
  levels: { x: 4, y: 21, w: 8, h: 6, visible: true, mobileOrder: 7 },
  radar: { x: 0, y: 27, w: 6, h: 6, visible: true, mobileOrder: 8 },
  valuation: { x: 6, y: 27, w: 6, h: 6, visible: true, mobileOrder: 9 },
  trend: { x: 0, y: 33, w: 6, h: 6, visible: true, mobileOrder: 10 },
  backtest: { x: 6, y: 33, w: 6, h: 6, visible: true, mobileOrder: 11 },
};
const L_FUND: GridLayout = {
  ...JSON.parse(JSON.stringify(L_ALL)),
  kline: { x: 4, y: 0, w: 8, h: 7, visible: true, mobileOrder: 5 },
  radar: { x: 0, y: 0, w: 4, h: 7, visible: true, mobileOrder: 1 },
  valuation: { x: 0, y: 7, w: 4, h: 6, visible: true, mobileOrder: 2 },
  trend: { x: 0, y: 13, w: 4, h: 6, visible: true, mobileOrder: 3 },
  datastatus: { x: 0, y: 19, w: 4, h: 5, visible: true, mobileOrder: 4 },
  pattern: { x: 4, y: 7, w: 4, h: 6, visible: true, mobileOrder: 6 },
  scan: { x: 8, y: 7, w: 4, h: 6, visible: true, mobileOrder: 7 },
  levels: { x: 4, y: 13, w: 4, h: 6, visible: true, mobileOrder: 8 },
  backtest: { x: 8, y: 13, w: 4, h: 6, visible: true, mobileOrder: 9 },
  indexes: { x: 0, y: 24, w: 4, h: 5, visible: true, mobileOrder: 10 },
  breadth: { x: 4, y: 24, w: 4, h: 5, visible: true, mobileOrder: 11 },
  pulse: { x: 8, y: 19, w: 4, h: 5, visible: true, mobileOrder: 12 },
};
const L_STRAT: GridLayout = {
  ...JSON.parse(JSON.stringify(L_ALL)),
  kline: { x: 4, y: 0, w: 8, h: 7, visible: true, mobileOrder: 1 },
  pattern: { x: 0, y: 0, w: 4, h: 7, visible: true, mobileOrder: 2 },
  scan: { x: 0, y: 7, w: 4, h: 6, visible: true, mobileOrder: 3 },
  levels: { x: 0, y: 13, w: 4, h: 6, visible: true, mobileOrder: 4 },
  backtest: { x: 0, y: 19, w: 4, h: 6, visible: true, mobileOrder: 5 },
  radar: { x: 4, y: 7, w: 4, h: 6, visible: true, mobileOrder: 6 },
  valuation: { x: 8, y: 7, w: 4, h: 6, visible: true, mobileOrder: 7 },
  trend: { x: 4, y: 13, w: 4, h: 6, visible: true, mobileOrder: 8 },
  indexes: { x: 0, y: 25, w: 4, h: 5, visible: true, mobileOrder: 9 },
  breadth: { x: 4, y: 25, w: 4, h: 5, visible: true, mobileOrder: 10 },
  pulse: { x: 8, y: 25, w: 4, h: 5, visible: true, mobileOrder: 11 },
  datastatus: { x: 0, y: 30, w: 4, h: 5, visible: true, mobileOrder: 12 },
};

const PRESETS = [
  { key: "ALL", label: "全部", layout: L_ALL },
  { key: "QUOTES", label: "行情", layout: L_QUOTES },
  { key: "FUND", label: "财务", layout: L_FUND },
  { key: "STRAT", label: "策略", layout: L_STRAT },
];

const CARD_LABELS: Record<string, string> = {
  kline: "01 K线实验台",
  pattern: "02 形态识别",
  radar: "03 财务雷达",
  valuation: "04 估值区间",
  scan: "05 买卖点扫描",
  levels: "06 技术位",
  trend: "07 三表趋势",
  backtest: "08 策略回测",
  indexes: "09 全球指数一览",
  breadth: "10 市场宽度",
  pulse: "11 市场脉搏 · 全球时钟",
  datastatus: "12 数据状态 · 数据源",
};

const toSecid = (code: string) => (/^\d{6}$/.test(code) ? `${code.startsWith("6") ? "1" : "0"}.${code}` : code);

export default function LabTerminal() {
  // ---- 标的与数据（原 LabPage 状态逻辑） ----
  const [symbol, setSymbol] = useState<SymbolSel>(QUICK[0]);
  const [period, setPeriod] = useState<Period>("day");
  const [bars, setBars] = useState<LabBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [asOf, setAsOf] = useState("");
  const [showMarks, setShowMarks] = useState(true);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StockHit[]>([]);
  const [openList, setOpenList] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/stock/search?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setHits(Array.isArray(j?.hits) ? j.hits.slice(0, 8) : []))
        .catch(() => setHits([]));
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

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    fetch(`/api/stock/kline?secid=${symbol.secid}&period=${period}&days=260`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.klines) && j.klines.length) {
          setBars(j.klines);
          setAsOf(j.klines[j.klines.length - 1].date);
          if (j.name && j.name !== symbol.secid) setSymbol((s) => ({ ...s, name: j.name }));
        } else {
          setBars([]);
          setErr(j?.error ?? "K 线数据暂不可用，请重试");
        }
      })
      .catch(() => setErr("K 线数据加载失败"))
      .finally(() => setLoading(false));
  }, [symbol.secid, period, symbol]);

  useEffect(() => {
    load();
  }, [symbol.secid, period]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const isIndex = symbol.kind === "index";

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

  // ---- 跑马灯（/api/quotes 30s 轮询） ----
  const [tapeItems, setTapeItems] = useState<TapeQuote[]>([]);
  const [globalQuotes, setGlobalQuotes] = useState<TapeQuote[]>([]);
  const [quotesAsOf, setQuotesAsOf] = useState("");
  useEffect(() => {
    let dead = false;
    const fetchTape = () =>
      fetch("/api/quotes")
        .then((r) => r.json())
        .then((j) => {
          if (dead) return;
          const pick = (a: any[]): TapeQuote[] =>
            (Array.isArray(a) ? a : []).slice(0, 12).map((x) => ({ code: x.code, secid: x.secid ?? toSecid(x.code), name: x.name, price: x.price, changePct: x.changePct }));
          const g = pick(j.global);
          const idx = pick((j.quotes ?? []).filter((x: any) => ["000001", "399001", "399006", "000300", "000905", "000688"].includes(x.code)));
          const sec = pick(j.sectors ?? []);
          setTapeItems([...idx, ...g, ...sec]);
          setGlobalQuotes(g);
          setQuotesAsOf(new Date(j.time ?? Date.now()).toLocaleString("zh-CN", { hour12: false }));
        })
        .catch(() => {});
    fetchTape();
    const t = setInterval(fetchTape, 30000);
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

  /** 已知指数代码（用于 kind 判定：财报/估值模块需区分指数与个股） */
  const INDEX_CODES = new Set(["000001", "399001", "399006", "000300", "000905", "000688", "000016", "399005", "000852"]);

  /** 跑马灯点击联动：仅 A 股代码（6 位数字）可下钻为教学标的，
   *  全球指数（DJI/HSI…）与板块（BK…）仅作行情参考——其财报/估值为不同口径，切进去会报参数错误 */
  const onTapePick = useCallback((tq: TapeQuote) => {
    const code = tq.code;
    if (!/^\d{6}$/.test(code)) return;
    setSymbol({ secid: toSecid(code), name: tq.name, kind: INDEX_CODES.has(code) ? "index" : "stock" });
  }, []);

  const periodBtn = (p: Period, label: string) => (
    <button key={p} className={`gmt-chip${period === p ? " on" : ""}`} onClick={() => setPeriod(p)} aria-pressed={period === p}>
      {label}
    </button>
  );

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

      <LabToolbar
        editing={editing}
        preset={preset}
        presets={PRESETS.map(({ key, label }) => ({ key, label }))}
        removedIds={removedIds}
        onPreset={grid.applyPreset}
        onEdit={grid.toggleEdit}
        onReset={grid.reset}
        onRestore={restore}
        cardLabels={CARD_LABELS}
      />

      {err && (
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--line)", color: "var(--danger)", fontSize: 11 }}>
          {err}{" "}
          <button className="gmt-chip" onClick={load} style={{ marginLeft: 8 }}>
            重试
          </button>
        </div>
      )}

      <main className="gmt-grid" ref={gridRef} aria-label="终端组件网格">
        {/* 01 K线实验台 */}
        {layout.kline?.visible !== false && (
          <GmtCard
            id="kline" num="01" title={`交互式 K 线实验台 · ${symbol.name}`} asOf={asOf}
            layout={layout.kline} editing={editing} focused={focused === "kline"} zoomed={zoomed === "kline"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            fill
            note={<>数据源：东方财富 / 新浪 / 腾讯多源容错（前复权）。回放模式下指标仅用「已显示数据」计算 —— 不窥视未来。红=阳线（涨）绿=阴线（跌），A 股惯例。绿三角=买点标注，红针=卖点标注（02/05 联动）。</>}
          >
            {/* 标的搜索 + 快捷 + 周期 + 标注开关（01 卡控制行） */}
            <div className="gmt-ctl-row">
              <div className="relative shrink-0" style={{ width: 280 }} ref={searchBoxRef}>
                <div className="flex items-center gap-1.5" style={{ border: "1px solid var(--line-strong)", background: "#000" }}>
                  <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-dim)", marginLeft: 6 }} />
                  <input
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setOpenList(true); }}
                    onFocus={() => setOpenList(true)}
                    placeholder="搜索标的：平安 / 600519 / 上证"
                    aria-label="选择分析标的"
                    className="gmt-search"
                    style={{ border: "none", background: "transparent", flex: 1, minWidth: 0 }}
                  />
                </div>
                {openList && hits.length > 0 && (
                  <ul className="absolute z-30 top-full mt-1 w-full overflow-hidden" style={{ background: "var(--bg-raise)", border: "1px solid var(--amber)" }}>
                    {hits.map((h) => (
                      <li key={h.secid}>
                        <button
                          onClick={() => pick(h)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left gmt-chip"
                          style={{ border: "none", width: "100%", justifyContent: "flex-start" }}
                        >
                          <span style={{ color: "var(--fg)" }}>{h.name}</span>
                          <span style={{ color: "var(--fg-faint)", fontSize: 9 }}>{h.code}</span>
                          <span className="ml-auto" style={{ fontSize: 9, color: "var(--fg-dim)" }}>{h.kind === "index" ? "指数" : "个股"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="gmt-chip" style={{ border: "none", cursor: "default" }}>快捷:</span>
              {QUICK.map((s) => (
                <button key={s.secid} className={`gmt-chip${symbol.secid === s.secid ? " on" : ""}`} onClick={() => setSymbol(s)}>
                  {s.name}
                </button>
              ))}
              <span className="gmt-tb-sep" />
              {periodBtn("day", "日K")}
              {periodBtn("week", "周K")}
              {periodBtn("month", "月K")}
              <span className="gmt-tb-sep" />
              <button className={`gmt-chip${showMarks ? " on" : ""}`} onClick={() => setShowMarks(!showMarks)} aria-pressed={showMarks}>
                买卖点标注 {showMarks ? "开" : "关"}
              </button>
              <button className="gmt-chip" onClick={load} aria-label="刷新数据">
                <RefreshCw className={`w-3 h-3 inline${loading ? " animate-spin" : ""}`} /> 刷新
              </button>
              {last && (
                <span className="ml-auto font-mono" style={{ fontSize: 11 }}>
                  <b style={{ color: "var(--amber)" }}>{last.close.toFixed(2)}</b>{" "}
                  <span className={pct >= 0 ? "up" : "down"}>
                    {pct >= 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </span>{" "}
                  <span style={{ color: "var(--fg-faint)", fontSize: 9 }}>
                    {asOf} 收盘 · {bars.length} 根{period === "day" ? "日" : period === "week" ? "周" : "月"}K
                  </span>
                </span>
              )}
            </div>
            <KlineLab bars={bars} symbol={symbol.name} period={period} marks={marks} showMarks={showMarks} />
          </GmtCard>
        )}

        {/* 02 形态识别 */}
        {layout.pattern?.visible !== false && (
          <GmtCard
            id="pattern" num="02" title="K 线形态与买卖点识别" asOf={asOf}
            layout={layout.pattern} editing={editing} focused={focused === "pattern"} zoomed={zoomed === "pattern"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>形态判定（《日本蜡烛图技术》通用定义的工程化简化）：影线/实体倍数阈值固定，趋势前提用前 5 根累计涨跌幅近似。形态是概率提示而非确定性信号；标注同步至 01 实验台。</>}
          >
            <PatternCard bars={bars} />
          </GmtCard>
        )}

        {/* 03 财务雷达 */}
        {layout.radar?.visible !== false && (
          <GmtCard
            id="radar" num="03" title="企业财务质量多维评估雷达"
            layout={layout.radar} editing={editing} focused={focused === "radar"} zoomed={zoomed === "radar"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>数据源：东方财富 F10 主要财务指标（近 8 期财报）。归一化口径：CAGR [-50%,50%]→[0,100]，毛利率 [0,60%]→[0,100]，ROE [0,30%]→[0,100]，稳定性=100−5σ。教学对比用途，不构成评级。</>}
          >
            <RadarCard secid={symbol.secid} isIndex={isIndex} />
          </GmtCard>
        )}

        {/* 04 估值区间 */}
        {layout.valuation?.visible !== false && (
          <GmtCard
            id="valuation" num="04" title="估值区间测算" asOf={asOf}
            layout={layout.valuation} editing={editing} focused={focused === "valuation"} zoomed={zoomed === "valuation"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>数据源：东方财富 RPT_VALUEANALYSIS_DET（近 5 年约 1240 交易日每日估值）。分位 = 历史序列中小于当前值的样本占比。相对估值仅衡量「相对自身历史贵贱」，不同行业不可横向比较。</>}
          >
            <ValuationCard secid={symbol.secid} isIndex={isIndex} />
          </GmtCard>
        )}

        {/* 05 买卖点扫描 */}
        {layout.scan?.visible !== false && (
          <GmtCard
            id="scan" num="05" title="买卖点扫描器" asOf={asOf}
            layout={layout.scan} editing={editing} focused={focused === "scan"} zoomed={zoomed === "scan"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>信号 = 指标穿越事件的规则触发记录（MACD/KDJ/RSI/均线四套规则，阈值全部公开可复算），标注同步至 01 实验台。历史信号统计不等于未来胜率。</>}
          >
            <ScanCard bars={bars} />
          </GmtCard>
        )}

        {/* 06 技术位 */}
        {layout.levels?.visible !== false && (
          <GmtCard
            id="levels" num="06" title="技术位分析" asOf={asOf}
            layout={layout.levels} editing={editing} focused={focused === "levels"} zoomed={zoomed === "levels"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>支撑/压力：局部极值（前后 5 根窗口）按 1.5% 价格容差聚类，≥2 次触及有效；均线 MA5/10/20/60/120/250 简单平均。均为公开可复算的统计口径。</>}
          >
            <LevelsCard bars={bars} />
          </GmtCard>
        )}

        {/* 07 三表趋势 */}
        {layout.trend?.visible !== false && (
          <GmtCard
            id="trend" num="07" title="财务三表趋势"
            layout={layout.trend} editing={editing} focused={focused === "trend"} zoomed={zoomed === "trend"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>数据源：东方财富 F10 主要财务指标（季报累计口径）。营收/净利单位亿元（左轴），毛利率/加权 ROE 百分比（右轴）。</>}
          >
            <TrendCard secid={symbol.secid} isIndex={isIndex} />
          </GmtCard>
        )}

        {/* 08 策略回测 */}
        {layout.backtest?.visible !== false && (
          <GmtCard
            id="backtest" num="08" title="策略回测" asOf={asOf}
            layout={layout.backtest} editing={editing} focused={focused === "backtest"} zoomed={zoomed === "backtest"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>回测引擎：全仓买卖、T+1 次日开盘成交近似、双边佣金万三。净值对比买入持有基准。历史回测不代表未来表现，参数为教学用固定值（无过拟合优化）。</>}
          >
            <BacktestCard bars={bars} symbol={symbol.name} />
          </GmtCard>
        )}

        {/* 09 全球指数一览 */}
        {layout.indexes?.visible !== false && (
          <GmtCard
            id="indexes" num="09" title="全球指数一览" asOf={quotesAsOf}
            layout={layout.indexes} editing={editing} focused={focused === "indexes"} zoomed={zoomed === "indexes"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
            note={<>点击行联动全终端切换分析标的 · 快照存在 15–20 秒级延迟 · 来源：东方财富/腾讯公开行情</>}
          >
            <IndexListCard quotes={globalQuotes} activeSecid={symbol.secid} onPick={(secid) => setSymbol((s) => ({ ...s, secid }))} asOf={quotesAsOf} />
          </GmtCard>
        )}

        {/* 10 市场宽度 */}
        {layout.breadth?.visible !== false && (
          <GmtCard
            id="breadth" num="10" title="市场宽度"
            layout={layout.breadth} editing={editing} focused={focused === "breadth"} zoomed={zoomed === "breadth"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
          >
            <BreadthCard />
          </GmtCard>
        )}

        {/* 11 市场脉搏 */}
        {layout.pulse?.visible !== false && (
          <GmtCard
            id="pulse" num="11" title="市场脉搏 · 全球时钟"
            layout={layout.pulse} editing={editing} focused={focused === "pulse"} zoomed={zoomed === "pulse"}
            desktop={desktop} containerW={containerW} geometry={grid.geometry}
            onFocus={grid.setFocused} onAction={onCardAction} onMove={(id, x, y) => grid.update(id, { x, y })} onResize={(id, w, h) => grid.update(id, { w, h })}
          >
            <PulseCard />
          </GmtCard>
        )}

        {/* 12 数据状态 */}
        {layout.datastatus?.visible !== false && (
          <GmtCard
            id="datastatus" num="12" title="数据状态 · 数据源"
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
