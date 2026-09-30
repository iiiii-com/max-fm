"use client";

import { CITY_INSIGHTS, type CityInsight } from "@/lib/data/cityInsights";

/**
 * 城市解读面板 —— 产业讲解 / 特点 / 就业 / 收入开支机制 / 优缺点 / 生活质量。
 *
 * 数据纪律（重要，页面上也必须保持一致）：
 * 本区块**不含任何统计数值**。站内没有城市级的薪资、居民收入、消费支出、
 * 房价绝对值数据（唯一有官方口径的是统计局 70 城房价**指数**，基期=100）。
 * 因此这里只写机制与结构，并给出取数指引 —— 读者想看数值时，
 * 指引会告诉他该查哪个官方口径的哪个表，而不是这里编一个。
 *
 * 这与站内此前的做法相反：province_stats.trade 曾是 gdp × (0.25 + rng()×0.4)
 * 生成的随机数，以省级统计名义展示，排名完全失真。清掉它之后，
 * 这里宁可留白也不填一个「看起来合理」的数字。
 */

function Block({
  title,
  children,
  tone = "plain",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "plain" | "pro" | "con";
}) {
  const head =
    tone === "pro" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "con" ? "text-amber-600 dark:text-amber-400"
    : "text-primary";
  return (
    <div>
      <p className={`text-[10px] font-bold tracking-[0.2em] ${head} mb-1.5`}>{title}</p>
      {children}
    </div>
  );
}

function LineList({ items, marker }: { items: string[]; marker?: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li
          key={t}
          className="text-[13px] leading-relaxed text-foreground/85 flex gap-2"
        >
          <span className="text-muted shrink-0" aria-hidden>
            {marker ?? String(i + 1).padStart(2, "0")}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CityInsightPanel({ cityName }: { cityName: string }) {
  const ins: CityInsight | undefined = CITY_INSIGHTS[cityName];
  if (!ins) return null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-bold text-lg tracking-tight mb-1">城市解读</h3>
        <p className="text-[11px] text-muted leading-relaxed">
          本区块只写机制与结构，<b>不含统计数值</b> —— 站内没有城市级的薪资、
          居民收入与房价绝对值数据（仅有统计局 70 城房价<b>指数</b>，基期=100）。
          想看数值请按下方「取数口径」查官方统计，不在这里填估算值。
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Block title="产业讲解">{ins.industry}</Block>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Block title="城市特点">{ins.character}</Block>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <Block title="就业结构">
            <p className="text-[13px] leading-relaxed text-foreground/85 mb-2.5">
              {ins.jobs.structure}
            </p>
            <LineList items={ins.jobs.directions} />
            <p className="text-[11px] text-muted mt-2.5 leading-relaxed border-t border-border pt-2">
              注意：{ins.jobs.caveat}
            </p>
          </Block>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <Block title="收入由什么决定">
            <p className="text-[13px] leading-relaxed text-foreground/85 mb-2">
              {ins.income.drivers}
            </p>
            <p className="text-[13px] leading-relaxed text-foreground/85 mb-2.5">
              {ins.income.structure}
            </p>
            <Block title="开支压力来自哪里">
              <p className="text-[13px] leading-relaxed text-foreground/85 mb-2">
                {ins.cost.housing}
              </p>
              <p className="text-[13px] leading-relaxed text-foreground/85">
                {ins.cost.living}
              </p>
            </Block>
          </Block>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <Block title="取数口径（要看数值请查这里）">
          <p className="text-[12px] leading-relaxed text-foreground/80">
            <b>收入</b>：{ins.income.source}
          </p>
          <p className="text-[12px] leading-relaxed text-foreground/80 mt-1.5">
            <b>开支</b>：{ins.cost.source}
          </p>
          <p className="text-[11px] text-muted mt-2.5 leading-relaxed border-t border-border pt-2">
            提醒：<b>城镇单位就业人员平均工资</b>（含单位、只统计城镇非私营与私营单位）
            与<b>居民人均可支配收入</b>（住户调查抽样、含所有城乡居民）是两个口径，
            不能互相替代，也不能拿来推算「人均收入」——
            站内此前就出现过用前者冒充后者的风险，这里给出明确指引以避免误用。
          </p>
        </Block>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <Block title="优势" tone="pro">
            <LineList items={ins.pros} marker="+" />
          </Block>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Block title="短板" tone="con">
            <LineList items={ins.cons} marker="−" />
          </Block>
        </div>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4 space-y-3">
        <Block title="生活质量">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-muted mb-1">强项</p>
              <LineList items={ins.life.strengths} marker="·" />
            </div>
            <div>
              <p className="text-[11px] text-muted mb-1">需要接受的取舍</p>
              <LineList items={ins.life.tradeoffs} marker="·" />
            </div>
            <div>
              <p className="text-[11px] text-muted mb-1">适合谁</p>
              <LineList items={ins.life.fitFor} marker="·" />
            </div>
          </div>
        </Block>
      </div>
    </section>
  );
}