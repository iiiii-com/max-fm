import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { CollapsibleOnMobile } from "@/components/ui-disclosure";
import {
  CrashRecoveryChart,
  BullScatterChart,
  CrashDepthChart,
  SensitivityChart,
  type CrashRow,
  type BullRow,
  type SensitivityRow,
} from "@/components/cycle/CycleCharts";

export const dynamic = "force-static";
export const metadata = {
  title: "全球股市完整周期解剖 · 牛熊机制与修复能力",
  description:
    "以上证综指真实日线复算 A 股历次熊市深度、下跌与修复时长，并对照外部研究给出的口径差异；附牛熊驱动引擎、周期闭环与终结信号框架。",
};

/* ───────────────────────── 数据（构建期读取，全部可复现） ───────────────────────── */

interface CycleData {
  meta: {
    source: string;
    generatedFrom: string;
    bars: number;
    rangeFrom: string;
    rangeTo: string;
    basis: string;
    detectThresholdPct: number;
    troughConfirmThresholdPct: number;
    majorThresholdPct: number;
    definition: string;
  };
  crashes: CrashRow[];
  bulls: BullRow[];
  sensitivity: SensitivityRow[];
  summary: {
    crashCount: number;
    majorCrashCount: number;
    recoveredCount: number;
    unrecovered: string[];
    worstDrawdownPct: number;
    longestRecoveryDays: number;
    bullCount: number;
  };
}

function loadCycleData(): CycleData {
  const p = resolve(process.cwd(), "data/cycle-crashes.json");
  return JSON.parse(readFileSync(p, "utf8")) as CycleData;
}

/**
 * 外部研究文本给出的 A 股牛市涨幅。
 * 与站点复算值并列展示，差异一目了然 —— 这是刻意的设计：
 * 站点原则是数据必须可溯源，因此**不**用外部数字覆盖复算值，而是把差异摊开给读者看。
 */
const TEXT_BULLS: Record<string, number> = {
  "1990-12-19": 1392,
  "1996-01-19": 194,
  "1999-05-19": 114,
  "2005-06-06": 513,
  "2008-10-28": 109,
  "2013-06-25": 162,
};

/* ───────────────────────── 研究框架区块（与数据区做视觉区分） ───────────────────────── */

function FrameworkSection({
  index,
  title,
  sub,
  children,
}: {
  index: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-l-2 border-primary/50 pl-4 sm:pl-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary">{index}</span>
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        <Badge tone="amber">研究框架 · 观点</Badge>
      </div>
      {sub && <p className="mb-3 text-xs leading-relaxed text-muted">{sub}</p>}
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** 观点正文里的关键句 */
function Key({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-primary">{children}</strong>;
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-foreground/90">{children}</p>;
}

export default function CycleAnatomyPage() {
  const d = loadCycleData();
  const { meta, crashes, bulls, sensitivity, summary } = d;

  // 两套数字对照：站点复算 vs 外部文本（仅列出文本覆盖到的轮次）
  const compare = bulls
    .filter((b) => TEXT_BULLS[b.from] !== undefined)
    .map((b) => {
      const textVal = TEXT_BULLS[b.from];
      return { ...b, textVal, diff: Number((b.changePct - textVal).toFixed(1)) };
    });
  const diffCount = compare.filter((c) => Math.abs(c.diff) >= 1).length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-3 py-6 sm:px-4">
      {/* 页头 */}
      <header className="space-y-2">
        <h1 className="text-xl font-bold sm:text-2xl">全球股市完整周期解剖</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          牛市如何启动、崩盘为何发生、修复需要多久。A 股部分全部由<span className="text-foreground">上证综指真实日线复算</span>
          （{meta.bars} 根，{meta.rangeFrom} ~ {meta.rangeTo}），每个数字都可由脚本一键复现；
          驱动机制与周期规律属<span className="text-foreground">研究框架</span>，与数据区分呈现。
        </p>
      </header>

      {/* 口径声明：放在最前面，避免读者误读 */}
      <Card className="border-primary/30 bg-primary/5 p-4">
        <p className="mb-1.5 text-sm font-bold text-primary">数据口径声明（请先读）</p>
        <ul className="space-y-1.5 text-[12px] leading-relaxed text-muted">
          <li>
            <span className="text-foreground">熊市定义：</span>
            {meta.definition}
            本次采用 入熊回撤 ≥{meta.detectThresholdPct}%、谷底确认需自低点反弹 ≥{meta.troughConfirmThresholdPct}%；
            回撤 ≥{meta.majorThresholdPct}% 标记为「大熊市」。
          </li>
          <li>
            <span className="text-foreground">基准：</span>
            {meta.basis}；数据源：{meta.source}。
          </li>
          <li>
            <span className="text-foreground">可复现：</span>
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-primary">
              npx tsx {meta.generatedFrom}
            </code>
            <span className="ml-1">（生成 data/cycle-crashes.json）</span>
          </li>
        </ul>
      </Card>

      {/* ───────── 一、A 股牛市：复算值 vs 外部口径 ───────── */}
      <section className="space-y-3">
        <SectionTitle
          title="一、A 股牛市：复算值与外部口径对照"
          sub="外部研究给出的涨幅与本站按真实日线复算值存在系统性偏差，此处并列展示，不做取舍"
        />

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="red">本站复算 {compare.length} 轮</Badge>
            {diffCount > 0 && <Badge tone="amber">{diffCount} 轮与外部口径不一致</Badge>}
            <span className="text-[11px] text-muted">偏差 = 复算值 − 外部值；正值表示外部值偏低</span>
          </div>

          <div className="overflow-x-auto">
            {/* min-w 保证窄屏下改为横向滚动，而不是把 6 列挤压到不可读 */}
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">牛市</th>
                  <th scope="col" className="py-2 pr-3 font-medium">区间</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">持续</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">复算涨幅</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">外部口径</th>
                  <th scope="col" className="py-2 text-right font-medium">偏差</th>
                </tr>
              </thead>
              <tbody>
                {bulls.map((b) => {
                  const t = TEXT_BULLS[b.from];
                  const diff = t === undefined ? null : Number((b.changePct - t).toFixed(1));
                  return (
                    <tr key={b.from} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-3 text-[13px]">{b.label ?? "—"}</td>
                      <td className="py-1.5 pr-3 font-mono text-[11px] text-muted">
                        {b.from} ~ {b.to}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-[12px] text-muted">
                        {Math.round(b.days / 30.44)} 月
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-[12px] font-semibold text-up">
                        +{b.changePct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-[12px] text-muted">
                        {t === undefined ? "—" : `+${t}%`}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[12px]">
                        {diff === null ? (
                          <span className="text-muted/50">—</span>
                        ) : Math.abs(diff) < 1 ? (
                          <span className="text-muted">一致</span>
                        ) : (
                          <span className="text-primary">{diff > 0 ? "+" : ""}{diff.toFixed(1)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-muted">
            说明：外部口径未给出计算方式与数据源，无法复现；本站值以<span className="text-foreground">收盘价</span>为基准、由上证日线直接复算，
            口径与生成脚本均在仓库内可查。外部文本另称 A 股有 6 轮牛市，本站按同一口径检出 {bulls.length} 段
            （多出 2016 白马牛、2019 结构牛、2024 924 行情等）。
          </p>
        </Card>

        <Card className="p-4">
          <p className="mb-1 text-sm font-bold">牛市「持续时长 × 累计涨幅」分布</p>
          <p className="mb-2 text-[11px] text-muted">气泡大小表示持续天数。A 股牛市呈现「短时长、高涨幅」的密集分布，与美股长牛形态差异明显</p>
          <BullScatterChart rows={bulls} />
        </Card>
      </section>

      {/* ───────── 二、熊市与修复 ───────── */}
      <section className="space-y-3">
        <SectionTitle
          title="二、熊市深度、下跌时长与修复能力"
          sub={`同一批真实日线，按声明口径检出 ${summary.crashCount} 次熊市，其中大熊市 ${summary.majorCrashCount} 次`}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "检出熊市", value: `${summary.crashCount} 次`, hint: `其中 ≥30% 的 ${summary.majorCrashCount} 次`, tone: "" },
            { label: "最深回撤", value: `${summary.worstDrawdownPct.toFixed(1)}%`, hint: "1993–1994 泡沫破裂", tone: "down" },
            { label: "最长修复", value: `${summary.longestRecoveryDays} 自然日`, hint: `约 ${(summary.longestRecoveryDays / 365.25).toFixed(1)} 年`, tone: "primary" },
            { label: "至今未修复", value: `${summary.unrecovered.length} 次`, hint: summary.unrecovered.join("、"), tone: "primary" },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-[11px] text-muted">{s.label}</p>
              <p className={`mt-0.5 font-mono text-lg font-bold ${s.tone === "down" ? "text-down" : s.tone === "primary" ? "text-primary" : "text-foreground"}`}>
                {s.value}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{s.hint}</p>
            </Card>
          ))}
        </div>

        <Card className="p-4">
          <p className="mb-1 text-sm font-bold">下跌时长 vs 修复时长</p>
          <p className="mb-2 text-[11px] text-muted">
            左侧为下跌耗时，右侧为自谷底重新站上前高所需时间。灰色半透明表示<span className="text-foreground">至今未修复</span>（柱长非真实值，仅供视觉占位）
          </p>
          <CrashRecoveryChart rows={crashes} height={Math.max(360, crashes.length * 24)} />
        </Card>

        <Card className="p-4">
          <p className="mb-1 text-sm font-bold">历次熊市深度排序</p>
          <p className="mb-2 text-[11px] text-muted">按回撤深度降序；深色为「大熊市」（≥30%）</p>
          <CollapsibleOnMobile collapsedHeight={420} moreLabel={`展开全部 ${crashes.length} 次`}>
            <CrashDepthChart rows={crashes} height={Math.max(320, crashes.length * 24)} />
          </CollapsibleOnMobile>
        </Card>

        <Card className="p-4">
          <p className="mb-1 text-sm font-bold">口径敏感性：「有几次熊市」取决于定义</p>
          <p className="mb-2 text-[11px] leading-relaxed text-muted">
            入熊阈值固定为 {meta.detectThresholdPct}%，仅改变「谷底确认」所需的反弹幅度，检出次数即从
            <span className="text-foreground"> {sensitivity[0]?.count} 次</span> 变到
            <span className="text-foreground"> {sensitivity[sensitivity.length - 1]?.count} 次</span>。
            因此本站不主张某个「唯一正确」的熊市次数，而是把口径与结果一并公开。
          </p>
          <SensitivityChart rows={sensitivity} active={meta.troughConfirmThresholdPct} />
        </Card>
      </section>

      {/* ───────── 三～六：研究框架 ───────── */}
      <FrameworkSection
        index="三"
        title="牛市驱动引擎：中美两套结构"
        sub="以下为研究框架，非本站复算数据。美股与 A 股的驱动力构成存在结构性差异。"
      >
        <Card className="p-4">
          <p className="mb-2 text-xs font-bold text-foreground">美股：资本运作闭环</p>
          <Para>
            <Key>利率环境</Key> → <Key>企业盈利</Key> → <Key>股票回购</Key> → <Key>被动资金</Key>。
            低利率压低发债成本，企业借债回购推升 EPS，股价上涨又降低融资成本，形成
            <span className="text-foreground">「利率 → 回购 → EPS → 股价」</span>的自我强化循环；
            被动 ETF 的持续流入为循环提供稳定买盘。
          </Para>
          <p className="mt-3 border-t border-border/60 pt-2 text-[12px] text-muted">
            断裂条件：利率上行或信用利差走阔 → 发债成本上升 → 回购停止 → EPS 失去支撑 → 循环解体。
          </p>
        </Card>
        <Card className="p-4">
          <p className="mb-2 text-xs font-bold text-foreground">A 股：政策博弈闭环</p>
          <Para>
            <Key>政策转向</Key> → <Key>资金流入</Key> → <Key>情绪扩张</Key> → <Key>估值泡沫</Key>。
            大牛市启动通常需要「政策转向 + 资金流入 + 估值低位」三者同时具备，
            路径为<span className="text-foreground">「政策 → 资金 → 情绪 → 泡沫」</span>。
          </Para>
          <p className="mt-3 border-t border-border/60 pt-2 text-[12px] text-muted">
            断裂条件：估值过高、政策转向收紧、增量资金枯竭、盈利证伪——四者共振时终结。
          </p>
        </Card>
      </FrameworkSection>

      <FrameworkSection
        index="四"
        title="完整周期：六阶段闭环"
        sub="研究框架。股市总是在绝望中重生，在争议中上涨，在狂欢中崩盘。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { n: "1", t: "孕育期", d: "估值低位、政策转向宽松、资金开始流入，市场充满争议。" },
            { n: "2", t: "爆发期", d: "资金加速流入、盈利改善，估值与盈利同时提升，形成戴维斯双击。" },
            { n: "3", t: "疯狂期", d: "估值极端化，情绪驱动全面补涨。估值越高，下跌空间越大。" },
            { n: "4", t: "崩盘期", d: "估值泡沫 + 杠杆结构 + 情绪机制三层共振，下跌→强制卖出→进一步下跌。" },
            { n: "5", t: "修复期", d: "跌幅决定修复下限，政策决定修复速度，制度变革决定修复质量。" },
            { n: "6", t: "新一轮", d: "估值重回低位、政策再次宽松，新一轮周期启动。" },
          ].map((s) => (
            <Card key={s.n} className="p-3">
              <p className="flex items-center gap-2 text-xs font-bold">
                <span className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary">{s.n}</span>
                {s.t}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{s.d}</p>
            </Card>
          ))}
        </div>
        <Card className="p-4">
          <p className="text-[12px] leading-relaxed text-foreground/90">
            A 股修复呈现清晰的<span className="text-foreground">「政策底 → 市场底 → 盈利底」</span>时序，
            政策底通常领先市场底约 1.5–3 个月；美股修复更多依赖市场自身出清与货币政策。
            <span className="text-muted">（上述时序为框架性描述，本站未做统计检验，暂不作为数据结论呈现。）</span>
          </p>
        </Card>
      </FrameworkSection>

      <FrameworkSection
        index="五"
        title="牛市终结的预警信号"
        sub="研究框架。美股市值化、信用利差属市场化信号；A 股政策转向属行政信号。"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-2 text-xs font-bold text-foreground">美股 · 三大信号</p>
            <ul className="space-y-2 text-[12px] leading-relaxed text-muted">
              <li><span className="text-foreground">盈利先于股价见顶下滑</span> —— 盈利无法支撑估值时泡沫破裂。</li>
              <li><span className="text-foreground">信用利差先于股市见顶走阔</span> —— 流动性收紧的先行指标。</li>
              <li><span className="text-foreground">估值进入极端区间</span> —— 巴菲特指标、席勒 CAPE 处于历史高位。</li>
            </ul>
          </Card>
          <Card className="p-4">
            <p className="mb-2 text-xs font-bold text-foreground">A 股 · 四大信号</p>
            <ul className="space-y-2 text-[12px] leading-relaxed text-muted">
              <li><span className="text-foreground">估值过高</span> —— 盈利增速无法消化估值。</li>
              <li><span className="text-foreground">政策转向</span> —— 历史上三轮大牛市终结均含政策因素。</li>
              <li><span className="text-foreground">增量资金枯竭</span> —— 杠杆撤退、发行遇冷、外资流出共振。</li>
              <li><span className="text-foreground">经济复苏证伪</span> —— 下半场缺少基本面支撑则终将回吐。</li>
            </ul>
          </Card>
        </div>
        <Card className="p-4">
          <p className="text-[12px] leading-relaxed text-foreground/90">
            共性：<span className="text-foreground">估值过高与盈利无法兑现</span>是两国共有的核心信号。
            差异：美股更依赖信用利差这类市场化信号，终结往往是「慢性病」；
            A 股更依赖政策转向这类行政信号，终结往往是「急性病」。
          </p>
        </Card>
      </FrameworkSection>

      <FrameworkSection index="六" title="核心规律" sub="研究框架，供理解周期使用。">
        <div className="space-y-2">
          {[
            ["牛市是崩盘的燃料", "牛市越疯狂、估值越极端，崩盘越深。估值极端化是崩盘的前置条件。"],
            ["驱动引擎根本不同", "美股偏「盈利驱动型」，A 股偏「政策 + 资金驱动型」，决定了两者牛熊形态差异。"],
            ["驱动逻辑互为镜像", "美股是资本运作闭环，A 股是政策博弈闭环——一个依赖利率与信用，一个依赖政策与资金。"],
            ["终结信号高度一致", "估值过高、政策转向、增量资金枯竭、盈利无法兑现；A 股另多一条杠杆撤退。"],
            ["崩盘催生制度变革", "制度变革为下一轮牛市提供更健康的基础，但新的金融创新又会创造新的脆弱性。"],
            ["周期呈螺旋演进", "「估值 → 政策 → 资金 → 情绪 → 崩盘 → 制度 → 新估值」，每一轮崩盘都为下一轮创造起点。"],
          ].map(([t, d], i) => (
            <Card key={t} className="flex gap-3 p-3">
              <span className="mt-0.5 shrink-0 font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="text-xs font-bold">{t}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{d}</p>
              </div>
            </Card>
          ))}
        </div>
      </FrameworkSection>

      {/* 页脚：来源与边界 */}
      <Card className="p-4">
        <p className="mb-2 text-xs font-bold">数据来源与内容边界</p>
        <ul className="space-y-1 text-[11px] leading-relaxed text-muted">
          <li>· <span className="text-foreground">复算数据</span>：{meta.source}；由 <code className="font-mono text-primary">{meta.generatedFrom}</code> 生成，口径见页首声明，可完整复现。</li>
          <li>· <span className="text-foreground">美股长历史数据</span>：本站暂无 1929 年以来的可信日线序列，因此<span className="text-foreground">不列示美股具体数值</span>，仅呈现机制框架。</li>
          <li>· <span className="text-foreground">研究框架部分</span>（三～六）为分析观点，非本站复算结果，已与数据区以视觉方式区分。</li>
          <li>· 本页不构成任何投资建议。</li>
        </ul>
      </Card>
    </div>
  );
}
