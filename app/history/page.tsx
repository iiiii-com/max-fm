import Link from "next/link";
import { Card, Badge, SectionTitle } from "@/components/ui";
import HistoryTimeline from "@/components/HistoryTimeline";
import { filterHistory, HISTORY_EVENTS, REGIONS, HISTORY_CATEGORIES, CAT_TONE, REGION_TONE, REGION_LABEL } from "@/lib/data/history";

export const dynamic = "force-dynamic";
export const metadata = { title: "全球历史回顾" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ region?: string; cat?: string }> }) {
  const { region = "all", cat = "全部" } = await searchParams;
  const events = filterHistory({ region, cat });
  const regionLabel = region === "all" ? "全部地区" : region === "cn" ? "中国" : "西方";
  const chips = [
    { key: "all", label: "全部地区" },
    ...REGIONS.filter((x) => x.key !== "all").map((x) => ({ key: x.key, label: x.label })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">全球历史回顾</h1>
        <p className="text-sm text-muted mt-1">
          从夏朝建立到 ChatGPT：{HISTORY_EVENTS.length} 条真实中西方历史事件的时间轴。
          点击事件展开详情（关键人物 · 历史影响 · 史料出处），按地区与类型筛选。{" "}
          <Link href="/cycle" className="text-primary hover:underline">配合康波周期使用 →</Link>
        </p>
      </header>

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
        <p className="text-xs text-muted mb-4">当前：{regionLabel} · {cat} · 共 {events.length} 条 · 按时间正序</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {events.slice(0, 6).map((e) => (
            <Card key={e.year + e.title} className="p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`font-mono font-bold text-sm ${e.year < 0 ? "text-green-600" : "text-primary"}`}>
                  {e.year < 0 ? `公元前${-e.year}` : e.year}
                </span>
                <Badge tone={(CAT_TONE[e.category] ?? "gray") as any}>{e.category}</Badge>
                <Badge tone={(REGION_TONE[e.region] ?? "gray") as any}>{REGION_LABEL[e.region]}</Badge>
              </div>
              <h3 className="font-bold leading-snug">{e.title}</h3>
              <p className="text-sm text-muted mt-1 line-clamp-2">{e.summary}</p>
            </Card>
          ))}
        </div>

        <SectionTitle title="完整时间轴" sub="点击任意事件展开详情" />
        <Card className="p-5">
          <HistoryTimeline events={events} />
        </Card>
        {!events.length && <p className="text-sm text-muted">该筛选条件下暂无事件</p>}
      </section>
    </div>
  );
}