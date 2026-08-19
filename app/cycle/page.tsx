import Link from "next/link";
import { CYCLE_TYPES, MILESTONES, CURRENT_POSITION } from "@/lib/data/cycles";
import { Card, Badge, SectionTitle } from "@/components/ui";
import MerrillClock from "@/components/MerrillClock";
import { getRecentAggregated } from "@/lib/data/queries";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "周期洞察 · 康波周期" };

const WAVES = [
  { no: "第一波", years: "1782—1845", tech: "蒸汽机 · 棉纺织", phase: "英国工业革命" },
  { no: "第二波", years: "1845—1892", tech: "铁路 · 钢铁", phase: "重工业化时代" },
  { no: "第三波", years: "1892—1948", tech: "电力 · 化工 · 内燃机", phase: "电气化时代" },
  { no: "第四波", years: "1948—1991", tech: "汽车 · 家电 · 电子", phase: "大众消费时代" },
  { no: "第五波", years: "1991—2040s?", tech: "信息技术 · 互联网", phase: "信息时代（当前正处于尾声）" },
  { no: "第六波", years: "孕育中", tech: "AI · 新能源 · 生物科技", phase: "智能时代（导入期）" },
];

const TYPE_TONE: Record<string, string> = {
  泡沫破裂: "purple", 金融危机: "red", 股市崩盘: "red", 供给冲击: "green",
  债务危机: "amber", 政策冲击: "blue", 黑天鹅: "gray",
};

export default async function CyclePage() {
  await bootstrap();
  const agg = await getRecentAggregated();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-10">
      <header>
        <h1 className="text-2xl font-bold">周期洞察 · 康波周期</h1>
        <p className="text-sm text-muted mt-1">
          用康德拉季耶夫长波、库兹涅茨、朱格拉与基钦四大周期，回放古今中外的著名经济数据，
          判断我们站在周期的哪个位置，并给出启示与建议。{" "}
          <Link href="/history" className="text-primary hover:underline">配合历史事件库使用 →</Link>
        </p>
      </header>

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
        <SectionTitle title="康波五轮历史回顾" sub="技术革命驱动的主导产业更替，每轮 50—60 年" />
        <div className="space-y-3">
          {WAVES.map((w) => (
            <Card key={w.no} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-3 md:w-64 shrink-0">
                <Badge tone={w.no === "第六波" ? "amber" : "red"}>{w.no}</Badge>
                <span className="font-mono text-sm text-muted">{w.years}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{w.tech}</p>
                <p className="text-sm text-muted">{w.phase}</p>
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
        <SectionTitle title="古今中外 · 周期事件时间线" sub="从 1637 郁金香到 2023 银行危机：周期从未消失" />
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
  );
}