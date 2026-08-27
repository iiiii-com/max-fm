import Link from "next/link";
import BoardTabs from "@/components/BoardTabs";
import HistoryAxis from "@/components/HistoryAxis";
import BullBearCompare from "@/components/BullBearCompare";
import { KonratiefWaves, DynastyTable, MerrillClock, CrisisTab } from "./tabs-lazy";
import TimelineSearch from "@/components/history/TimelineSearch";
import { Card, SectionTitle, Badge } from "@/components/ui";
import {
  filterHistory, HISTORY_EVENTS, REGIONS, HISTORY_CATEGORIES, ERAS, eraOf, REGION_LABEL,
} from "@/lib/data/history";

import { CYCLE_TYPES, MILESTONES, CURRENT_POSITION } from "@/lib/data/cycles";
import { getRecentAggregated } from "@/lib/data/queries";
import { bootstrap } from "@/lib/db";
import konratief from "@/data/konratief.json";

export const dynamic = "force-dynamic";
export const metadata = { title: "全球历史回顾" };

const TYPE_TONE: Record<string, string> = {
  泡沫破裂: "purple", 金融危机: "red", 股市崩盘: "red", 供给冲击: "green",
  债务危机: "amber", 政策冲击: "blue", 黑天鹅: "gray",
};

const TABS = [
  { key: "timeline", label: "时间线" },
  { key: "crisis", label: "牛熊重演" },
  { key: "waves", label: "康波全景" },
  { key: "dynasties", label: "朝代对照" },
];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; region?: string; cat?: string; era?: string }> }) {
  const { tab, region = "all", cat = "全部", era = "all" } = await searchParams;
  await bootstrap();
  const agg = await getRecentAggregated();
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "timeline";
  const events = filterHistory({ region, cat, era });
  const regionLabel = region === "all" ? "全部地区" : (REGION_LABEL[region] ?? region);
  const eraLabel = era === "all" ? "全部时代" : (ERAS.find((x) => x.key === era)?.label ?? era);
  const chips = [
    { key: "all", label: "全部地区" },
    ...REGIONS.filter((x) => x.key !== "all").map((x) => ({ key: x.key, label: x.label })),
  ];
  const featured = HISTORY_EVENTS.filter((e) => e.featured).length;
  const lessons = HISTORY_EVENTS.filter((e) => e.lesson).length;
  const axisEvents = region === "all" && cat === "全部" && era === "all"
    ? HISTORY_EVENTS.filter((e) => e.featured)
    : events;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">全球历史回顾</h1>
        <p className="text-sm text-muted mt-1">
          从美索不达米亚到 ChatGPT：{HISTORY_EVENTS.length} 条全球历史事件（中/西/亚/非/美/大洋洲）·
          {featured} 条精选（含 {lessons} 条"对今日启示"）· 按康波波次标注。
          横向时间轴默认展示精选事件，点击散点展开详情。
        </p>
      </header>

      <BoardTabs tabs={TABS} active={active} />

      {active === "timeline" && (
        <section>
          <div className="mb-3">
            <TimelineSearch />
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {chips.map((c) => (
              <Link
                key={c.key}
                href={`/history?region=${c.key}&cat=${encodeURIComponent(cat)}&era=${era}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  region === c.key ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {c.label}
              </Link>
            ))}
            <span className="w-px bg-border mx-1" />
            {["全部", ...HISTORY_CATEGORIES].map((c) => (
              <Link
                key={c}
                href={`/history?region=${region}&cat=${encodeURIComponent(c)}&era=${era}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  cat === c ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {c === "全部" ? "全部类型" : c}
              </Link>
            ))}
            <span className="w-px bg-border mx-1" />
            {[{ key: "all", label: "全部时代" }, ...ERAS].map((e2) => (
              <Link
                key={e2.key}
                href={`/history?region=${region}&cat=${encodeURIComponent(cat)}&era=${e2.key}`}
                title={"range" in e2 ? e2.range : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  era === e2.key ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {e2.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted mb-4">
            当前：{regionLabel} · {cat} · {eraLabel} · 共 {axisEvents.length} 条
            {region === "all" && cat === "全部" && era === "all" ? "（默认仅精选，筛选后展示全部）" : "（筛选模式下展示全部事件）"}
          </p>
          <Card className="p-5">
            <HistoryAxis events={axisEvents} />
          </Card>
          {!axisEvents.length && <p className="text-sm text-muted">该筛选条件下暂无事件</p>}

          {/* A 股历轮牛熊深度对比 */}
          <section className="mt-8">
            <SectionTitle
              title="A 股历轮牛熊 · 深度对比"
              sub="基于上证综指 1990-2026 真实历史行情 · 21 轮牛熊的涨跌幅 / 回撤 / 天量地量 / 估值 / 情绪全维度量化对比"
            />
            <BullBearCompare />
          </section>
        </section>
      )}

      {active === "crisis" && (
        <section>
          <CrisisTab />
        </section>
      )}

      {active === "waves" && (
        <div className="space-y-10">
          <section>
            <SectionTitle title="四大周期框架" sub="周期嵌套：康波含库兹涅茨，库兹涅茨含朱格拉，朱格拉含基钦" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CYCLE_TYPES.map((c) => (
                <Card key={c.name} className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <Badge tone="gray">{c.alias}</Badge>
                  </div>
                  <div className="text-sm space-y-2">
                    <p><span className="text-muted">周期长度：</span>{c.length}</p>
                    <p><span className="text-muted">驱动力量：</span>{c.driver}</p>
                    <p><span className="text-muted">阶段循环：</span>{c.phase}</p>
                    <p className="border-t border-border pt-2"><span className="text-muted">当前位置：</span><b>{c.current}</b></p>
                    <p className="text-xs text-muted">观察信号：{c.signal}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="康波六波全景对照" sub="每波含技术革命、主导产业、核心国家、关键里程碑与中国同期，点击卡片展开详情" />
            <KonratiefWaves waves={konratief.waves} />
          </section>

          <section>
            <SectionTitle title="美林投资时钟" sub={`以真实宏观数据定位当前阶段（GDP ${agg.latestGdp}% · CPI ${agg.latestCpi}%）`} />
            <Card>
              <MerrillClock growth={agg.latestGdp} inflation={agg.latestCpi} />
            </Card>
          </section>

          <section>
            <SectionTitle title="危机里程碑" sub="从 1637 郁金香到 2023 银行危机：标注历史上重大危机时点" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MILESTONES.map((m) => (
                <Card key={m.year} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono font-bold text-lg">{m.year}</span>
                    <Badge tone={(TYPE_TONE[m.type] ?? "gray") as any}>{m.type}</Badge>
                  </div>
                  <p className="font-semibold text-sm leading-snug">{m.title}</p>
                  <p className="text-xs text-muted mt-1">{m.cycle}</p>
                  <p className="text-xs text-muted mt-2 leading-relaxed">{m.note}</p>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="康波各阶段 · 大类资产表现" sub="四阶段循环下的历史统计规律（仅供参考，不构成投资建议）" />
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="py-3 pl-4 pr-4 font-medium">阶段</th>
                    <th className="py-3 pr-4 font-medium">经济特征</th>
                    <th className="py-3 px-3 font-medium text-center">股票</th>
                    <th className="py-3 px-3 font-medium text-center">债券</th>
                    <th className="py-3 px-3 font-medium text-center">黄金</th>
                    <th className="py-3 px-3 font-medium text-center">大宗商品</th>
                    <th className="py-3 pr-4 pl-3 font-medium text-center">现金</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { phase: "回升期", note: "新技术导入，产能与需求共振，利润率修复", s: "强", b: "中性", g: "弱", c: "弱", cash: "弱" },
                    { phase: "繁荣期", note: "投资过热，通胀抬头，利率中枢上行", s: "强", b: "弱", g: "弱", c: "强", cash: "弱" },
                    { phase: "滞胀期", note: "成本推动通胀，增长停滞，股债双杀", s: "弱", b: "弱", g: "强", c: "强", cash: "强" },
                    { phase: "衰退期", note: "需求塌缩，利率下行，避险主导", s: "弱", b: "强", g: "中性", c: "弱", cash: "中性" },
                  ].map((r) => (
                    <tr key={r.phase} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pl-4 pr-4 font-semibold whitespace-nowrap">{r.phase}</td>
                      <td className="py-3 pr-4 text-xs text-muted leading-relaxed">{r.note}</td>
                      {[r.s, r.b, r.g, r.c, r.cash].map((v, i) => (
                        <td key={i} className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${v === "强" ? "bg-red-100 text-red-600" : v === "弱" ? "bg-green-100 text-green-600" : "bg-border/40 text-muted"}`}>
                            {v === "强" ? "↑" : v === "弱" ? "↓" : "—"}
                          </span>
                          <span className="hidden">{v}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-muted px-4 py-3 border-t border-border">
                注：此表为 1920 年以来主要经济体各阶段资产相对收益的统计规律；周期位置模糊时（如当前康波尾声 + 第六波导入期叠加），资产表现可能出现阶段特征混合。
              </p>
            </Card>
          </section>

          <section>
            <SectionTitle
              title="A 股历轮牛熊 · 深度对比"
              sub="基于上证综指 1990-2026 真实历史行情 · 21 轮牛熊的涨跌幅 / 回撤 / 天量地量 / 估值 / 情绪全维度量化对比"
            />
            <BullBearCompare />
          </section>

          <section>
            <SectionTitle title="我们站在哪里？" sub="周期叠加视角的当前位置判断（仅供参考，不构成投资建议）" />
            <Card className="p-6">
              <p className="text-base leading-relaxed">{CURRENT_POSITION.summary}</p>
              <div className="mt-4 space-y-2">
                {CURRENT_POSITION.evidence.map((e, i) => (
                  <p key={i} className="text-sm text-muted flex gap-2"><span className="text-primary font-bold">{i + 1}.</span>{e}</p>
                ))}
              </div>
            </Card>
          </section>
          <section>
            <SectionTitle title="启示与建议" sub="以史为鉴：把历史的教训翻译成今天的行动" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CURRENT_POSITION.insights.map((ins) => (
                <Card key={ins.title} className="p-5 border-l-4 border-l-primary">
                  <h3 className="font-bold mb-2">{ins.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{ins.body}</p>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}

      {active === "dynasties" && (
        <section>
          <SectionTitle title="康波 × 王朝周期 · 千年尺度对照" sub="中国历代王朝兴衰与康波长波的嵌套关系：王朝 ≈ 300 年，康波 ≈ 50—60 年" />
          <Card className="p-4">
            <DynastyTable dynasties={konratief.dynasties} />
          </Card>
        </section>
      )}
    </div>
  );
}