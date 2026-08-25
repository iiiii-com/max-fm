import type { LucideIcon } from "lucide-react";
import {
  Landmark,
  TrendingUp,
  Network,
  History,
  LayoutDashboard,
  Thermometer,
  ScrollText,
  MapPinned,
  ClipboardList,
  Gauge,
  CandlestickChart,
  LineChart,
  GitCompareArrows,
  Waypoints,
  Boxes,
  Clock,
  ShieldAlert,
  Waves,
  Search,
  User,
  Compass,
  Workflow,
  Rocket,
  Library,
  Database,
  ShieldCheck,
  BookOpenCheck,
  Wrench,
} from "lucide-react";

/**
 * 站点导航单一事实源：Header 二级下拉、全局面包屑、首页板块卡片、页脚站点地图共用。
 * 新增 / 调整页面时只需改这里。
 */

export interface NavChild {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

export interface NavGroup {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  children: NavChild[];
}

export const NAV: NavGroup[] = [
  {
    href: "/macro",
    label: "宏观总览",
    desc: "经济指标 · 政策解读 · 经济地图 · 个人建议",
    icon: Landmark,
    children: [
      { href: "/macro", label: "宏观仪表盘", desc: "GDP / CPI / PMI / M2 等核心指标", icon: LayoutDashboard },
      { href: "/macro/feeling", label: "温度 vs 体感", desc: "宏观温度与个人体感温差", icon: Thermometer },
      { href: "/policy", label: "政策解读", desc: "政策库 + 三层 AI 视角解读", icon: ScrollText },
      { href: "/map", label: "经济分布图", desc: "31 省经济数据地图", icon: MapPinned },
      { href: "/advice", label: "个人建议", desc: "问卷生成资产配置建议", icon: ClipboardList },
    ],
  },
  {
    href: "/market",
    label: "市场洞察",
    desc: "指数行情 · 资金流向 · 个股 · ETF",
    icon: TrendingUp,
    children: [
      { href: "/market", label: "大盘指数", desc: "指数行情 · 板块资金流", icon: Gauge },
      { href: "/market?tab=stocks", label: "个股行情", desc: "K 线 + 资金双图联动 · 评分", icon: CandlestickChart },
      { href: "/etf", label: "ETF 专区", desc: "ETF 行情与持仓透视", icon: LineChart },
      { href: "/compare", label: "对比中心", desc: "股票 · 指数 · ETF 跨类型对比", icon: GitCompareArrows },
    ],
  },
  {
    href: "/industry",
    label: "产业地图",
    desc: "产业链全景 · 景气度 · 资金热度",
    icon: Network,
    children: [
      { href: "/industry", label: "产业链全景", desc: "32 条产业链上中下游泳道", icon: Waypoints },
      { href: "/industry?tab=chains", label: "产业链列表", desc: "按链索引 · 点击进入详情", icon: Boxes },
    ],
  },
  {
    href: "/history",
    label: "历史演进",
    desc: "时间线 · 康波周期 · 危机重演",
    icon: History,
    children: [
      { href: "/history", label: "历史时间线", desc: "事件时间轴 · 朝代对照", icon: Clock },
      { href: "/history?tab=crisis", label: "危机重演", desc: "20 场历史危机 · 决策测验", icon: ShieldAlert },
      { href: "/history?tab=waves", label: "康波全景", desc: "五轮康波周期洞察", icon: Waves },
    ],
  },
  {
    href: "/gmrds",
    label: "研究体系",
    desc: "GMRDS · 十二学院 · 决策流程 · 工具箱",
    icon: Compass,
    children: [
      { href: "/gmrds", label: "体系总览", desc: "四大阶段 · 十一环节决策链", icon: Library },
      { href: "/gmrds/governance", label: "治理架构", desc: "十二学院 + 决策委员会 · 职责边界", icon: Landmark },
      { href: "/gmrds/flow", label: "环节实操", desc: "操作步骤 · 判断标准 · 执行工具", icon: Workflow },
      { href: "/gmrds/toolkit", label: "实操工具箱", desc: "K线买卖点 · 雷达图 · 估值 · 回撤", icon: Wrench },
      { href: "/gmrds/cases", label: "真实案例", desc: "安然·雷曼·可口可乐·特斯拉·瑞幸·微软", icon: BookOpenCheck },
      { href: "/gmrds/roadmap", label: "发展路线", desc: "V1 基础 → V2 专业 → V3 平台 · 实施", icon: History },
    ],
  },
];

/** 独立工具页（不进主导航下拉，用于面包屑与页脚） */
export const UTILITY_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/search", label: "全局搜索", icon: Search },
  { href: "/account", label: "个人账户", icon: User },
];

/** 页脚工具 / 说明链接 */
export const FOOTER_UTILITY: { href: string; label: string }[] = [
  { href: "/about", label: "关于我们" },
  { href: "/disclaimer", label: "免责声明" },
  { href: "/privacy", label: "隐私政策" },
];

export interface Crumb {
  href?: string;
  label: string;
}

/** 供 Header 判断板块是否处于激活态 */
export function isGroupActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 子模块默认视图标签（板块首页面包屑用） */
function groupDefaultLabel(group: NavGroup): string {
  if (group.href === "/market") return "大盘指数";
  if (group.href === "/industry") return "产业链全景";
  if (group.href === "/history") return "历史时间线";
  return "概览";
}

/**
 * 由 pathname（可选 searchParams 支持 ?tab=）解析面包屑路径。
 * 动态路由（文章 / 危机 / 产业链详情 / 政策详情）给出语义化标签。
 */
export function breadcrumbsFor(pathname: string, searchParams?: URLSearchParams | null): Crumb[] {
  const base: Crumb[] = [{ href: "/", label: "首页" }];

  // 首页与认证页不显示面包屑
  if (pathname === "/" || pathname === "/login" || pathname === "/register") return [];

  const group = NAV.find((g) => pathname === g.href || pathname.startsWith(`${g.href}/`));
  if (group) {
    const gCrumb: Crumb = { href: group.href, label: group.label };
    const rest = pathname.slice(group.href.length + 1);
    const tab = searchParams?.get("tab");

    // 板块首页：带 tab 时用子模块标签（如 /market?tab=stocks → 个股行情）
    if (pathname === group.href) {
      if (tab) {
        const child = group.children.find((c) => c.href === `${group.href}?tab=${tab}`);
        return [...base, gCrumb, { label: child?.label ?? groupDefaultLabel(group) }];
      }
      return [...base, gCrumb, { label: groupDefaultLabel(group) }];
    }

    // 直系子模块（/macro/feeling 等）
    const directChild = group.children.find((c) => c.href.split("?")[0] === pathname);
    if (directChild) return [...base, gCrumb, { href: directChild.href, label: directChild.label }];

    // 动态详情
    if (group.href === "/industry" && rest) return [...base, gCrumb, { label: "产业链详情" }];
    if (group.href === "/history" && rest) return [...base, gCrumb, { label: "危机重演" }];
    if (group.href === "/gmrds" && rest) {
      if (rest === "roadmap") return [...base, gCrumb, { label: "迭代路线图" }];
      return [...base, gCrumb, { label: "学院详情" }];
    }

    return [...base, gCrumb, { label: rest || groupDefaultLabel(group) }];
  }

  // 独立页
  const standalone: Record<string, Crumb[]> = {
    "/search": [...base, { label: "全局搜索" }],
    "/about": [...base, { label: "关于我们" }],
    "/disclaimer": [...base, { label: "免责声明" }],
    "/privacy": [...base, { label: "隐私政策" }],
    "/account": [...base, { label: "个人账户" }],
  };
  if (standalone[pathname]) return standalone[pathname];

  // 文章 / 政策详情
  if (pathname.startsWith("/article/")) return [...base, { label: "AI 分析报告" }, { label: "文章详情" }];
  if (pathname.startsWith("/policy/")) return [...base, { href: "/policy", label: "政策解读" }];

  return base;
}
