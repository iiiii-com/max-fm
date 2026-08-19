import Link from "next/link";
import { getHistoryEvents } from "@/lib/data/queries";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "全球历史回顾" };

const CATEGORIES = ["全部", "债务危机", "金融危机", "泡沫破裂", "股市崩盘", "政策冲击", "供给冲击", "黑天鹅"];

const CAT_TONE: Record<string, string> = {
  债务危机: "amber", 金融危机: "red", 泡沫破裂: "purple", 股市崩盘: "red",
  政策冲击: "blue", 供给冲击: "green", 黑天鹅: "gray",
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  await bootstrap();
  const all = await getHistoryEvents();
  const events = cat && cat !== "全部" ? all.filter((e: any) => e.category === cat) : all;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">全球历史回顾</h1>
        <p className="text-sm text-muted mt-1">从 1637 年郁金香泡沫到 2023 年银行危机：回放每一次重大危机与崩盘，看清规律，指导当下</p>
      </header>

      <section>
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={c === "全部" ? "/history" : `/history?cat=${encodeURIComponent(c)}`}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                (cat ?? "全部") === c ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e: any) => (
            <Link key={e.id} href={`/history/${e.slug}`}>
              <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full flex flex-col">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge tone={(CAT_TONE[e.category] ?? "gray") as any}>{e.category || "事件"}</Badge>
                  <Badge tone="gray">{e.region}</Badge>
                  <span className="text-xs text-muted ml-auto font-mono">{e.date}</span>
                </div>
                <h3 className="font-bold text-lg leading-snug">{e.title}</h3>
                <p className="text-sm text-muted mt-1.5 line-clamp-3 flex-1">{e.summary}</p>
                <div className="flex gap-2 mt-3">
                  {(JSON.parse(e.dataLinks ?? "[]") as Array<{ label: string; value: string }>).slice(0, 2).map((d: any) => (
                    <span key={d.label} className="text-xs px-2 py-0.5 rounded bg-border/40 text-muted">
                      {d.label} {d.value}
                    </span>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
        {!events.length && <p className="text-sm text-muted">该分类暂无事件</p>}
      </section>
    </div>
  );
}