import Link from "next/link";
import BoardTabs from "@/components/BoardTabs";
import HistoryAxis from "@/components/HistoryAxis";
import KonratiefWaves from "@/components/KonratiefWaves";
import DynastyTable from "@/components/DynastyTable";
import { Card, SectionTitle } from "@/components/ui";
import {
  filterHistory, HISTORY_EVENTS, REGIONS, HISTORY_CATEGORIES,
} from "@/lib/data/history";
import { CURRENT_POSITION } from "@/lib/data/cycles";
import konratief from "@/data/konratief.json";

export const dynamic = "force-dynamic";
export const metadata = { title: "全球历史回顾" };

const TABS = [
  { key: "timeline", label: "时间线" },
  { key: "crisis", label: "危机重演" },
  { key: "waves", label: "康波全景" },
  { key: "dynasties", label: "朝代对照" },
];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; region?: string; cat?: string }> }) {
  const { tab, region = "all", cat = "全部" } = await searchParams;
  const active = TABS.some((t) => t.key === tab) ? (tab as string) : "timeline";
  const events = filterHistory({ region, cat });
  const regionLabel = region === "all" ? "全部地区" : region === "cn" ? "中国" : "西方";
  const chips = [
    { key: "all", label: "全部地区" },
    ...REGIONS.filter((x) => x.key !== "all").map((x) => ({ key: x.key, label: x.label })),
  ];
  const featured = HISTORY_EVENTS.filter((e) => e.featured).length;
  const lessons = HISTORY_EVENTS.filter((e) => e.lesson).length;
  const axisEvents = region === "all" && cat === "全部"
    ? HISTORY_EVENTS.filter((e) => e.featured)
    : events;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">全球历史回顾</h1>
        <p className="text-sm text-muted mt-1">
          从夏朝建立到 ChatGPT：{HISTORY_EVENTS.length} 条真实中西方历史事件 ·
          {featured} 条精选（含 {lessons} 条"对今日启示"）· 按康波波次标注。
          横向时间轴默认展示精选事件，点击散点展开详情。
        </p>
      </header>

      <BoardTabs tabs={TABS} active={active} />

      {active === "timeline" && (
        <section>
          <div className="flex flex-wrap gap-2 mb-2">
            {chips.map((c) => (
              <Link
                key={c.key}
                href={`/history?region=${c.key}&cat=${encodeURIComponent(cat)}`}
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
                href={`/history?region=${region}&cat=${encodeURIComponent(c)}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  cat === c ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {c === "全部" ? "全部类型" : c}
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted mb-4">
            当前：{regionLabel} · {cat} · 共 {axisEvents.length} 条
            {region === "all" && cat === "全部" ? "（默认仅精选，筛选后展示全部）" : "（筛选模式下展示全部事件）"}
          </p>
          <Card className="p-5">
            <HistoryAxis events={axisEvents} />
          </Card>
          {!axisEvents.length && <p className="text-sm text-muted">该筛选条件下暂无事件</p>}
        </section>
      )}

      {active === "crisis" && (
        <section>
          <SectionTitle title="危机重演" sub="把历史上的危机数据复现到今日市场，用引擎回放" />
          <Card className="p-10 text-center">
            <p className="text-lg font-semibold text-muted">危机重演建设中（下一阶段上线）</p>
            <p className="text-sm text-muted mt-2">下一阶段将接入危机回放引擎：选择历史危机 → 映射今日指标 → 推演路径。</p>
          </Card>
        </section>
      )}

      {active === "waves" && (
        <div className="space-y-10">
          <section>
            <SectionTitle title="康波六波全景对照" sub="每波含技术革命、主导产业、核心国家、关键里程碑与中国同期，点击卡片展开详情" />
            <KonratiefWaves waves={konratief.waves} />
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