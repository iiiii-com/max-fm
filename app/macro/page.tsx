import Link from "next/link";
import { getIndicators, getTemperatures, getFeelingAggregates, getMacroProvenance } from "@/lib/data/queries";
import { SectionTitle, Card } from "@/components/ui";
import { TrendCard } from "@/components/charts/IndicatorLine";
import MacroIndicatorBoard from "@/components/macro/MacroIndicatorBoard";
import CompareTool from "@/components/charts/CompareTool";
import RiskIndicators from "@/components/RiskIndicators";
import MacroGauges from "@/components/macro/MacroGauges";
import TemperatureBoard from "@/components/macro/TemperatureBoard";
import MonthlyReportCard from "@/components/macro/MonthlyReportCard";
import { MACRO_METRIC_COLORS } from "@/components/charts/palette";
import { MACRO_INDICATORS } from "@/lib/data/macro-indicators";
import { macroTemperatureScores } from "@/lib/data/macro-sync";
import { normalizeIndicatorDate } from "@/lib/utils";
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
  const [inds, temps, feeling, provenance] = await Promise.all([
    getIndicators(),
    getTemperatures(),
    getFeelingAggregates(),
    getMacroProvenance(),
  ]);
  // 日期在此统一归一化：上游季度指标带浮点尾巴（如 2017-Q4.666…），
  // 不清洗会直接渲染到图表 X 轴上。同时保证 latest()/同比环比 的日期匹配仍然自洽。
  const series = (type: string) =>
    inds
      .filter((x: any) => x.type === type)
      .map((x: any) => ({ date: normalizeIndicatorDate(x.date), value: x.value ?? 0 }));
  const seriesTail = (type: string, n = 120) => {
    const s = series(type);
    return s.length > n ? s.slice(-n) : s;
  };
  const latest = (type: string) => {
    const s = series(type);
    return s[s.length - 1]?.value ?? 0;
  };
  // ---- 宏观温度拆解数据（供 TemperatureBoard）--------------------------------
  // 温度按月留存在 macroTemperatures；新版写入 components JSON（原始值/分项得分/权重），
  // 历史 seed 数据的 components 是旧口径（GDP/CPI/PMI…），这里做兼容：
  // 解析失败或字段缺失时，直接用最新 PMI/CPI/M2 按同一公式回算，绝不显示空白仪表。
  const tempRows = ((temps as any[]) ?? []).filter((t) => t && t.date != null);
  const lastTemp = tempRows.length ? tempRows[tempRows.length - 1] : null;
  let tempComp: any = null;
  if (lastTemp?.components) {
    try {
      tempComp = JSON.parse(lastTemp.components);
    } catch {
      tempComp = null;
    }
  }
  const latestNullable = (type: string): number | null => {
    const arr = inds.filter((x: any) => x.type === type && x.value != null);
    return arr.length ? Number(arr[arr.length - 1].value) : null;
  };
  const scoreRaw = { pmi: latestNullable("pmi"), cpi: latestNullable("cpi"), m2: latestNullable("m2") };
  const fallbackScore = macroTemperatureScores(scoreRaw);
  const temperature = lastTemp?.temperature != null ? Number(lastTemp.temperature) : tempComp?.temperature ?? fallbackScore.temperature;
  const temperatureDate = lastTemp?.date != null ? String(lastTemp.date) : null;
  const temperatureRaw = tempComp?.raw ?? scoreRaw;
  const temperatureScores = tempComp?.scores ?? fallbackScore.scores;
  const temperatureSeries = tempRows.slice(-12).map((t: any) => ({
    date: String(t.date),
    temperature: Math.round(Number(t.temperature) * 10) / 10,
  }));
  const feelingOverall = (feeling as any)?.overall != null ? Number((feeling as any).overall) : null;
  const feelingSample = Number((feeling as any)?.sampleCount ?? 0);
  const feelingDiff =
    temperature != null && feelingOverall != null && feelingSample > 0
      ? Math.round((temperature - feelingOverall) * 10) / 10
      : null;

  // 指标清单来自站内唯一事实来源 lib/data/macro-indicators.ts：
  // 单位与「同比/环比变动单位」此前在本文件另抄一份，导致利率变动被标成「个百分点」、
  // 金价同比被标成「+171.1 个百分点」。现在两者共用同一份定义。
  //
  // source 取库内实际来源（provenance.byType），而不是 MACRO_INDICATORS 里的声明：
  // 目前只有 14 项换成了真实序列，其余 10 项仍是种子数据，若沿用声明就会
  // 让「示例数据」在卡片上被标成「东方财富数据中心」，属于数据血统造假。
  const cards = MACRO_INDICATORS.map((c) => {
    const prov = provenance.byType[c.type];
    const synced = prov?.synced ?? false;
    return {
      ...c,
      color: MACRO_METRIC_COLORS[c.type] ?? "#171717",
      source: synced ? c.source : "示例数据（未同步真实报表）",
    };
  });

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

  const macroSynced = provenance.total > 0 && provenance.synced > 0;
  const macroFullySynced = provenance.total > 0 && provenance.seed === 0;
  // updatedAt 存的是 Date.now() 毫秒；这里按北京时间展示「最近同步时间」。
  const lastSyncText = provenance.lastSyncedAt
    ? new Date(provenance.lastSyncedAt + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ")
    : null;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">宏观经济</h1>
        <p className="text-sm text-muted mt-1">
          真实序列来源：东方财富数据中心（GDP / CPI / PPI / PMI / M1 / M2 / 税收 / 进出口 / 固投 / 新增贷款 / 70城房价）、
          新浪财经行情接口（离岸人民币 / 伦敦金现货）
        </p>
        {!macroSynced ? (
          <p
            className="text-xs mt-1 rounded-md border px-3 py-2 leading-relaxed"
            style={{ borderColor: "#d97706", background: "rgba(217,119,6,0.10)", color: "#b45309" }}
          >
            ⚠ 当前库中的宏观指标序列（共 {provenance.total} 行）来自 <b>种子/示例数据</b>（scripts/seed.ts 生成），
            尚未完成真实报表同步 —— 数字仅用于界面演示，请勿用于投资判断。
            在部署环境执行 <code>/api/tasks/run?task=all</code>（需 CRON_SECRET）完成同步后，这里会自动切换为真实数据说明。
            行情、个股与 K 线数据仍来自实时公开行情接口。
          </p>
        ) : !macroFullySynced ? (
          <p
            className="text-xs mt-1 rounded-md border px-3 py-2 leading-relaxed"
            style={{ borderColor: "#d97706", background: "rgba(217,119,6,0.10)", color: "#b45309" }}
          >
            部分指标已同步：{provenance.synced}/{provenance.total} 行来自东方财富数据中心等真实来源，
            其余 {provenance.seed} 行仍为种子/示例数据（仅用于界面演示，请勿用于投资判断）。
          </p>
        ) : (
          <p className="text-xs text-muted/70 mt-1">
            注：指标序列由东方财富数据中心真实报表同步（24 项，200 期/项）
            {lastSyncText ? `，最近同步 ${lastSyncText}（北京时间）` : ""}；行情、个股与 K 线数据来自实时公开行情接口。
          </p>
        )}
      </header>

      <div className="flex gap-3 flex-wrap">
        <Link href="/macro/feeling" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">宏观温度 vs 个人体感</Link>
        <Link href="/macro#report" className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">AI 月度报告</Link>
        <Link href="/map" className="px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">区域经济全景</Link>
      </div>

      <RiskIndicators />

      <section>
        <MacroGauges />
      </section>

      <TemperatureBoard
        temperature={temperature}
        date={temperatureDate}
        raw={temperatureRaw}
        scores={temperatureScores}
        series={temperatureSeries}
        feeling={{ overall: feelingOverall, sampleCount: feelingSample, diff: feelingDiff }}
      />

      <MacroIndicatorBoard
        cards={cards.map((c) => {
          const s = series(c.type);
          const isLevel = LEVEL_TYPES.has(c.type);
          return {
            type: c.type,
            title: c.title,
            group: c.group,
            unit: c.unit,
            changeUnit: c.changeUnit,
            color: c.color,
            value: latest(c.type),
            data: seriesTail(c.type),
            yoy: isLevel ? null : yoyOf(s),
            mom: momOf(s),
            source: c.source,
          };
        })}
      />

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
        <CompareTool />
      </section>

      <section id="report">
        <MonthlyReportCard />
      </section>
    </div>
  );
}
