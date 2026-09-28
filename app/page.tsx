import Link from "next/link";
import { getArticles, getRecentAggregated, getFeelingAggregates, getTemperatures, getChains, buildTempDiffView, fmtTemp, fmtDiff } from "@/lib/data/queries";
import { Card, StatCard, SectionTitle, Badge, AIFlag } from "@/components/ui";
import { fmt, fmtDate } from "@/lib/utils";
import { Network, Landmark, TrendingUp, History, Compass } from "lucide-react";
import { HISTORY_EVENTS } from "@/lib/data/history";
import BoardCard from "@/components/BoardCard";
import DashboardTerminal from "@/components/DashboardTerminal";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "首页", description: "AI 驱动的全方位财经数据平台：宏观指标、板块资金流、ETF、产业链与个人配置建议。" };

const crisisCount = 20;

export default async function Home() {
  await bootstrap();
  const [articles, macro, feeling, temps, chains] = await Promise.all([
    getArticles(undefined, 8),
    getRecentAggregated(),
    getFeelingAggregates(),
    getTemperatures(),
    getChains(),
  ]);
  const lastTemp = temps[temps.length - 1];
  // 温差三件套统一走 buildTempDiffView；温度无数据时为 null，不再回退到硬编码 62
  const tv = buildTempDiffView(lastTemp?.temperature, feeling.overall, feeling.sampleCount, lastTemp?.date ?? null);
  const temp = tv.macro;
  const latestDaily = articles.find((a: any) => a.type === "daily");
  const latestMonthly = articles.find((a: any) => a.type === "monthly");
  const latestTemp = articles.find((a: any) => a.type === "temperature");

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* Hero */}
      {/* 报头式首屏：墨色底 + 衬线大标题 + 发丝线分隔。
          刻意不用模糊光球/玻璃拟态——那是消费级 App 的语言，与研究类版式相斥。 */}
      <section className="relative bg-foreground text-background px-6 md:px-8 py-7 md:py-9 overflow-hidden">
        <div className="relative flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase opacity-60">
              China Macro · Policy · Industry
            </p>
            <h1 className="heading-serif text-2xl md:text-[34px] md:leading-[1.25] font-bold mt-2">
              用数据理解经济，用理性面对温差
            </h1>
            <div className="mt-3 h-px w-16 bg-background/30" aria-hidden />
            <p className="mt-3 opacity-75 text-sm md:text-[15px] leading-relaxed max-w-2xl">
              政策解读 · 宏观分析 · 投资参考 · 中国经济发展全景 · 产业链透视 · 个人配置建议
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/macro/feeling"
                className="px-3.5 py-1.5 rounded-sm border border-background/35 hover:border-background/70 hover:bg-background/10 transition-colors text-sm"
              >
                宏观 {fmtTemp(tv.macro)}° vs 体感 {fmtTemp(tv.feeling)}°
                <span className="ml-1.5 opacity-70">温差 {fmtDiff(tv.diff)}°</span>
              </Link>
              <Link
                href="/macro"
                className="px-3.5 py-1.5 rounded-sm border border-background/35 hover:border-background/70 hover:bg-background/10 transition-colors text-sm"
              >
                查看宏观仪表盘
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px shrink-0 bg-background/20 border border-background/20 w-full md:w-auto">
            <div className="bg-foreground px-4 py-3 text-center">
              <p className="text-[11px] opacity-65">宏观温度计</p>
              <p className="text-[28px] leading-tight font-mono font-bold mt-0.5 tabular-nums">
                {fmtTemp(tv.macro)}°
              </p>
              <p className="text-[11px] mt-0.5 opacity-65">
                {temp == null ? "暂无温度数据" : temp >= 55 ? "偏暖" : temp >= 45 ? "中性" : "偏冷"}
              </p>
            </div>
            <div className="bg-foreground px-4 py-3 text-center">
              <p className="text-[11px] opacity-65">大众体感温度</p>
              <p className="text-[28px] leading-tight font-mono font-bold mt-0.5 tabular-nums">
                {fmtTemp(tv.feeling)}°
              </p>
              <p className="text-[11px] mt-0.5 opacity-65">
                {feeling.sampleCount > 0 ? `${feeling.sampleCount} 份问卷` : "暂无问卷数据"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 数据终端：行情速览 / 全球热力 / 宏观仪表 / 板块资金（可拖拽排序 · 启停开关） */}
      <DashboardTerminal />

      {/* 数据速览 */}
      <section>
        <SectionTitle title="核心指标速览" sub="数据来源：国家统计局 / 中国人民银行 / 海关总署 / 中国指数研究院" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="GDP 同比" value={`${fmt(macro.latestGdp)}%`} sub="最新季度" href="/macro" />
          <StatCard label="CPI 同比" value={`${fmt(macro.latestCpi)}%`} sub="物价" href="/macro" />
          <StatCard label="制造业 PMI" value={fmt(macro.latestPmi)} sub={macro.latestPmi >= 50 ? "扩张区间" : "收缩区间"} href="/macro" />
          <StatCard label="M2 同比" value={`${fmt(macro.latestM2)}%`} sub="货币供给" href="/macro" />
          <StatCard label="房价同比" value={`${fmt(macro.latestHouseprice)}%`} sub={macro.latestHouseprice >= 0 ? "上涨" : "下跌"} href="/macro" />
          <StatCard label="出口同比" value={`${fmt(macro.latestExport)}%`} sub="外贸" href="/macro" />
          <StatCard label="失业率" value={`${fmt(macro.latestUnemp)}%`} sub="城镇调查" href="/macro" />
          <StatCard label="新增贷款" value={`${fmt(macro.latestLoans)} 万亿`} sub="月度新增" href="/macro" />
        </div>
      </section>

      {/* AI 速评 */}
      {(latestDaily || latestMonthly) && (
        <section>
          <Card className="p-5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary/30" aria-hidden />
            <div className="flex items-center gap-2 mb-2 pl-2 flex-wrap">
              <span className="font-bold">AI 速评</span>
              <AIFlag />
              {/* 标签跟随真实发布日期：旧实现固定写「今日复盘」，
                  而 cron 停更时首页会挂着一个月前的复盘却标着「今日」。 */}
              <span className="text-xs text-muted ml-auto">
                {(() => {
                  const a = latestDaily ?? latestMonthly!;
                  const d = String(a.publishDate ?? "");
                  const isToday = d === new Date().toISOString().slice(0, 10);
                  const kind = latestDaily ? "复盘" : "宏观月报";
                  const stale = d && !isToday;
                  return (
                    <>
                      {stale ? `${kind}（${fmtDate(d)}）` : `${kind} · ${fmtDate(d)}`}
                      {stale && (
                        <span className="ml-2 text-[10px] px-1.5 py-px rounded border border-amber-500/40 text-amber-600 dark:text-amber-400">
                          内容已过期
                        </span>
                      )}
                    </>
                  );
                })()}
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed line-clamp-3 pl-2.5">
              {latestDaily?.summary ?? latestMonthly?.summary ?? "AI 分析生成中。"}
            </p>
            <Link href={`/article/${latestDaily?.slug ?? latestMonthly?.slug}`} className="text-sm text-primary hover:underline mt-2 inline-block pl-2.5">
              阅读全文 →
            </Link>
          </Card>
        </section>
      )}

      {/* 板块导航：与 Header 导航的 5 个板块保持一致 */}
      <section>
        <SectionTitle title="五大板块" sub="宏观 · 市场 · 产业 · 历史 · 研究，一站式经济洞察" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BoardCard index={1} href="/macro" title="宏观总览" desc="经济指标 · 政策解读 · 周期洞察 · 经济地图 · 个人建议" icon={<Landmark className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">
              最新温度：{fmtTemp(tv.macro)}°C · 体感指数：{fmtTemp(tv.feeling)}
              {feeling.sampleCount > 0 ? `（${feeling.sampleCount} 份问卷）` : "（暂无问卷数据）"}
            </p>
            <QuickLinks links={[
              { href: "/macro", label: "宏观仪表盘" },
              { href: "/macro/feeling", label: "温度 vs 体感" },
              { href: "/policy", label: "政策解读" },
              { href: "/map", label: "经济分布图" },
              { href: "/advice", label: "个人建议" },
            ]} />
          </BoardCard>
          <BoardCard index={2} href="/market" title="市场洞察" desc="大盘指数 · 个股行情 · ETF · 资金流 · 快讯" icon={<TrendingUp className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">AI 复盘报告每日自动生成</p>
            <QuickLinks links={[
              { href: "/market", label: "大盘指数" },
              { href: "/market?tab=stocks", label: "个股行情" },
              { href: "/etf", label: "ETF 专区" },
              { href: "/compare", label: "对比中心" },
            ]} />
          </BoardCard>
          <BoardCard index={3} href="/industry" title="产业地图" desc="产业链全景 · 景气度 · 资金热度 · 危机冲击案例" icon={<Network className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">{chains.length} 条主线产业链</p>
            <QuickLinks links={[
              { href: "/industry", label: "产业链全景" },
              { href: "/industry?tab=chains", label: "产业链列表" },
            ]} />
          </BoardCard>
          <BoardCard index={4} href="/history" title="历史演进" desc="牛熊周期 · 康波全景 · 历史时间线" icon={<History className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">{HISTORY_EVENTS.length} 条事件 · {crisisCount} 场危机重演</p>
            <QuickLinks links={[
              { href: "/history", label: "历史时间线" },
              { href: "/history?tab=crisis", label: "危机重演" },
              { href: "/history?tab=waves", label: "康波全景" },
              { href: "/analysis/cycle-anatomy", label: "周期解剖" },
            ]} />
          </BoardCard>
          {/* 第五个板块：此前导航有「研究体系」但首页没有入口，属于组织缺口，补齐以与导航一致 */}
          <BoardCard
            index={5}
            href="/gmrds"
            title="研究体系"
            desc="决策流程 · 真实案例 · 工具箱 · K线实验室"
            icon={<Compass className="w-4.5 h-4.5" />}
          >
            <p className="mb-2.5 text-xs text-muted">四大阶段 · 十一环节决策链</p>
            <QuickLinks links={[
              { href: "/lab", label: "K线实验室" },
              { href: "/gmrds", label: "体系总览" },
              { href: "/gmrds/cases", label: "真实案例" },
              { href: "/gmrds/toolkit", label: "经典工具箱" },
            ]} />
          </BoardCard>
        </div>
      </section>

      {/* 文章流 */}
      <section>
        <SectionTitle
          title="最新分析"
          extra={<Link href="/macro" className="text-sm text-primary hover:underline">更多 →</Link>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            /**
             * 过滤掉「AI 兜底模板稿」。
             * cron 失败时 tasks/run 会写入通用模板，标题形如
             * 「AI 自动生成的当日市场复盘（2026-08-19）」，正文与政策无关。
             * 旧实现把这些占位稿和真实报告一起放进首页「最新分析」，
             * 读者会点进去发现是一句「AI 自动生成的…」，与真稿混排且无任何标识。
             * 现按标题/摘要特征识别并排除（不删除数据，只是不进信息流）。
             */
            const isTemplate = (a: any) =>
              /^AI 自动生成的/.test(String(a?.title ?? "")) ||
              /自动生成的(当日市场复盘|月度宏观经济报告)/.test(String(a?.summary ?? ""));
            const picked = [latestDaily, latestMonthly, latestTemp]
              .filter((a: any) => a && !isTemplate(a))
              .concat(articles.filter((a: any) => ![latestDaily, latestMonthly, latestTemp].includes(a) && !isTemplate(a)))
              .filter(Boolean)
              .slice(0, 6);
            if (!picked.length) {
              return (
                <p className="text-sm text-muted col-span-2 py-6 text-center">
                  暂无已生成的分析报告（AI 内容任务未产出有效内容，模板占位稿已从信息流隐藏）。
                </p>
              );
            }
            return picked.map((a: any) => (
              <Link key={a.id} href={`/article/${a.slug}`}>
                <Card className="h-full card-hover">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{a.type === "daily" ? "每日复盘" : a.type === "monthly" ? "月度报告" : a.type === "weekly" ? "每周周报" : "温差报告"}</Badge>
                    <AIFlag />
                    <span className="text-xs text-muted ml-auto">{fmtDate(a.publishDate)}</span>
                  </div>
                  <h3 className="font-bold leading-snug line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-muted mt-2 line-clamp-2">{a.summary}</p>
                </Card>
              </Link>
            ));
          })()}
        </div>
      </section>
    </div>
  );
}

/** 板块卡片内的子模块直达链接 */
function QuickLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="text-primary/90 hover:text-primary hover:underline">
          {l.label}
        </Link>
      ))}
    </div>
  );
}