import Link from "next/link";
import BoardTabs from "@/components/BoardTabs";
import { KonratiefWaves, MerrillClock, CrisisTab } from "./tabs-lazy";
import KonratiefWaveChart from "@/components/history/KonratiefWaveChart";
import { Card, SectionTitle, Badge } from "@/components/ui";
import { HISTORY_EVENTS } from "@/lib/data/history";

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

/*
 * 「历史时间线」tab 已移除。
 *
 * 移除原因：它与「牛熊周期 / 康波全景」不构成递进关系，而是同一批事件的另一种排版，
 * 且筛选状态只体现在 URL 上、无法分享复用，属于信息架构冗余。
 *
 * 注意：/history/[slug] 详情页**保留**。sitemap 收录了数千条该路由，
 * 一并下线会让这些已收录 URL 变成死链。数据源 lib/data/history.ts 与
 * data/history-events.json 也保留 —— 详情页与 sitemap 仍在读。
 */
const TABS = [
  { key: "bullbear", label: "牛熊周期" },
  { key: "waves", label: "康波全景" },
];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  await bootstrap();
  const agg = await getRecentAggregated();
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "bullbear";
  const featured = HISTORY_EVENTS.filter((e) => e.featured).length;
  const lessons = HISTORY_EVENTS.filter((e) => e.lesson).length;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">历史演进</h1>
        <p className="text-sm text-muted mt-1">
          从美索不达米亚到 ChatGPT：{HISTORY_EVENTS.length} 条全球历史事件（中/西/亚/非/美/大洋洲）·
          {featured} 条精选（含 {lessons} 条「对今日启示」）。
        </p>
        {/*
          演进脉络导览：剩下的两个 tab 是「由短周期到长周期」的递进关系，
          原先没有说明，用户容易把它们当作两块并列内容。这里显式串起因果链。
        */}
        <ol className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <li className="rounded-lg border border-border bg-card px-3 py-2">
            <Link href="/history?tab=bullbear" className="font-bold text-primary hover:underline">
              ① 牛熊周期（数月至数年）
            </Link>
            <p className="mt-1 leading-relaxed text-muted">
              最短的循环。A 股 21 轮牛熊的真实涨跌、估值与情绪量化，以及历次危机的完整回放与修复过程。
            </p>
          </li>
          <li className="rounded-lg border border-border bg-card px-3 py-2">
            <Link href="/history?tab=waves" className="font-bold text-primary hover:underline">
              ② 康波周期（约 50–60 年）
            </Link>
            <p className="mt-1 leading-relaxed text-muted">
              牛熊背后的技术革命长波。六波技术周期、周期嵌套结构、各阶段大类资产表现，以及当前位置判断。
            </p>
          </li>
        </ol>
      </header>

      <BoardTabs tabs={TABS} active={active} />

      {/*
        牛熊周期（默认 tab）——定位为「概览」。
        原先此处渲染的是 BullBearCompare，而 /analysis/bullbear 第四节渲染的是同一个组件
        （完全相同的重复）。现按「概览 / 深度」分工，两页不再重复：
          · 本 tab：牛熊全景 K 线（一眼看清 21 轮牛熊形态）+ 危机重演
          · /analysis/bullbear：全维度量化、事件四层拆解、美股对照
          · /analysis/cycle-anatomy：熊市深度与修复时长复算
      */}
      {active === "bullbear" && (
        <div className="space-y-10">
          {/* CrisisTab 自身已包含「牛熊深度对比全景（K线）」与「危机重演」，
              故此处不再单独重复渲染 K 线 */}
          <section>
            <CrisisTab />
          </section>
          <section>
            <Card className="p-4">
              <p className="mb-1 text-sm font-bold">想看更深的？</p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted">
                本页保留概览与危机重演。21 轮牛熊的全维度量化（涨跌幅 / 回撤 / 天量地量 / 估值 / 情绪）、
                每轮关键事件的四层拆解、美股同期对照，以及历次熊市的深度与修复时长复算，分别见：
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/analysis/bullbear"
                  className="rounded-md border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/15"
                >
                  牛熊深度分析 · 量化与事件拆解 →
                </Link>
                <Link
                  href="/analysis/cycle-anatomy"
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary/50 hover:text-primary"
                >
                  周期解剖 · 熊市深度与修复时长 →
                </Link>
              </div>
            </Card>
          </section>
        </div>
      )}

      {active === "waves" && (
        <div className="space-y-10">
          {/* 原先「康波长波·形象可视化」与「康波六波全景对照」是两节，实为同一主题的
              「总览曲线」与「逐波细读」，合并为一节，脉络更连贯 */}
          <section>
            <SectionTitle
              title="康波六波全景"
              sub="1782—2040 六波技术革命的生命周期曲线（回升 → 繁荣 → 衰退 → 萧条），红色标记经典危机坐标；下方逐波展开技术革命、主导产业、核心国家与中国同期"
            />
            <Card className="p-4">
              <KonratiefWaveChart waves={konratief.waves} />
            </Card>
            <div className="mt-4">
              <KonratiefWaves waves={konratief.waves} />
            </div>
          </section>
          <section>
            <SectionTitle title="四大周期框架" sub="周期嵌套：康波含库兹涅茨，库兹涅茨含朱格拉，朱格拉含基钦。各自所处阶段的综合判断见下方「当前位置」一节" />
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
                    <p className="text-xs text-muted">观察信号：{c.signal}</p>
                  </div>
                </Card>
              ))}
            </div>
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
            <SectionTitle title="当前位置与启示" sub="周期叠加视角的当前位置判断与行动建议（仅供参考，不构成投资建议）" />
            <Card className="p-6">
              <p className="text-base leading-relaxed">{CURRENT_POSITION.summary}</p>
              <div className="mt-4 space-y-2">
                {CURRENT_POSITION.evidence.map((e, i) => (
                  <p key={i} className="text-sm text-muted flex gap-2"><span className="text-primary font-bold">{i + 1}.</span>{e}</p>
                ))}
              </div>
            </Card>
            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-3 text-sm font-bold">启示与建议</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CURRENT_POSITION.insights.map((ins) => (
                <Card key={ins.title} className="p-5 border-l-4 border-l-primary">
                  <h3 className="font-bold mb-2">{ins.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{ins.body}</p>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}