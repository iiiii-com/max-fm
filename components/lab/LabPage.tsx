"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import LabCard from "./LabCard";
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

const MODULES = [
  { num: "01", label: "K线实验台" },
  { num: "02", label: "形态识别" },
  { num: "03", label: "财务雷达" },
  { num: "04", label: "估值区间" },
  { num: "05", label: "买卖点扫描" },
  { num: "06", label: "技术位" },
  { num: "07", label: "三表趋势" },
  { num: "08", label: "策略回测" },
];

const QUICK: SymbolSel[] = [
  { secid: "1.600519", name: "贵州茅台", kind: "stock" },
  { secid: "0.300750", name: "宁德时代", kind: "stock" },
  { secid: "1.000001", name: "上证指数", kind: "index" },
  { secid: "1.000300", name: "沪深300", kind: "index" },
  { secid: "1.601318", name: "中国平安", kind: "stock" },
];

export default function LabPage() {
  const [symbol, setSymbol] = useState<SymbolSel>(QUICK[0]);
  const [period, setPeriod] = useState<Period>("day");
  const [bars, setBars] = useState<LabBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [asOf, setAsOf] = useState("");
  const [showMarks, setShowMarks] = useState(true);

  // ---- 搜索联想 ----
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

  // ---- K 线数据（周期切换重拉） ----
  const load = () => {
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
  };

  useEffect(load, [symbol.secid, period]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 买卖点标注（02 形态 + 05 信号 联动至 01 实验台） ----
  const marks = useMemo<LabMark[]>(() => {
    if (bars.length < 35) return [];
    const pats = detectPatterns(bars).map((h) => ({ index: h.index, type: h.signal, label: h.name }));
    const sigs = scanSignals(bars).map((s) => ({ index: s.index, type: s.type, label: s.source }));
    // 同一根 K 线信号去重（形态优先展示）
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

  const periodBtn = (p: Period, label: string) => (
    <button
      key={p}
      onClick={() => setPeriod(p)}
      className={`px-2.5 py-1 rounded-md text-xs transition-colors duration-150 ${
        period === p ? "bg-primary text-white" : "text-muted hover:text-foreground hover:bg-border/60"
      }`}
      aria-pressed={period === p}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-5">
      {/* 页头 + 标的选择器 */}
      <header className="card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold tracking-tight">实操工具箱 · K 线实验室</h1>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              八大模块全部基于真实行情与财报数据 · 教学口径公开 · 严禁虚构
            </p>
          </div>

          {/* 搜索器 */}
          <div className="flex-1 max-w-xl relative" ref={searchBoxRef}>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 h-10 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_var(--ring)] transition-shadow">
              <Search className="w-4 h-4 text-muted shrink-0" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpenList(true);
                }}
                onFocus={() => setOpenList(true)}
                placeholder="输入股票/指数名称或代码，如：平安 / 600519 / 上证"
                aria-label="选择分析标的"
                className="flex-1 bg-transparent outline-none text-sm min-w-0"
              />
              {q && (
                <button onClick={() => { setQ(""); setHits([]); }} className="text-muted hover:text-primary text-xs shrink-0" aria-label="清空">
                  ✕
                </button>
              )}
            </div>
            {openList && hits.length > 0 && (
              <ul className="absolute z-20 top-full mt-1.5 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                {hits.map((h) => (
                  <li key={h.secid}>
                    <button
                      onClick={() => pick(h)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-primary-soft transition-colors text-left"
                    >
                      <span className="font-medium">{h.name}</span>
                      <span className="font-mono text-xs text-muted">{h.code}</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-border/60 text-muted">{h.kind === "index" ? "指数" : "个股"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 快捷标的 + 当前标的 + 周期 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-border/70">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-muted mr-1">快捷：</span>
            {QUICK.map((s) => (
              <button
                key={s.secid}
                onClick={() => setSymbol(s)}
                className={`px-2 py-0.5 rounded text-xs transition-colors duration-150 ${
                  symbol.secid === s.secid ? "bg-primary text-white" : "text-muted hover:text-primary"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {periodBtn("day", "日K")}
            {periodBtn("week", "周K")}
            {periodBtn("month", "月K")}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowMarks(!showMarks)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors duration-150 ${
                showMarks ? "bg-primary-soft text-primary font-medium" : "text-muted hover:bg-border/60"
              }`}
              aria-pressed={showMarks}
            >
              买卖点标注 {showMarks ? "开" : "关"}
            </button>
            <button
              onClick={load}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-border text-muted hover:text-primary hover:border-primary/50 transition-colors"
              aria-label="刷新数据"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> 刷新
            </button>
          </div>
        </div>

        {/* 当前标的信息条 */}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-lg font-bold">{symbol.name}</span>
          <span className="font-mono text-xs text-muted">{symbol.secid}</span>
          {last && (
            <>
              <span className="text-xl font-bold font-mono tabular-nums">{last.close.toFixed(2)}</span>
              <span className={`font-mono font-bold tabular-nums ${pct >= 0 ? "up" : "down"}`}>
                {pct >= 0 ? "+" : ""}
                {pct.toFixed(2)}%
              </span>
              <span className="text-xs text-muted font-mono">
                {asOf} 收盘 · {bars.length} 根{period === "day" ? "日" : period === "week" ? "周" : "月"}K
              </span>
            </>
          )}
        </div>
      </header>

      {/* 模块锚点导航（sticky） */}
      <nav aria-label="模块导航" className="sticky top-[104px] z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-background/90 backdrop-blur border-b border-border/70">
        <div className="flex items-center gap-1 overflow-x-auto ticker-scroll">
          {MODULES.map((m) => (
            <a
              key={m.num}
              href={`#lab-${m.num}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted hover:text-primary hover:bg-primary-soft transition-colors shrink-0"
            >
              <span className="font-mono font-bold">{m.num}</span>
              {m.label}
            </a>
          ))}
        </div>
      </nav>

      {err && (
        <div className="card p-4 text-sm text-muted flex items-center justify-between flex-wrap gap-2">
          <span>{err}</span>
          <button onClick={load} className="text-xs px-3 py-1 rounded-md border border-border hover:border-primary/50 hover:text-primary transition-colors">
            重试
          </button>
        </div>
      )}

      {/* 01 K线实验台 */}
      <LabCard
        num="01"
        title="交互式 K 线实验台"
        sub="多周期 · 指标叠加 · 历史回放 · 买卖点标注联动"
        asOf={asOf}
        action={
          <span className="text-[11px] text-muted">
            {showMarks ? `已叠加 ${marks.length} 个买卖点标注（02/05 联动）` : "买卖点标注已关闭"}
          </span>
        }
        note={
          <>
            数据源：东方财富 / 新浪 / 腾讯多源容错（前复权）。回放模式下指标仅用「已显示数据」计算 —— 不窥视未来，符合教学正确性。
            红=阳线（涨）绿=阴线（跌），A 股惯例。绿三角=看涨/买点标注，红针=看跌/卖点标注。
          </>
        }
      >
        <KlineLab bars={bars} symbol={symbol.name} period={period} marks={marks} showMarks={showMarks} />
      </LabCard>

      {/* 02 形态识别 */}
      <LabCard
        num="02"
        title="K 线形态与买卖点识别"
        sub="经典形态自动扫描 · 图上标注同步至 01 实验台"
        asOf={asOf}
        note={<>形态判定规则见右表（《日本蜡烛图技术》通用定义的工程化简化：影线/实体倍数阈值固定，趋势前提用前 5 根累计涨跌幅近似）。形态是概率提示而非确定性信号。</>}
      >
        <PatternCard bars={bars} />
      </LabCard>

      {/* 03 财务雷达 */}
      <LabCard
        num="03"
        title="企业财务质量多维评估雷达"
        sub="营收成长 · 利润成长 · 盈利能力 · 股东回报 · 业绩稳定"
        note={<>数据源：东方财富 F10 主要财务指标（近 8 期财报）。五维归一化口径见右侧灰字原始值：CAGR 映射 [-50%,50%]→[0,100]，毛利率 [0,60%]→[0,100]，ROE [0,30%]→[0,100]，稳定性 = 100−5σ。教学对比用途，不构成评级。</>}
      >
        <RadarCard secid={symbol.secid} isIndex={isIndex} />
      </LabCard>

      {/* 04 估值区间 */}
      <LabCard
        num="04"
        title="估值区间测算"
        sub="PE-TTM / PB 近 5 年历史分位带 · 当前位置 · 测算依据"
        note={<>数据源：东方财富 RPT_VALUEANALYSIS_DET（近 5 年约 1240 交易日每日估值）。分位 = 历史序列中小于当前值的样本占比。相对估值仅衡量「相对自身历史贵贱」，不同行业不可横向比较。</>}
      >
        <ValuationCard secid={symbol.secid} isIndex={isIndex} />
      </LabCard>

      {/* 05 买卖点扫描 */}
      <LabCard
        num="05"
        title="买卖点扫描器"
        sub="MACD / KDJ / RSI / 均线四套明确规则 · 全量信号可复算"
        asOf={asOf}
        note={<>信号 = 指标穿越事件的规则触发记录（阈值见右表），标注同步至 01 实验台。历史信号统计不等于未来胜率，教学演示用途。</>}
      >
        <ScanCard bars={bars} />
      </LabCard>

      {/* 06 技术位 */}
      <LabCard
        num="06"
        title="技术位分析"
        sub="支撑位 / 压力位（极值聚类）· 均线系统 · 现价相对位置"
        asOf={asOf}
        note={<>支撑/压力：局部极值（前后 5 根窗口）按 1.5% 价格容差聚类，出现 ≥2 次视为有效位；均线：MA5/10/20/60/120/250 收盘价简单平均。均为公开可复算的统计口径。</>}
      >
        <LevelsCard bars={bars} />
      </LabCard>

      {/* 07 三表趋势 */}
      <LabCard
        num="07"
        title="财务三表趋势"
        sub="营收 / 归母净利（柱）· 毛利率 / ROE（线）· 近 8 期"
        note={<>数据源：东方财富 F10 主要财务指标（季报累计口径）。营收/净利单位为亿元（左轴），毛利率/加权 ROE 为百分比（右轴）。</>}
      >
        <TrendCard secid={symbol.secid} isIndex={isIndex} />
      </LabCard>

      {/* 08 策略回测 */}
      <LabCard
        num="08"
        title="策略回测"
        sub="预设策略库 × 当前标的真实历史 K 线 · 逐笔明细公开"
        asOf={asOf}
        note={<>回测引擎：全仓买卖、T+1 次日开盘成交近似、双边佣金万三。净值曲线对比买入持有基准。历史回测不代表未来表现，参数无过拟合优化（教学用固定参数）。</>}
      >
        <BacktestCard bars={bars} symbol={symbol.name} />
      </LabCard>
    </div>
  );
}
