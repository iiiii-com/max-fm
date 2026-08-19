import Link from "next/link";
import { getIndicators, getArticles } from "@/lib/data/queries";
import { SectionTitle, Card, Badge, AIFlag } from "@/components/ui";
import { TrendCard } from "@/components/charts/IndicatorLine";
import CompareTool from "@/components/charts/CompareTool";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "宏观经济" };

const r1 = (v: number) => Math.round(v * 100) / 100;

const LEVEL_TYPES = new Set(["pmi", "tsf", "lpr", "fx", "unemp"]);

function yoyOf(s: Array<{ date: string; value: number }>): number | null {
  const last = s[s.length - 1];
  if (!last) return null;
  const m = last.date.match(/^(\d{4})-(\d{2})$/);
  const q = last.date.match(/^(\d{4})-Q(\d)$/);
  const target = m ? `${+m[1] - 1}-${m[2]}` : q ? `${+q[1] - 1}-Q${q[2]}` : null;
  if (!target) return null;
  const row = s.find((x) => x.date === target);
  return row ? r1(last.value - row.value) : null;
}

function momOf(s: Array<{ date: string; value: number }>): number | null {
  if (s.length < 2) return null;
  return r1(s[s.length - 1].value - s[s.length - 2].value);
}

export default async function MacroPage() {
  await bootstrap();
  const [inds, articles] = await Promise.all([getIndicators(), getArticles("monthly")]);
  const series = (type: string) =>
    inds.filter((x: any) => x.type === type).map((x: any) => ({ date: x.date, value: x.value ?? 0 }));
  const latest = (type: string) => {
    const s = series(type);
    return s[s.length - 1]?.value ?? 0;
  };
  const monthly = articles[0];

  const cards = [
    { type: "gdp", title: "GDP 同比增速", unit: "%", color: "#4f46e5" },
    { type: "cpi", title: "CPI 同比", unit: "%", color: "#dc2626" },
    { type: "ppi", title: "PPI 同比", unit: "%", color: "#ea580c" },
    { type: "pmi", title: "制造业 PMI", unit: "", color: "#0891b2" },
    { type: "m2", title: "M2 同比增速", unit: "%", color: "#2563eb" },
    { type: "tsf", title: "社融增量", unit: "万亿", color: "#0d9488" },
    { type: "lpr", title: "1年期 LPR", unit: "%", color: "#6d28d9" },
    { type: "fx", title: "外汇储备", unit: "万亿$", color: "#0e7490" },
    { type: "ind", title: "工业增加值同比", unit: "%", color: "#16a34a" },
    { type: "retail", title: "社零同比", unit: "%", color: "#ea580c" },
    { type: "invest", title: "固定资产投资同比", unit: "%", color: "#9333ea" },
    { type: "realestate", title: "房地产开发投资同比", unit: "%", color: "#b91c1c" },
    { type: "fin", title: "财政收入同比", unit: "%", color: "#15803d" },
    { type: "export", title: "出口同比", unit: "%", color: "#7c3aed" },
    { type: "import", title: "进口同比", unit: "%", color: "#a21caf" },
    { type: "unemp", title: "城镇调查失业率", unit: "%", color: "#ca8a04" },
  ];

  const linkData: Record<string, number> = {
    lpr: latest("lpr"), re: latest("realestate"), m2: latest("m2"), tsf: latest("tsf"),
    ppi: latest("ppi"), ind: latest("ind"), cpi: latest("cpi"), retail: latest("retail"),
    exp: latest("export"), fx: latest("fx"), unemp: latest("unemp"),
  };
  const LINK_DESC: Record<string, (v: Record<string, number>) => string> = {
    "LPR ↔ 房地产": (v) => `1 年期 LPR 当前 ${v.lpr}%，房地产开发投资同比 ${v.re}%。历史规律：LPR 每下调 10bp，按揭利率同步下行，地产销售通常滞后 2-3 个季度企稳，投资降幅随之收窄。`,
    "M2 ↔ 社融": (v) => `M2 同比 ${v.m2}%，当月社融增量 ${v.tsf} 万亿。M2 快于社融（剪刀差为正）时资金淤积金融体系，权益市场往往受益；社融提速则代表实体需求回暖。`,
    "PPI ↔ 工业增加值": (v) => `PPI 同比 ${v.ppi}%，工业增加值同比 ${v.ind}%。PPI 上行期上游涨价带动工业利润扩张，生产端通常跟随改善；PPI 深度为负则企业去库、开工承压。`,
    "CPI ↔ 社零": (v) => `CPI 同比 ${v.cpi}%，社零同比 ${v.retail}%。温和通胀伴随消费回暖；若 CPI 持续为负而社零低迷，往往对应居民收入预期偏弱，需政策发力提振内需。`,
    "出口 ↔ 外汇储备": (v) => `出口同比 ${v.exp}%，外汇储备 ${v.fx} 万亿美元。出口景气度高时结汇需求增加，储备稳中有升、人民币汇率获得支撑；出口转弱则汇率波动加大。`,
    "失业率 ↔ 社零": (v) => `城镇调查失业率 ${v.unemp}%，社零同比 ${v.retail}%。就业与消费强相关：失业率上行往往领先社零走弱 1-2 个季度，反之就业改善带动可选消费率先修复。`,
  };
  const LINK_META = [
    { title: "LPR ↔ 房地产", sub: "利率是地产链的定价之锚", keys: ["lpr", "re"], latest: (v: Record<string, number>) => `${v.lpr}% / ${v.re}%` },
    { title: "M2 ↔ 社融", sub: "货币供给 vs 实体融资需求", keys: ["m2", "tsf"], latest: (v: Record<string, number>) => `${v.m2}% / ${v.tsf}万亿` },
    { title: "PPI ↔ 工业增加值", sub: "价格传导决定工业利润", keys: ["ppi", "ind"], latest: (v: Record<string, number>) => `${v.ppi}% / ${v.ind}%` },
    { title: "CPI ↔ 社零", sub: "物价与消费互为镜像", keys: ["cpi", "retail"], latest: (v: Record<string, number>) => `${v.cpi}% / ${v.retail}%` },
    { title: "出口 ↔ 外汇储备", sub: "外需强弱影响储备与汇率", keys: ["exp", "fx"], latest: (v: Record<string, number>) => `${v.exp}% / ${v.fx}万亿$` },
    { title: "失业率 ↔ 社零", sub: "就业是消费的前置变量", keys: ["unemp", "retail"], latest: (v: Record<string, number>) => `${v.unemp}% / ${v.retail}%` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">宏观经济</h1>
        <p className="text-sm text-muted mt-1">数据来源：国家统计局 / 中国人民银行 / 海关总署 / 财政部</p>
      </header>

      <div className="flex gap-3 flex-wrap">
        <Link href="/macro/feeling" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">宏观温度 vs 个人体感</Link>
        <Link href="/macro#report" className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">AI 月度报告</Link>
        <Link href="/map" className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">区域经济全景</Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => {
          const s = series(c.type);
          const isLevel = LEVEL_TYPES.has(c.type);
          return (
            <TrendCard
              key={c.type}
              title={c.title}
              value={latest(c.type)}
              unit={c.unit}
              color={c.color}
              data={s}
              yoy={isLevel ? null : yoyOf(s)}
              mom={momOf(s)}
            />
          );
        })}
      </section>

      <section>
        <SectionTitle title="指标联动观察" sub="成对指标互相印证，判断经济传导链条的方向" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {LINK_META.map((l) => (
            <Card key={l.title} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">{l.title}</h3>
                <span className="text-xs font-mono text-muted">{l.latest(linkData)}</span>
              </div>
              <p className="text-[11px] text-muted mb-2">{l.sub}</p>
              <p className="text-xs text-muted leading-relaxed">{LINK_DESC[l.title](linkData)}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-3">指标对比</h2>
        <CompareTool indicators={inds} />
      </section>

      <section id="report">
        <SectionTitle title="AI 月度报告" sub="每月自动生成，数据解读 + 趋势研判" extra={<AIFlag />} />
        {monthly ? (
          <Link href={`/article/${monthly.slug}`}>
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <Badge>月度报告</Badge>
                <span className="text-xs text-muted">{fmtDate(monthly.publishDate)}</span>
              </div>
              <h3 className="font-bold text-lg">{monthly.title}</h3>
              <p className="text-sm text-muted mt-1 line-clamp-2">{monthly.summary}</p>
            </Card>
          </Link>
        ) : (
          <Card><p className="text-sm text-muted">月报将在每月 1 日由 AI 自动生成</p></Card>
        )}
      </section>
    </div>
  );
}
