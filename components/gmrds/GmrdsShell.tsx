"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 研究体系（GMRDS）的统一外壳：侧边导航 + 当前位置高亮。
 *
 * 为什么需要它：
 * /gmrds 下有 13 个学院页与 12 个独立页面，但站点主导航只暴露了 4 个入口
 * （体系总览 / 真实案例 / 经典工具箱 / 环节实操）。其余 8 个页面
 * —— 环节深度研究、评分示例、治理架构、数据互通、实施路线、迭代路线、
 * 来源核对、传导案例 —— 只能靠读者猜 URL 或从正文里翻，
 * 实际等于没有入口。学院页之间也没有互跳，读完一页不知道下一页在哪。
 *
 * 侧边栏在移动端折叠为顶部横向滚动条，避免占用首屏。
 */

/** 与 lib/data/gmrds.ts 的 ACADEMIES 一一对应 */
const ACADEMY_SLUGS = [
  ["global", "全球宏观"],
  ["macro", "宏观经济"],
  ["liquidity", "流动性"],
  ["cycle", "周期定位"],
  ["industry", "行业景气"],
  ["company", "公司研究"],
  ["valuation", "估值"],
  ["technical", "技术分析"],
  ["quant", "量化"],
  ["allocation", "资产配置"],
  ["trading", "交易执行"],
  ["ai", "AI 研究"],
  ["committee", "决策委员会"],
] as const;

/** 12 个独立页面，按「先理解体系 → 再看方法 → 最后落地」排序 */
const SECTIONS: Array<{ href: string; label: string; desc: string }> = [
  { href: "/gmrds", label: "体系总览", desc: "四大阶段与整体框架" },
  { href: "/gmrds/flow", label: "十一环节实操", desc: "逐环节方法论与标准" },
  { href: "/gmrds/depth", label: "环节深度研究", desc: "目标 · 工具 · 案例" },
  { href: "/gmrds/cases", label: "真实案例库", desc: "安然 · 雷曼 · 特斯拉" },
  { href: "/gmrds/case", label: "传导案例", desc: "单一事件的完整传导链" },
  { href: "/gmrds/toolkit", label: "经典工具箱", desc: "K线 · 雷达 · 估值 · 回撤" },
  { href: "/gmrds/scorecard", label: "全流程评分", desc: "真实数据自动打分" },
  { href: "/gmrds/governance", label: "治理架构", desc: "决策委员会与制衡" },
  { href: "/gmrds/data-platform", label: "数据互通", desc: "数据源与更新机制" },
  { href: "/gmrds/implementation", label: "实施路线", desc: "落地步骤与分工" },
  { href: "/gmrds/roadmap", label: "迭代路线", desc: "版本演进与规划" },
  { href: "/gmrds/sources", label: "来源核对", desc: "数据出处清单" },
];

export default function GmrdsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 当前所在学院：/gmrds/macro → macro
  const academy = ACADEMY_SLUGS.find(([s]) => pathname === `/gmrds/${s}`);
  const isAcademy = !!academy;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6">
      <div className="flex flex-col lg:flex-row gap-5">
        {/* 侧边导航 */}
        <aside className="lg:w-56 lg:shrink-0">
          {/* 移动端：横向滚动，避免占首屏 */}
          <nav className="lg:hidden -mx-3 px-3 mb-4 overflow-x-auto">
            <ul className="flex gap-1.5 whitespace-nowrap pb-1">
              {SECTIONS.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      pathname === s.href
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden lg:block sticky top-4 space-y-4">
            <nav aria-label="研究体系导航">
              <p className="text-[10px] font-bold tracking-[0.2em] text-muted px-2 pb-1.5">
                体系页面
              </p>
              <ul className="space-y-0.5">
                {SECTIONS.map((s) => {
                  const active = pathname === s.href;
                  return (
                    <li key={s.href}>
                      <Link
                        href={s.href}
                        aria-current={active ? "page" : undefined}
                        className={`block px-2 py-1.5 rounded-lg text-[13px] leading-snug transition-colors ${
                          active
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted hover:text-foreground hover:bg-border/40"
                        }`}
                      >
                        {s.label}
                        <span className="block text-[10px] font-normal opacity-70 mt-0.5">
                          {s.desc}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <nav aria-label="学院导航">
              <p className="text-[10px] font-bold tracking-[0.2em] text-muted px-2 pb-1.5">
                十三学院
                {isAcademy && (
                  <span className="ml-1 text-primary normal-case tracking-normal">
                    当前：{academy[1]}
                  </span>
                )}
              </p>
              <ul className="flex flex-wrap gap-1 px-1">
                {ACADEMY_SLUGS.map(([slug, name]) => {
                  const active = pathname === `/gmrds/${slug}`;
                  return (
                    <li key={slug}>
                      <Link
                        href={`/gmrds/${slug}`}
                        aria-current={active ? "page" : undefined}
                        className={`inline-block px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border text-muted hover:text-foreground hover:border-primary/40"
                        }`}
                      >
                        {name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>

        {/* 主体 */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}