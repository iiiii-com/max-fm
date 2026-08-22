import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";
import BullBearKline from "@/components/crisis/BullBearKline";
import BullBearEvents from "@/components/crisis/BullBearEvents";
import BullBearCompare from "@/components/BullBearCompare";
import UsMarketKline from "@/components/analysis/UsMarketKline";

export const metadata = { title: "牛熊深度分析报告 · 中美对比" };

/** 事件四层拆解数据 */
const EVENTS = [
  {
    id: "szw",
    title: "2008 年“四万亿”刺激",
    date: "2008-11-09",
    cycle: "熊6→牛7",
    dir: "up",
    type: "财政政策",
    what: "国务院常务会议决定实施四万亿投资计划（铁路/公路/基建/灾后重建），配套央行连续降息降准，一年期贷款基准利率从 7.47% 降至 5.31%。",
    why: "2008 年 Q3 GDP 增速骤降至 9%（上半年 10.4%），出口同比转负，PPI 快速回落，通缩风险显现；稳增长成为压倒性政策目标。",
    how: "财政投放 → 基建链订单 → 信贷脉冲（2009 年新增贷款 9.6 万亿，为 2008 年 2 倍）→ 上游周期品涨价 → 上证 1664 见底后 9 个月反弹 96%。",
    impact: "上证 1664.93→3478（+109%）；煤炭/有色/建材领涨（申万煤炭 2009 年 +164%），创业板 2010 年开市补涨；副作用是 2010-2011 通胀与产能过剩。",
    stats: { 上证涨幅: "+96%", 信贷脉冲: "9.6万亿", 煤炭涨幅: "+164%", 持续: "9个月" },
  },
  {
    id: "pgc",
    title: "2015 年清理场外配资",
    date: "2015-06-12",
    cycle: "牛8→熊8",
    dir: "down",
    type: "金融监管",
    what: "证监会要求券商自查清理场外配资（伞形信托/HOMS 系统），两融余额峰值 2.27 万亿、场外配资估算 1.5-2 万亿同步去杠杆。",
    why: "2014-2015 杠杆牛：上证 1849→5178（+180%），中小创市盈率超 80 倍，融资盘占比过高，监管层担忧系统性风险。",
    how: "配资强平 → 杠杆资金踩踏 → 千股跌停 → 流动性危机 → 国家队入场救市（证金公司 2 万亿）→ 2016 熔断二次探底。",
    impact: "上证 5178→2638（-49%）；创业板指同期 -55%；两融余额从 2.27 万亿降至 9000 亿；教训：杠杆牛的终结必然伴随流动性踩踏。",
    stats: { 上证回撤: "-49%", 两融峰值: "2.27万亿", 创业板回撤: "-55%", 持续: "7个月" },
  },
  {
    id: "zngz",
    title: "2018 年资管新规与贸易摩擦",
    date: "2018-04-27",
    cycle: "牛9→熊9",
    dir: "down",
    type: "监管+外部",
    what: "资管新规正式落地（打破刚兑/去嵌套/降杠杆），叠加 3 月美国对华加征关税，2018 全年 A 股单边下行。",
    why: "宏观上金融去杠杆（社融增速 2017-2018 从 13% 降至 10%）、贸易摩擦冲击出口预期；市场处于 2017 白马牛市后的高估值消化期。",
    how: "资管新规 → 表外融资收缩 → 股权质押爆仓风险 → 民企信用危机；贸易摩擦 → 风险偏好骤降 → 北向资金月度净流出。",
    impact: "上证 3587→2440（-32%）；申万全行业 2018 年除银行外全线下跌，电子/传媒跌幅超 -40%；2019-01 政策底出现（降准）。",
    stats: { 上证回撤: "-32%", 社融增速: "13%→10%", 电子板块: "-40%+", 持续: "11个月" },
  },
  {
    id: "yq",
    title: "2020 年疫情后宽货币",
    date: "2020-02-03",
    cycle: "牛10",
    dir: "up",
    type: "货币政策",
    what: "疫情冲击后央行实施“宽货币+宽信用”：2020 年降准 3 次、MLF/LPR 连续下调，M2 增速重回 11%，社融脉冲式放量。",
    why: "2020 年 Q1 GDP 同比 -6.8%（有记录以来首次负增长），疫情隔离冻结消费与生产，亟需流动性托底。",
    how: "降准降息 → 流动性宽松 → 公募基金发行放量（2020 全年 3.1 万亿）→ 核心资产（白酒/医药/新能源）估值抬升 → 机构抱团行情。",
    impact: "上证 2440→3731（+53%）；创业板指 +108%（2020-2021）；茅指数 2021-02 见顶后回调 -40%，抱团瓦解。",
    stats: { 上证涨幅: "+53%", 基金发行: "3.1万亿", 创业板涨幅: "+108%", 持续: "24个月" },
  },
  {
    id: "jxx",
    title: "2022 年美联储加息周期",
    date: "2022-03-17",
    cycle: "熊10",
    dir: "down",
    type: "外部+宏观",
    what: "美联储为压制 40 年最高通胀（CPI 峰值 9.1%）开启激进加息，全年累计加息 425bp（7 次），并启动缩表。",
    why: "美国通胀失控 + 国内地产暴雷（恒大/融创）、互联网监管，中美利差倒挂引发外资流出 A 股。",
    how: "美债利率飙升 → 全球风险资产估值承压 → 北向资金全年净流出（2022 年 890 亿）→ 高估值成长股杀估值 → A 股核心资产继续回调。",
    impact: "上证 3731→2635（-29%）；纳指 2022 年 -33%；宁德时代等赛道股腰斩；2023-2024 市场进入磨底期。",
    stats: { 上证回撤: "-29%", 加息幅度: "425bp", 北向流出: "890亿", 持续: "22个月" },
  },
];

/** 美股对比五维数据 */
const COMPARE_DIMS = [
  {
    dim: "估值水平",
    cn: "上证 PE 区间 10-60 倍波动（2013 底 10 倍 / 2007 顶 60 倍），估值弹性极大，流动性驱动占比高",
    us: "标普 PE 长期 12-25 倍中枢（2020 底 15 倍 / 2021 顶 27 倍），盈利驱动为主，估值波动更收敛",
    lesson: "美股因盈利持续增长，估值消化靠时间；A 股牛市常透支多年盈利，估值消化靠深度回调",
  },
  {
    dim: "波动率",
    cn: "上证年化波动率约 25-30%，熊市最大回撤 50-70%，急涨急跌、牛短熊长",
    us: "标普年化波动率约 15-18%，2008 回撤 -57% 为极端值，整体回撤浅、修复快",
    lesson: "A 股需更严格的仓位纪律与止损；美股可承受更高仓位但需防黑天鹅（2008/2020）",
  },
  {
    dim: "政策工具",
    cn: "工具丰富：降准/LPR/MLF/专项债/国家队入场，传导直接但易形成政策依赖",
    us: "美联储工具：降息/QE/缩表/前瞻指引，传导经利率-信用-风险资产链条，时滞更明显",
    lesson: "A 股政策底常领先市场底 1-3 个月（2019/2024）；美股政策底与市场底常同步（2020）",
  },
  {
    dim: "投资者结构",
    cn: "散户占比高（自由流通市值 60%+），换手率 300-500%，情绪化定价，牛熊斜率陡峭",
    us: "机构化（共同基金/养老金/被动 ETF 占比 70%+），换手率约 100%，定价更理性",
    lesson: "A 股应避免追涨杀跌、重视逆向；美股适合长期持有与定投",
  },
  {
    dim: "市场有效性",
    cn: "涨跌停/T+1/IPO 核准制下政策干预频繁，信息传导慢，定价效率偏低",
    us: "做空机制完善、衍生品丰富、注册制+退市常态化，定价效率高，政策干预少",
    lesson: "A 股需重视制度套利与政策周期；美股可更多依赖基本面与技术面",
  },
];

/** 关键指标对比表 */
const KEY_METRICS = [
  { item: "最大牛市涨幅", cn: "6124/998 = +513%（2005-2007）", us: "标普 2009-2021 约 +600%" },
  { item: "最大熊市回撤", cn: "6124→1664 = -72.8%（2007-2008）", us: "标普 2007-2009 = -56.8%" },
  { item: "牛熊平均周期", cn: "牛市约 22 个月 / 熊市约 22 个月", us: "牛市约 60 个月 / 熊市约 12 个月" },
  { item: "年化波动率", cn: "约 25-30%", us: "约 15-18%" },
  { item: "PE 区间（近20年）", cn: "上证 10-60 倍", us: "标普 12-27 倍" },
  { item: "散户占比", cn: "自由流通市值约 60%+", us: "机构约 70%+" },
  { item: "交易制度", cn: "T+1 / 涨跌停 10-20%", us: "T+0 / 无涨跌幅限制" },
  { item: "IPO 制度", cn: "注册制（2023 全面推行）", us: "注册制 + 退市常态化" },
];

const DIR_META: Record<string, { label: string; cls: string }> = {
  up: { label: "利好/反弹", cls: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" },
  down: { label: "利空/回调", cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" },
};

export default function BullBearReport() {
  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <div className="flex items-center gap-2 text-sm text-muted mb-2">
          <Link href="/history?tab=crisis" className="hover:text-primary">← 牛熊重演</Link>
          <span>/</span>
          <span>深度分析报告</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">
          中国牛熊关键事件 · 深度解读与美股对比分析
        </h1>
        <p className="text-sm text-muted mt-2 max-w-4xl leading-relaxed">
          基于上证综指 1990-2026 真实历史行情（8536 个交易日）与标普500/纳指公开历史数据，按
          「事件—成因—传导—影响」四层框架拆解 A 股历轮牛熊标志性事件，并从估值、波动率、政策工具、
          投资者结构、市场有效性五个维度与美股对照，全部数据可追溯、可核查。
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge>事件四层拆解</Badge>
          <Badge tone="blue">美股五维对比</Badge>
          <Badge tone="amber">真实行情数据</Badge>
          <Badge tone="gray">技术指标可组合</Badge>
        </div>
      </header>

      {/* 一、A 股 / 美股 K 线对比 */}
      <section>
        <SectionTitle
          title="一、A 股与美股 K 线对比（技术指标可自由组合）"
          sub="上证综指日/月K 全量真实数据 · 标普500/纳指年度K线 · MA/MACD/BOLL/KDJ/RSI 可勾选叠加 · 事件标注统一虚线样式"
        />
        <div className="space-y-6">
          <BullBearKline />
          <UsMarketKline />
        </div>
      </section>

      {/* 二、A 股牛熊关键事件深度解读 */}
      <section>
        <SectionTitle
          title="二、A 股牛熊关键事件 · 四层深度拆解"
          sub="「发生了什么 → 为何发生 → 如何传导 → 市场影响路径」逐层递进，关键事件与 K 线标注严格对应（判定标准：政策发布/事件发生日映射到最近交易日）"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EVENTS.map((ev) => {
            const dm = DIR_META[ev.dir];
            return (
              <Card key={ev.id} className="p-5 border-l-4 border-l-primary flex flex-col">
                <div className="flex items-start gap-2 mb-3 flex-wrap">
                  <span className="font-mono text-xs font-bold text-primary whitespace-nowrap">{ev.date}</span>
                  <h3 className="font-bold leading-snug flex-1">{ev.title}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${dm.cls}`}>{dm.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge tone="gray">{ev.cycle}</Badge>
                  <Badge tone="blue">{ev.type}</Badge>
                </div>
                <div className="space-y-3 text-sm flex-1">
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">① 发生了什么</p>
                    <p className="text-[13px] leading-relaxed">{ev.what}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">② 为何发生</p>
                    <p className="text-[13px] leading-relaxed text-muted">{ev.why}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">③ 如何传导</p>
                    <p className="text-[13px] leading-relaxed border-l-2 border-primary/30 pl-3">{ev.how}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">④ 市场影响路径</p>
                    <p className="text-[13px] leading-relaxed text-muted">{ev.impact}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-4 gap-2">
                  {Object.entries(ev.stats).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <p className="text-[10px] text-muted">{k}</p>
                      <p className="text-sm font-bold font-mono">{v}</p>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 三、美股同期对比 */}
      <section>
        <SectionTitle
          title="三、美股同期对比 · 五维深度对照"
          sub="估值 / 波动率 / 政策工具 / 投资者结构 / 市场有效性——每维对比后给出可借鉴经验与差异根源"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPARE_DIMS.map((c) => (
            <Card key={c.dim} className="p-5 flex flex-col">
              <h3 className="font-bold mb-3 text-primary">{c.dim}</h3>
              <div className="space-y-3 text-[13px] flex-1">
                <div>
                  <p className="text-xs font-semibold text-red-500 mb-0.5">🇨🇳 A 股</p>
                  <p className="text-muted leading-relaxed">{c.cn}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-500 mb-0.5">🇺🇸 美股</p>
                  <p className="text-muted leading-relaxed">{c.us}</p>
                </div>
              </div>
              <p className="text-xs mt-3 pt-3 border-t border-border leading-relaxed">
                <span className="font-semibold">可借鉴：</span>{c.lesson}
              </p>
            </Card>
          ))}
        </div>

        {/* 关键指标汇总表 */}
        <Card className="mt-4 overflow-x-auto">
          <h3 className="font-bold text-sm px-4 py-3 border-b border-border">A 股 vs 美股 · 关键指标对比汇总</h3>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pl-4 pr-3 font-medium">指标</th>
                <th className="text-left px-3 font-medium text-red-600">A 股（上证综指）</th>
                <th className="text-left px-3 font-medium text-blue-600">美股（标普500）</th>
              </tr>
            </thead>
            <tbody>
              {KEY_METRICS.map((r) => (
                <tr key={r.item} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pl-4 pr-3 font-medium whitespace-nowrap">{r.item}</td>
                  <td className="py-2.5 px-3 text-muted">{r.cn}</td>
                  <td className="py-2.5 px-3 text-muted">{r.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* 四、牛熊全景与事件卡片 */}
      <section>
        <SectionTitle
          title="四、牛熊全景 · 全维度量化"
          sub="21 轮牛熊的涨跌幅 / 回撤 / 天量地量 / 估值 / 情绪对比 + 每轮关键事件卡片（点击展开深度解读）"
        />
        <div className="space-y-6">
          <BullBearEvents />
          <BullBearCompare />
        </div>
      </section>

      {/* 五、数据来源与口径 */}
      <section>
        <SectionTitle title="数据来源与统计口径" sub="全部数据可追溯，标注来源与统计区间" />
        <Card className="p-5">
          <ul className="text-xs text-muted space-y-2 list-disc pl-5">
            <li>A 股行情：腾讯财经 fqkline 历史日线接口，上证综指 1990-12-19 至 2026-08-21 共 8536 个交易日，本地缓存于 data/sh-index.json。</li>
            <li>牛熊周期划分：基于上证综指历史高低点（998.23/6124.04/1664.93/5178.19/2440.91/2635.09 等，与公开历史一致），21 轮牛熊的涨跌幅/回撤/天量地量由真实行情计算。</li>
            <li>美股数据：标普500/纳指年度 OHLC 为公开历史行情（雅虎财经/标准普尔官方口径），2025 年标普收盘为腾讯接口实测值，纳指 2025 未确证故不展示。</li>
            <li>估值区间：中证指数有限公司发布的上证综指历史 PE 区间及公开统计（2005-06 PE≈16、2007-10 PE≈55-60、2013-06 PE≈10、2024-02 PE≈11）。</li>
            <li>两融/北向/基金发行：沪深交易所与基金业协会公开披露（2015-06 两融峰值 2.27 万亿、2020 公募发行 3.1 万亿、2022 北向净流出 890 亿）。</li>
            <li>事件标注判定标准：事件标注一律采用「实际发布/发生日 → 最近交易日」映射（节假日向前对齐），确保与 K 线时间坐标精确对齐。</li>
            <li>免责声明：本报告为历史数据研究，不构成投资建议；历史规律不代表未来表现。</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
