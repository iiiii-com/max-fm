import Link from "next/link";
import { getArticles, getRecentAggregated, getFeelingAggregates, getTemperatures, getChains } from "@/lib/data/queries";
import { Card, StatCard, SectionTitle, Badge, AIFlag } from "@/components/ui";
import { fmt, fmtDate } from "@/lib/utils";
import { Network, Landmark, TrendingUp, History } from "lucide-react";
import { HISTORY_EVENTS } from "@/lib/data/history";
import BoardCard from "@/components/BoardCard";
import DashboardTerminal from "@/components/DashboardTerminal";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

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
  const temp = temps[temps.length - 1]?.temperature ?? 62;
  const diff = Math.round(temp - feeling.overall);
  const latestDaily = articles.find((a: any) => a.type === "daily");
  const latestMonthly = articles.find((a: any) => a.type === "monthly");
  const latestTemp = articles.find((a: any) => a.type === "temperature");

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      {/* Hero */}
      <section className="relative rounded-xl bg-gradient-to-r from-primary via-primary-dark to-primary-dark text-white p-6 md:p-8 overflow-hidden">
        {/* 光晕点缀：右上角暖光，增加纵深 */}
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 -left-10 w-64 h-64 rounded-full bg-black/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold leading-snug tracking-tight">用数据理解经济，用理性面对温差</h1>
            <p className="mt-2 opacity-90 text-sm md:text-base">
              AI 驱动的全方位财经数据平台：政策解读 · 宏观分析 · 投资参考 · 中国经济发展全景 · 产业链透视 · 个人配置建议
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/macro/feeling" className="px-4 py-2 rounded-lg bg-white/15 backdrop-blur hover:bg-white/25 transition-colors duration-150 text-sm font-medium">
                宏观 {temp}° vs 体感 {feeling.overall}°（温差 {diff > 0 ? "+" : ""}{diff}°）
              </Link>
              <Link href="/macro" className="px-4 py-2 rounded-lg bg-white/15 backdrop-blur hover:bg-white/25 transition-colors duration-150 text-sm font-medium">
                查看宏观仪表盘
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="rounded-lg bg-white/10 backdrop-blur p-3 text-center ring-1 ring-white/15">
              <p className="text-xs opacity-80">宏观温度计</p>
              <p className="text-3xl font-bold font-mono mt-1">{temp}°</p>
              <p className="text-xs mt-1 opacity-80">{temp >= 55 ? "偏暖" : temp >= 45 ? "中性" : "偏冷"}</p>
            </div>
            <div className="rounded-lg bg-white/10 backdrop-blur p-3 text-center ring-1 ring-white/15">
              <p className="text-xs opacity-80">大众体感温度</p>
              <p className="text-3xl font-bold font-mono mt-1">{fmt(feeling.overall)}°</p>
              <p className="text-xs mt-1 opacity-80">基于 {feeling.sampleCount} 份问卷</p>
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
            <div className="flex items-center gap-2 mb-2 pl-2">
              <span className="font-bold">AI 速评</span>
              <AIFlag />
              <span className="text-xs text-muted ml-auto">
                {latestDaily ? `今日复盘 · ${fmtDate(latestDaily.publishDate)}` : latestMonthly ? `宏观月报 · ${fmtDate(latestMonthly.publishDate)}` : ""}
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

      {/* 四大板块 */}
      <section>
        <SectionTitle title="四大板块" sub="宏观 · 市场 · 产业 · 历史，一站式经济洞察" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BoardCard href="/macro" title="宏观总览" desc="经济指标 · 政策解读 · 周期洞察 · 经济地图 · 个人建议" accent="bg-blue-600" icon={<Landmark className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">最新温度：{temp}°C · 情绪指数：{fmt(feeling.overall)}</p>
            <QuickLinks links={[
              { href: "/macro", label: "宏观仪表盘" },
              { href: "/macro/feeling", label: "温度 vs 体感" },
              { href: "/policy", label: "政策解读" },
              { href: "/map", label: "经济分布图" },
              { href: "/advice", label: "个人建议" },
            ]} />
          </BoardCard>
          <BoardCard href="/market" title="市场洞察" desc="大盘指数 · 个股行情 · ETF · 资金流 · 快讯" accent="bg-red-600" icon={<TrendingUp className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">AI 复盘报告每日自动生成</p>
            <QuickLinks links={[
              { href: "/market", label: "大盘指数" },
              { href: "/market?tab=stocks", label: "个股行情" },
              { href: "/etf", label: "ETF 专区" },
              { href: "/compare", label: "对比中心" },
            ]} />
          </BoardCard>
          <BoardCard href="/industry" title="产业地图" desc="22 条产业链 · 景气度 · 资金热度 · 危机冲击案例" accent="bg-purple-600" icon={<Network className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">{chains.length} 条主线产业链</p>
            <QuickLinks links={[
              { href: "/industry", label: "产业链全景" },
              { href: "/industry?tab=chains", label: "产业链列表" },
            ]} />
          </BoardCard>
          <BoardCard href="/history" title="历史演进" desc="时间线 · 康波全景 · 朝代对照 · 危机重演" accent="bg-emerald-600" icon={<History className="w-4.5 h-4.5" />}>
            <p className="mb-2.5 text-xs text-muted">{HISTORY_EVENTS.length} 条事件 · {crisisCount} 场危机重演</p>
            <QuickLinks links={[
              { href: "/history", label: "历史时间线" },
              { href: "/history?tab=crisis", label: "危机重演" },
              { href: "/history?tab=waves", label: "康波全景" },
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
          {[latestDaily, latestMonthly, latestTemp, ...articles.filter((a: any) => ![latestDaily, latestMonthly, latestTemp].includes(a))].filter(Boolean).slice(0, 6).map((a: any) => (
            <Link key={a!.id} href={`/article/${a!.slug}`}>
              <Card className="h-full card-hover">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>{a!.type === "daily" ? "每日复盘" : a!.type === "monthly" ? "月度报告" : a!.type === "weekly" ? "每周周报" : "温差报告"}</Badge>
                  <AIFlag />
                  <span className="text-xs text-muted ml-auto">{fmtDate(a!.publishDate)}</span>
                </div>
                <h3 className="font-bold leading-snug line-clamp-2">{a!.title}</h3>
                <p className="text-sm text-muted mt-2 line-clamp-2">{a!.summary}</p>
              </Card>
            </Link>
          ))}
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