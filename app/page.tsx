import Link from "next/link";
import { getArticles, getRecentAggregated, getFeelingAggregates, getTemperatures } from "@/lib/data/queries";
import { Card, StatCard, SectionTitle, Badge, AIFlag } from "@/components/ui";
import { fmt, fmtDate } from "@/lib/utils";
import { Newspaper, Map, Network, Landmark, TrendingUp, PiggyBank, RefreshCcw, History } from "lucide-react";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

const MODULES = [
  { href: "/macro", icon: Landmark, title: "宏观经济", desc: "GDP / CPI / PMI 仪表盘，AI 月度报告" },
  { href: "/policy", icon: Newspaper, title: "政策解读", desc: "政策库 + 三层 AI 解读" },
  { href: "/invest", icon: TrendingUp, title: "投资分析", desc: "实时行情、每日复盘、板块热度" },
  { href: "/map", icon: Map, title: "经济分布图", desc: "31 省数据地图可视化" },
  { href: "/industry", icon: Network, title: "产业链分析", desc: "23 条产业链上下游关系图" },
  { href: "/cycle", icon: RefreshCcw, title: "周期洞察", desc: "美林时钟四阶段资产配置" },
  { href: "/history", icon: History, title: "历史回顾", desc: "40+ 经济金融大事件复盘" },
  { href: "/advice", icon: PiggyBank, title: "个人建议", desc: "问卷 → AI 个性化配置建议" },
];

export default async function Home() {
  await bootstrap();
  const [articles, macro, feeling, temps] = await Promise.all([
    getArticles(undefined, 8),
    getRecentAggregated(),
    getFeelingAggregates(),
    getTemperatures(),
  ]);
  const temp = temps[temps.length - 1]?.temperature ?? 62;
  const diff = Math.round(temp - feeling.overall);
  const latestDaily = articles.find((a: any) => a.type === "daily");
  const latestMonthly = articles.find((a: any) => a.type === "monthly");
  const latestTemp = articles.find((a: any) => a.type === "temperature");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      {/* Hero */}
      <section className="rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold leading-snug">用数据理解经济，用理性面对温差</h1>
            <p className="mt-2 opacity-90 text-sm md:text-base">
              AI 驱动的全方位财经数据平台：政策解读 · 宏观分析 · 投资参考 · 中国经济发展全景 · 产业链透视 · 个人配置建议
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/macro/feeling" className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-sm font-medium">
                宏观 {temp}° vs 体感 {feeling.overall}°（温差 {diff > 0 ? "+" : ""}{diff}°）
              </Link>
              <Link href="/macro" className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-sm font-medium">
                查看宏观仪表盘
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <div className="rounded-lg bg-white/10 p-3 text-center">
              <p className="text-xs opacity-80">宏观温度计</p>
              <p className="text-3xl font-bold font-mono mt-1">{temp}°</p>
              <p className="text-xs mt-1 opacity-80">{temp >= 55 ? "偏暖" : temp >= 45 ? "中性" : "偏冷"}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3 text-center">
              <p className="text-xs opacity-80">大众体感温度</p>
              <p className="text-3xl font-bold font-mono mt-1">{fmt(feeling.overall)}°</p>
              <p className="text-xs mt-1 opacity-80">基于 {feeling.sampleCount} 份问卷</p>
            </div>
          </div>
        </div>
      </section>

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
          <Card className="p-5 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold">AI 速评</span>
              <AIFlag />
              <span className="text-xs text-muted ml-auto">
                {latestDaily ? `今日复盘 · ${fmtDate(latestDaily.publishDate)}` : latestMonthly ? `宏观月报 · ${fmtDate(latestMonthly.publishDate)}` : ""}
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed line-clamp-3">
              {latestDaily?.summary ?? latestMonthly?.summary ?? "AI 分析生成中。"}
            </p>
            <Link href={`/article/${latestDaily?.slug ?? latestMonthly?.slug}`} className="text-sm text-primary hover:underline mt-2 inline-block">
              阅读全文 →
            </Link>
          </Card>
        </section>
      )}

      {/* 六大模块入口 */}
      <section>
        <SectionTitle title="八大分析模块" sub="多方位多角度，总有一款适合你" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m: any) => (
            <Link key={m.href} href={m.href}>
              <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all">
                <m.icon className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-bold">{m.title}</h3>
                <p className="text-sm text-muted mt-1">{m.desc}</p>
              </Card>
            </Link>
          ))}
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
              <Card className="h-full hover:shadow-md transition-shadow">
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