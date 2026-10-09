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
  LayoutGrid,
  Waypoints,
  ShieldAlert,
  Waves,
  Search,
  User,
  Compass,
  Workflow,
  Library,
  BookOpenCheck,
  Wrench,
  TestTubes,
  Gem,
  Scale,
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
  /**
   * 子模块列表。**为空数组表示该板块没有下级**，Header 会渲染成直接链接
   * （不显示展开箭头、不弹出下拉面板）。
   * 不要再为「只有 1 个子项」的板块保留下拉 —— 那等于让用户白点一次。
   */
  children: NavChild[];
}

export const NAV: NavGroup[] = [
  {
    href: "/macro",
    label: "宏观总览",
    desc: "经济指标 · 政策 · 地图 · 个人建议",
    icon: Landmark,
    children: [
      { href: "/macro", label: "宏观仪表盘", desc: "GDP / CPI / PMI / M2 核心指标", icon: LayoutDashboard },
      { href: "/macro/feeling", label: "温度 vs 体感", desc: "宏观温度与个人体感温差", icon: Thermometer },
      { href: "/policy", label: "政策解读", desc: "政策库 + 三层 AI 视角", icon: ScrollText },
      { href: "/map", label: "经济分布图", desc: "31 省经济数据地图", icon: MapPinned },
      { href: "/advice", label: "个人建议", desc: "问卷生成资产配置建议", icon: ClipboardList },
    ],
  },
  {
    href: "/market",
    label: "市场洞察",
    desc: "指数 · 板块 · 个股 · ETF · 对比",
    icon: TrendingUp,
    children: [
      { href: "/market", label: "大盘指数", desc: "指数行情 · 板块资金流", icon: Gauge },
      { href: "/sector", label: "板块中心", desc: "板块行情 · 资金 · 成分股", icon: LayoutGrid },
      { href: "/market?tab=stocks", label: "个股行情", desc: "K 线 + 资金双图联动", icon: CandlestickChart },
      /**
       * 必须指向 `/market?tab=etf` 而不是 `/etf`：
       * `/etf` 只是一个 302 重定向到 `/market?tab=etf` 的别名页，
       * 而面包屑是按 `href === "/market?tab=etf"` 匹配子项的。
       * 旧配置写 `/etf` 导致 ETF tab 匹配不到任何子项，回退显示成「大盘指数」——
       * 于是 /etf 页面的面包屑是「首页 / 市场洞察 / 大盘指数」，但内容是 ETF 专区。
       */
      { href: "/market?tab=etf", label: "ETF 专区", desc: "ETF 行情与持仓透视", icon: LineChart },
      { href: "/compare", label: "对比中心", desc: "股票 · 指数 · ETF 跨类对比", icon: GitCompareArrows },
    ],
  },
  {
    href: "/industry",
    label: "产业地图",
    desc: "产业链上中下游泳道 · 景气度 · 资金热度",
    icon: Network,
    // 该板块目前只有 1 个页面，因此不再做下拉（原先下拉里只有一项，属于多余交互层级）
    children: [],
  },
  {
    href: "/history",
    label: "历史演进",
    desc: "牛熊 · 康波 · 周期机制",
    icon: History,
    children: [
      { href: "/history", label: "牛熊周期", desc: "A 股 21 轮牛熊 · 危机重演", icon: ShieldAlert },
      { href: "/history?tab=waves", label: "康波全景", desc: "六波技术革命 · 当前位置", icon: Waves },
      { href: "/analysis/cycle-anatomy", label: "周期解剖", desc: "熊市深度 · 修复时长 · 驱动机制", icon: Waypoints },
    ],
  },
  {
    href: "/gmrds",
    label: "研究体系",
    desc: "决策流程 · 真实案例 · 工具箱",
    icon: Compass,
    children: [
      { href: "/lab", label: "K线实验室", desc: "任意标的 · 八大实操模块", icon: TestTubes },
      { href: "/gmrds", label: "体系总览", desc: "四大阶段 · 十一环节决策链", icon: Library },
      { href: "/gmrds/flow", label: "环节实操", desc: "步骤 · 标准 · 工具 · 治理", icon: Workflow },
      { href: "/gmrds/cases", label: "真实案例", desc: "安然 · 雷曼 · 特斯拉 · 瑞幸", icon: BookOpenCheck },
      { href: "/gmrds/toolkit", label: "经典工具箱", desc: "K线 / 雷达 / 估值 / 回撤", icon: Wrench },
    ],
  },
  {
    /**
     * 专业版必须是**一级导航**：它的能力分散在政策、组合、板块、导出各处，
     * 没有一个统一入口的话，用户只会看到零散的锁定提示，
     * 拼不出"专业版到底是什么"这件事 —— 那壁垒就等于不存在。
     */
    href: "/pro",
    label: "专业版",
    desc: "深度解读 · 组合风控 · 批量计算 · 研究留档",
    icon: Gem,
    children: [
      { href: "/pro", label: "工作台", desc: "四个分区 · 能力与入口", icon: LayoutGrid },
      { href: "/pricing", label: "能力对照", desc: "普通版与专业版逐项对比", icon: Scale },
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

/**
 * 板块首页的末级标签。
 *
 * 不再逐个板块写死（原先 /market /industry /history 三个特例，其余一律回退「概览」），
 * 那会让面包屑和导航下拉各写一份标签然后慢慢漂移 ——
 * 实际就漂了：/macro 在下拉里叫「宏观仪表盘」，面包屑却显示「概览」；
 * /gmrds 下拉叫「体系总览」，面包屑也是「概览」。
 *
 * 现在的规则只有一条：板块首页若有**同名子项**（href 与板块一致），就用它的标签，
 * 于是面包屑与下拉永远是同一个词，改一处就同步。
 */
function groupDefaultLabel(group: NavGroup): string {
  const self = group.children.find((c) => c.href === group.href);
  if (self) return self.label;
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
      // 无下级的板块只有一层：再追加一个同名层级会变成「首页 / 产业地图 / 产业地图」
      if (group.children.length === 0) return [...base, gCrumb];
      return [...base, gCrumb, { label: groupDefaultLabel(group) }];
    }

    // 直系子模块（/macro/feeling 等）
    const directChild = group.children.find((c) => c.href.split("?")[0] === pathname);
    if (directChild) return [...base, gCrumb, { href: directChild.href, label: directChild.label }];    // 动态详情
    if (group.href === "/industry" && rest) return [...base, gCrumb, { label: "产业链详情" }];
    if (group.href === "/history" && rest) return [...base, gCrumb, { label: "危机重演" }];
    if (group.href === "/gmrds" && rest) {
      if (rest === "roadmap") return [...base, gCrumb, { label: "迭代路线图" }];
      return [...base, gCrumb, { label: "学院详情" }];
    }

    return [...base, gCrumb, { label: rest || groupDefaultLabel(group) }];
  }

  // 跨组子模块直链：/sector、/map、/etf、/compare 等不以所属组前缀开头，需单独匹配
  for (const g of NAV) {
    const child = g.children.find((c) => c.href.split("?")[0] === pathname);
    if (child) return [...base, { href: g.href, label: g.label }, { label: child.label }];
  }

  // 独立页
  const standalone: Record<string, Crumb[]> = {
    "/search": [...base, { label: "全局搜索" }],
    "/about": [...base, { label: "关于我们" }],
    "/disclaimer": [...base, { label: "免责声明" }],
    "/privacy": [...base, { label: "隐私政策" }],
    "/account": [...base, { label: "个人账户" }],
    "/analysis/bullbear": [...base, { href: "/market", label: "市场洞察" }, { label: "牛熊深度分析" }],
    "/analysis/cycle-anatomy": [...base, { href: "/history", label: "历史演进" }, { label: "周期解剖" }],
    "/cycle": [...base, { label: "牛熊周期" }],
  };
  if (standalone[pathname]) return standalone[pathname];

  // 文章 / 政策详情
  if (pathname.startsWith("/article/")) return [...base, { label: "AI 分析报告" }, { label: "文章详情" }];
  if (pathname.startsWith("/policy/")) return [...base, { href: "/policy", label: "政策解读" }];

  return base;
}
