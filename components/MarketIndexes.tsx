import Link from "next/link";
import { TestTubes } from "lucide-react";
import { fetchQuotes, fetchGlobalQuotes } from "@/lib/data/quotes";
import { getArticles } from "@/lib/data/queries";
import { SectionTitle, Badge, AIFlag } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { bootstrap } from "@/lib/db";
import IndexCompareChart from "@/components/charts/IndexCompareChart";
import MarketDashboard from "@/components/MarketDashboard";
import CrisisImpactTable from "@/components/CrisisImpactTable";
import GlobalIndexBoard from "@/components/GlobalIndexBoard";
import GlobalHeatmap from "@/components/GlobalHeatmap";
import SurgeBoard from "@/components/SurgeBoard";
import FundRank from "@/components/FundRank";
import IndexDetailPanel from "@/components/IndexDetailPanel";
import LiveCoreIndexes from "@/components/market/LiveCoreIndexes";

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
  const coreCodes = new Set(CORE_INDEXES.map((ix) => ix.code));
  const coreQuotes = [...quotes, ...global].filter((q) => coreCodes.has(q.code));

  return (
    <div className="space-y-8">
      {/* 跨板块互通：行情 → 教学实操（携带上证指数上下文进入 K线实验室） */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Link
          href="/lab?secid=1.000001&name=上证指数"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary font-medium hover:bg-primary/10 transition-colors"
        >
          <TestTubes className="w-3.5 h-3.5" /> 到 K线实验室 · 任意标的教学实操
        </Link>
        <Link href="/lab" className="text-muted hover:text-primary underline underline-offset-2">切换任意股票 / 指数</Link>
        <Link href="/compare" className="text-muted hover:text-primary underline underline-offset-2">多指数/ETF 归一化对比</Link>
      </div>

      <section>
        <SectionTitle
          title="核心指数 · 实时"
          sub="上证 / 深成 / 创业板 / 沪深300 / 中证500 / 科创50 / 恒生 · 每 25 秒自动刷新 · 市场宽度 + 日内区间条 · 点击卡片直达个股行情"
        />
        <LiveCoreIndexes indexes={CORE_INDEXES} initial={coreQuotes} />
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
        <SectionTitle title="异动速报 · 热点追踪" sub="涨幅/资金/成交额异常标的速报 · 行业板块涨幅榜（东方财富实时，A股为主）" />
        <SurgeBoard />
      </section>

      <section>
        <SectionTitle title="资金流向排名" sub="板块/个股主力资金流入流出 Top10（东财实时 f62 口径）" />
        <FundRank />
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
                <div className="card p-4 transition-shadow h-full">
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
