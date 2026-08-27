import Link from "next/link";
import { fetchQuotes, fetchGlobalQuotes } from "@/lib/data/quotes";
import { getArticles } from "@/lib/data/queries";
import { SectionTitle, Badge, AIFlag } from "@/components/ui";
import { fmt, fmtPct, fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";
import IndexCompareChart from "@/components/charts/IndexCompareChart";
import MarketDashboard from "@/components/MarketDashboard";
import CrisisImpactTable from "@/components/CrisisImpactTable";
import GlobalIndexBoard from "@/components/GlobalIndexBoard";
import GlobalHeatmap from "@/components/GlobalHeatmap";
import IndexDetailPanel from "@/components/IndexDetailPanel";

export const CORE_INDEXES = [
  { code: "000001", name: "上证指数", secid: "1.000001" },
  { code: "399001", name: "深证成指", secid: "0.399001" },
  { code: "399006", name: "创业板指", secid: "0.399006" },
  { code: "000300", name: "沪深300", secid: "1.000300" },
  { code: "000905", name: "中证500", secid: "1.000905" },
  { code: "000688", name: "科创50", secid: "1.000688" },
  { code: "HSI", name: "恒生指数", secid: "100.HSI" },
];

export default async function MarketIndexes() {
  await bootstrap();
  const [quotes, global, articles] = await Promise.all([
    fetchQuotes(),
    fetchGlobalQuotes(),
    getArticles(undefined, 6),
  ]);
  const reviews = articles.filter((a: any) => a.type === "daily" || a.type === "weekly");
  const byCode = new Map([...quotes, ...global].map((q) => [q.code, q]));

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="核心指数" sub="A 股主要指数 + 恒生指数实时行情 · 悬停看详情 · 点击卡片直达个股行情" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CORE_INDEXES.map((ix) => {
            const q = byCode.get(ix.code);
            if (!q) return null;
            const up = q.changePct >= 0;
            const t = new Date(q.timestamp);
            const hhmm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
            return (
              <Link key={ix.secid} href={`/market?tab=stocks&q=${encodeURIComponent(ix.name)}`}>
                <div className="card p-4 hover:shadow-md transition-shadow h-full group relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted">{q.name}</p>
                    <span className="text-[10px] text-muted font-mono">{q.code}</span>
                  </div>
                  <p className="text-xl font-bold font-mono mt-1">{fmt(q.price, 2)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-sm font-mono px-1.5 py-0.5 rounded ${up ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"}`}>
                      {up ? "▲" : "▼"} {q.changePct >= 0 ? "+" : ""}{fmtPct(q.changePct)}　{q.changeAmount >= 0 ? "+" : ""}{fmt(q.changeAmount, 2)}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted mt-2">更新 {hhmm}</p>

                  {/* hover 详情面板 */}
                  <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-background/95 backdrop-blur border-t border-border p-3 text-xs space-y-1 z-10">
                    <div className="flex justify-between"><span className="text-muted">今开</span><span className="font-mono">{fmt(q.open, 2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">最高</span><span className="font-mono">{fmt(q.high, 2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">最低</span><span className="font-mono">{fmt(q.low, 2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">成交量</span><span className="font-mono">{q.volume ? fmtVol(q.volume) : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted">成交额</span><span className="font-mono">{q.amount ? fmtAmt(q.amount) : "—"}</span></div>
                    <p className="text-[10px] text-muted pt-1 border-t border-border/60">点击进入该指数行情分析</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle
          title="国际指数"
          sub="美股（标普500/纳斯达克/道琼斯）· 日经 · KOSPI · 恒生 · 欧股实时行情 · 美股三大指数配历史 K 线走势（点击展开）"
        />
        <GlobalIndexBoard quotes={global} />
      </section>

      <section>
        <SectionTitle title="全球涨跌全景" sub="全球主要市场指数与龙头股实时涨跌 · 板块矩阵 / 世界地图双视图 · 点击下钻 K 线" />
        <GlobalHeatmap />
      </section>

      <section>
        <SectionTitle title="指数详情 · 市场宽度" sub="指数阶段表现（近1年/1月/距年线/波动，真实自算）· 全市场涨跌冷热" />
        <IndexDetailPanel />
      </section>

      <section>
        <SectionTitle title="指数对比" sub="近 60 个交易日收盘价归一化（起点 = 100）" />
        <IndexCompareChart indexes={CORE_INDEXES} />
      </section>

      <section>
        <SectionTitle title="板块资金流 Top 30" sub="板块主力资金流向 · 北向资金 · 自选标的快捷下钻" />
        <MarketDashboard />
      </section>

      <section>
        <SectionTitle title="AI 复盘报告" sub="每日收盘后自动生成" extra={<AIFlag />} />
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">暂无复盘报告</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((a: any) => (
              <Link key={a.id} href={`/article/${a.slug}`}>
                <div className="card p-4 hover:shadow-md transition-shadow h-full">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{a.type === "daily" ? "每日复盘" : "每周周报"}</Badge>
                    <span className="text-xs text-muted ml-auto">{fmtDate(a.publishDate)}</span>
                  </div>
                  <h3 className="font-bold leading-snug line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-muted mt-1.5 line-clamp-2">{a.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CrisisImpactTable />
    </div>
  );
}

function fmtVol(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return String(n);
}

function fmtAmt(n: number) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return String(n);
}
