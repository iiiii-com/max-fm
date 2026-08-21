# 四板块整合 + 危机重演实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 把 9+ 页面整合为四大板块（宏观/市场/产业/历史），并在历史板块加入 20 场危机三级案例库 + 交互式重演（虚拟账户+决策测验+真实K线）。

**Architecture:** 板块页为一级路由 + `?tab=` 查询参数切换子视图；子内容组件全部复用现有组件（StockSearch/EtfViewer/NewsPanel 等）；危机重演为独立引擎：静态案例数据（`lib/data/crisis/`）+ 真实K线 API（复用 fetchKline）+ 客户端状态机（节点推进/虚拟账户/决策题）。旧路由重定向到新 tab。

**Tech Stack:** Next.js 16（App Router, async params/searchParams）、React 19、Tailwind v4、echarts（K线/对比图）、better-sqlite3（现有数据层）、东方财富/腾讯公开接口。

**规格来源：** `docs/superpowers/specs/2026-08-19-four-section-integration-design.md`

---

## 文件结构总览

| 文件 | 职责 |
|---|---|
| `components/layout/Header.tsx` | 顶栏 4 项导航（改） |
| `app/page.tsx` | 首页 4 大卡 + 热内容流（改） |
| `components/BoardCard.tsx` | 板块大卡组件（新，含数据预览插槽） |
| `components/BoardTabs.tsx` | 通用 Tab 框架（新：`?tab=` 深链、客户端切换） |
| `app/macro/page.tsx` | 宏观总览：5 tab（改，整合原 macro/policy/cycle/map/advice） |
| `app/market/page.tsx` | 市场洞察：3 tab + 快讯侧栏（新，整合原 invest/stock/etf） |
| `components/MarketIndexes.tsx` | 大盘指数 tab：6 核心指数+指数对比视图（新） |
| `app/industry/page.tsx` | 产业地图：2 tab + 卡片热度标注（改） |
| `app/history/page.tsx` | 历史演进：4 tab（改，整合原 history/cycle 内容） |
| `components/HistoryTimeline.tsx` | 横向滚动时间轴（改，80 精选+启示字段） |
| `lib/data/history.ts` + `data/history-events.json` | 事件加 wave/lesson 字段（改） |
| `lib/data/crisis/types.ts` | 危机案例类型定义（新） |
| `lib/data/crisis/crises.ts` | 20 场案例注册表（新） |
| `lib/data/crisis/2008-subprime.ts` 等 | 6 场完整叙事数据（新） |
| `lib/data/crisis/lesser.ts` | 14 场标准/简版案例（新） |
| `components/crisis/CrisisEngine.tsx` | 重演引擎（新：节点推进+K线+账户+测验） |
| `components/crisis/VirtualAccount.tsx` | 虚拟账户面板（新） |
| `components/crisis/DecisionQuiz.tsx` | 决策测验（新） |
| `app/api/crisis/kline/route.ts` | 危机K线代理（新：按时间窗切片真实K线） |
| `app/api/risk/indicators/route.ts` | 宏观危机预警指标（新） |
| `lib/data/risk.ts` | 预警指标获取（VIX/倒挂/利差/铜金比）（新） |
| `components/IndustryHeatCard.tsx` | 产业链热度卡片（新） |
| `app/api/sector/flow/route.ts` | 已有，链名匹配复用 |
| `middleware.ts` 或各旧路由重定向 | /policy /stock /etf /cycle /map /advice → 板块 tab（新） |

---

## Phase 1: 导航 + 首页 + Tab 框架

### Task 1: 顶栏导航精简为 4 项

**Files:**
- Modify: `components/layout/Header.tsx`

- [ ] **Step 1: 修改 NAV 数组为四大板块**

```tsx
const NAV = [
  { href: "/macro", label: "宏观总览" },
  { href: "/market", label: "市场洞察" },
  { href: "/industry", label: "产业地图" },
  { href: "/history", label: "历史演进" },
];
```

删除 `/policy /stock /etf /cycle /advice` 项。其余 Header 逻辑（pathname 高亮、移动端菜单）不变。

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 成功编译

- [ ] **Step 3: 提交**

```bash
git add components/layout/Header.tsx
git commit -m "nav: 顶栏精简为四大板块"
```

### Task 2: 通用 Tab 框架组件

**Files:**
- Create: `components/BoardTabs.tsx`

- [ ] **Step 1: 创建 BoardTabs 客户端组件**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface TabItem {
  key: string;
  label: string;
}

export default function BoardTabs({ tabs, active, children }: { tabs: TabItem[]; active: string; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setTab = useCallback(
    (key: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (key === tabs[0]?.key) p.delete("tab");
      else p.set("tab", key);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, tabs]
  );
  return (
    <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
            active === t.key ? "border-primary text-primary font-semibold" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: 成功（组件未引用不报错）

- [ ] **Step 3: 提交**

```bash
git add components/BoardTabs.tsx
git commit -m "feat: 通用板块 Tab 框架组件"
```

### Task 3: 首页四大板块大卡

**Files:**
- Create: `components/BoardCard.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: 创建 BoardCard 组件**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export default function BoardCard({
  href, title, desc, icon, accent, children,
}: {
  href: string; title: string; desc: string; icon: ReactNode; accent: string; children?: ReactNode;
}) {
  return (
    <Link href={href} className="card p-5 hover:shadow-md hover:border-primary/40 transition-all group">
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${accent} text-white`}>{icon}</span>
        <h2 className="font-bold text-lg">{title}</h2>
      </div>
      <p className="text-sm text-muted mb-3">{desc}</p>
      {children && <div className="text-xs">{children}</div>}
      <p className="text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">进入 →</p>
    </Link>
  );
}
```

- [ ] **Step 2: 重写首页 MODULES 区域为 4 大卡**

替换 `app/page.tsx` 中 `MODULES` 数组与卡片网格渲染（约 L40-90 的模块网格区），改为：

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <BoardCard href="/macro" title="宏观总览" desc="经济指标 · 政策解读 · 周期洞察 · 经济地图 · 个人建议" accent="bg-blue-600" icon={<Landmark className="w-4.5 h-4.5" />}>
    <p>最新温度：{temp}°C · 情绪指数：{feeling.overall}</p>
  </BoardCard>
  <BoardCard href="/market" title="市场洞察" desc="大盘指数 · 个股行情 · ETF · 资金流 · 快讯" accent="bg-red-600" icon={<TrendingUp className="w-4.5 h-4.5" />}>
    <p>AI 复盘报告每日自动生成</p>
  </BoardCard>
  <BoardCard href="/industry" title="产业地图" desc="22 条产业链 · 景气度 · 资金热度 · 危机冲击案例" accent="bg-purple-600" icon={<Network className="w-4.5 h-4.5" />}>
    <p>{chainsCount} 条主线产业链</p>
  </BoardCard>
  <BoardCard href="/history" title="历史演进" desc="时间线 · 康波全景 · 朝代对照 · 危机重演" accent="bg-emerald-600" icon={<History className="w-4.5 h-4.5" />}>
    <p>{HISTORY_EVENTS.length} 条事件 · {CRISES.length} 场危机重演</p>
  </BoardCard>
</div>
```

保留 Hero、热内容流（文章/政策/温度计）区域不变；删除原 9 模块网格。

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 提交**

```bash
git add components/BoardCard.tsx app/page.tsx
git commit -m "feat: 首页四大板块大卡"
```

---

## Phase 2: 市场板块（/market）

### Task 4: 大盘指数 tab（MarketIndexes）

**Files:**
- Create: `components/MarketIndexes.tsx`

- [ ] **Step 1: 创建 MarketIndexes 组件**

服务端组件（force-dynamic），内容：
1. **核心指数 6 张卡**：上证 000001(1.000001) / 深成 399001(0.399001) / 创业板 399006(0.399006) / 沪深300 000300(1.000300) / 中证500 000905(1.000905) / 恒生 HSI(100.HSI)——复用 `fetchQuotes`/`fetchGlobalQuotes` 数据
2. **指数对比视图**：客户端子组件 `IndexCompareChart`——6 指数近 60 日归一化涨跌曲线（echarts line 多 series，复用 `/api/stock/kline` 拉 `1.000001` 等 secid，归一化到 100 起点）
3. **板块资金流 Top30 表**：复用 MarketDashboard 组件（改为默认折叠为 "资金流总览 ▼" 展开区，避免页面过长）
4. **AI 复盘报告**：复用 invest 页文章区（getArticles daily/weekly）

```tsx
// app/market/page.tsx 结构草案（Phase 2 完成后）：
export default async function MarketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = ["indexes", "stocks", "etf"].includes(tab ?? "") ? tab! : "indexes";
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">市场洞察</h1>
        <p className="text-sm text-muted mt-1">大盘指数 · 个股行情 · ETF · 资金流 · 快讯，数据来自东方财富公开接口</p>
      </header>
      <BoardTabs tabs={TABS} active={active} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {active === "indexes" && <MarketIndexes />}
          {active === "stocks" && <Suspense fallback={<p className="text-sm text-muted">加载中…</p>}><StockSearch /></Suspense>}
          {active === "etf" && <EtfViewer />}
        </div>
        <aside className="space-y-4">
          <NewsPanel />
          <WatchlistSidebar />
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `/market` 页面（indexes+stocks+etf 三 tab + 快讯侧栏）**

`WatchlistSidebar` 用 useWatchlist 展示自选股/自选板块快捷列表（复用 MarketDashboard 中的自选区块逻辑，抽为 `components/WatchlistSidebar.tsx`）。

- [ ] **Step 3: 验证：本地 :3777 冒烟**

```bash
# 重启后
Invoke-WebRequest http://localhost:3777/market -UseBasicParsing            # 200, 含"市场洞察"
Invoke-WebRequest "http://localhost:3777/market?tab=stocks" -UseBasicParsing  # 200
```

- [ ] **Step 4: 提交**

```bash
git add components/MarketIndexes.tsx components/WatchlistSidebar.tsx app/market/page.tsx
git commit -m "feat: 市场板块三 tab + 快讯侧栏"
```

### Task 5: 旧路由重定向（stock/etf/invest）

**Files:**
- Modify: `app/stock/page.tsx`、`app/etf/page.tsx`、`app/invest/page.tsx` → 重定向

- [ ] **Step 1: 三个旧页面改为重定向**

```tsx
// app/stock/page.tsx 整体替换为：
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default function StockRedirect() {
  redirect("/market?tab=stocks");
}
```

同法：`app/etf/page.tsx` → `/market?tab=etf`；`app/invest/page.tsx` → `/market`。

- [ ] **Step 2: 构建 + 提交**

```bash
npm run build
git add app/stock/page.tsx app/etf/page.tsx app/invest/page.tsx
git commit -m "refactor: stock/etf/invest 重定向至市场板块"
```

---

## Phase 3: 产业板块（/industry）

### Task 6: 卡片热度标注 + 双 tab

**Files:**
- Create: `components/IndustryHeatCard.tsx`
- Modify: `app/industry/page.tsx`

- [ ] **Step 1: 创建热度卡片组件**

客户端组件，props: `{ chain: { id, slug, name, description, sentiment }, nodeCount, companyCount, updatedAt }`。内部加载 `/api/sector/flow`（全量 30），按链名模糊匹配（`sectors.find(s => s.name.includes(chain.name) || chain.name.includes(s.name))`），匹配到则显示：当日涨跌% + 主力净流入（复用 fmtMoney）；匹配不到显示"暂无关联板块"。

卡片保持现有 3 列布局与视觉（沿用 Card/Badge），新增一行热度条：

```tsx
<div className="flex items-center gap-2 text-xs mt-2">
  <Badge tone={s ? (s.changePct >= 0 ? "red" : "green") : "gray"}>
    {s ? `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%` : "—"}
  </Badge>
  <span className={`font-mono ${(s?.mainNetIn ?? 0) >= 0 ? "up" : "down"}`}>
    {s ? `主力 ${fmtMoney(s.mainNetIn)}` : "暂无板块行情"}
  </span>
</div>
```

- [ ] **Step 2: industry 页改双 tab**

- `overview`（默认）：现有全景图区（ChainGraphViewer 保留）
- `chains`：22 条链卡片网格（IndustryHeatCard）
- 顶部加 BoardTabs（tabs: overview/chains）；URL `?tab=` 深链；页面整体改为服务端读 searchParams（async）决定渲染哪个 tab；卡片区改为客户端组件容器（因需 fetch 资金流）

- [ ] **Step 3: 构建 + 冒烟**

```bash
npm run build
Invoke-WebRequest "http://localhost:3777/industry?tab=chains" -UseBasicParsing  # 200
```

- [ ] **Step 4: 提交**

```bash
git add components/IndustryHeatCard.tsx app/industry/page.tsx
git commit -m "feat: 产业板块双 tab + 卡片热度标注"
```

---

## Phase 4: 历史板块整合

### Task 7: 事件数据加 wave/lesson 字段

**Files:**
- Modify: `lib/data/history.ts`
- Modify: `data/history-events.json`

- [ ] **Step 1: 类型扩展 + 精选标记**

```ts
export type HistoryEvent = {
  year: number;
  region: "cn" | "west";
  category: string;
  title: string;
  summary: string;
  detail: string;
  figures: string;
  impact: string;
  source: string;
  wave?: number;      // 康波波次 1-6，无则 undefined
  lesson?: string;    // "对今日启示"，仅精选事件有
  featured?: boolean; // 精选事件标记（时间轴只展示精选）
};
```

- [ ] **Step 2: 更新 JSON**

- 205 条中标记 ~80 条 `featured: true`（保留全部数据，时间轴默认只显示 featured）
- 其中 40 条核心事件写 `lesson`（1 行，如 2008 金融海啸："杠杆驱动的繁荣终将均值回归，警惕高杠杆行业在信用收缩期的估值杀"）
- 波次标注：1929/1973/2000/2008/2020 等典型事件补 `wave`

- [ ] **Step 3: 提交**

```bash
git add lib/data/history.ts data/history-events.json
git commit -m "feat: 历史事件加波次与启示字段"
```

### Task 8: 横向时间轴组件

**Files:**
- Create: `components/HistoryAxis.tsx`
- Modify: `app/history/page.tsx`

- [ ] **Step 1: 创建 HistoryAxis 客户端组件**

props: `{ events: HistoryEvent[] }`。echarts 实现横向时间轴：
- x 轴=年份（线性 scale），y 轴=事件（按 region 分两行：cn 在上，west 在下）
- 每个事件一个 scatter 点，点大小=featured?10:6；点击点 → 下方详情卡片（标题/年份/摘要/启示/波次徽标）
- 顶部为时间线主视图，下方为选中事件详情 + 现有筛选器（region/cat）保留
- 默认只显示 featured 事件，筛选取消精选限制

```tsx
// 核心 series 结构
series: [
  { name: "中国", type: "scatter", data: cnPoints, symbolSize: (v: any) => v[2], itemStyle: { color: "#c8102e" } },
  { name: "西方", type: "scatter", data: westPoints, symbolSize: (v: any) => v[2], itemStyle: { color: "#2563eb" } },
]
// 每个点 [year, 0|1, size, { title, lesson, wave, summary }]，click 事件取 params.data
```

- [ ] **Step 2: history 页改四 tab**

```tsx
// app/history/page.tsx
const TABS = [
  { key: "timeline", label: "时间线" },
  { key: "crisis", label: "危机重演" },
  { key: "waves", label: "康波全景" },
  { key: "dynasties", label: "朝代对照" },
];
```

- timeline（默认）：筛选器 + HistoryAxis + 事件详情卡
- waves：迁移原 `/cycle` 的 KonratiefWaves + CURRENT_POSITION 区块
- dynasties：迁移 DynastyTable
- crisis：Phase 5 完成前显示占位"危机重演建设中"；完成后挂 CrisisEngine

- [ ] **Step 3: 构建 + 冒烟**

```bash
npm run build
Invoke-WebRequest "http://localhost:3777/history" -UseBasicParsing  # 200
Invoke-WebRequest "http://localhost:3777/history?tab=waves" -UseBasicParsing  # 200
```

- [ ] **Step 4: 提交**

```bash
git add components/HistoryAxis.tsx app/history/page.tsx app/cycle/page.tsx
git commit -m "feat: 历史板块四 tab + 横向时间轴"
```

---

## Phase 5: 危机案例库

### Task 9: 危机类型与注册表

**Files:**
- Create: `lib/data/crisis/types.ts`
- Create: `lib/data/crisis/crises.ts`

- [ ] **Step 1: 类型定义**

```ts
export type CrisisLevel = "major" | "standard" | "brief"; // 特大/标准/简版

export interface CrisisNode {
  date: string;          // YYYY-MM-DD
  title: string;         // 节点标题
  story: string;         // 叙事：当时发生了什么（2-4 句）
  policy?: string;       // 政策/监管背景
  quiz?: {               // 决策测验（可选，major 场 3-5 题）
    question: string;
    options: string[];
    answer: number;      // 正确选项 index
    insight: string;     // 专业点评（无论对错都显示）
  };
  marketNote?: string;   // 该节点市场表现说明
}

export interface CrisisCohort {   // 虚拟账户对照群体
  label: string;         // "满仓持有" / "巴菲特式操作"
  description: string;
}

export interface Crisis {
  id: string;            // "2008-subprime"
  title: string;         // "2008 美国次贷危机"
  level: CrisisLevel;
  period: [string, string]; // [start, end]
  markets: Array<{ name: string; secid: string; color?: string }>; // 回放指数
  heroStory: string;     // 开场叙事：当时的世界
  nodes: CrisisNode[];
  impact: string;        // 对股市实际影响总结
  advice: string[];      // 专业建议列表（识别信号/应对策略）
  cohorts: CrisisCohort[];
  snapshotData?: Record<string, Array<{ date: string; value: number }>>; // 2000 年前人工点位
}

export const CRISES: Crisis[] = [];
```

- [ ] **Step 2: 注册表**

```ts
import { Crisis } from "./types";
import { subprime2008 } from "./2008-subprime";
// ... 其他完整案例
import { lesserCrises } from "./lesser";

export const CRISES: Crisis[] = [subprime2008, /* 6 场完整 */, ...lesserCrises];
export function getCrisis(id: string): Crisis | undefined {
  return CRISES.find((c) => c.id === id);
}
```

- [ ] **Step 3: 提交**

```bash
git add lib/data/crisis/types.ts lib/data/crisis/crises.ts
git commit -m "feat: 危机案例库类型与注册表"
```

### Task 10: 6 场完整案例叙事数据

**Files:**
- Create: `lib/data/crisis/2008-subprime.ts`（完整示例，10-15 节点）
- Create: `lib/data/crisis/2015-ashare-crash.ts`
- Create: `lib/data/crisis/2020-covid-crash.ts`
- Create: `lib/data/crisis/1929-great-depression.ts`（人工点位）
- Create: `lib/data/crisis/1997-asian-crisis.ts`（人工点位）
- Create: `lib/data/crisis/2000-dotcom-bubble.ts`（人工点位+真实K线可选）

- [ ] **Step 1: 2008 次贷完整示例**

数据要点（真实历史）：
- markets: 标普500 `100.SPX`（东财 secid）、上证指数 `1.000001`
- 节点（10-12 个）：2007-02-27 汇丰预警与全球首震 / 2007-08-09 法国巴黎银行冻结基金 / 2007-09-14 北岩银行挤兑 / 2008-03-16 贝尔斯登被摩根大通收购 / 2008-07 房利美房地美危机 / 2008-09-15 雷曼兄弟破产 / 2008-09-17 AIG 救助 / 2008-10-03 7000 亿 TARP 通过 / 2008-11 美联储 QE1 启动 / 2009-03-09 标普 666 见底 / 2009-12 复苏确认
- 决策题 3-5 道：如"2008-09-15 雷曼破产次日，你持有标普 ETF，抛不抛？"
- impact: 标普 500 从 1565 → 666（-57%），17 个月见底，4 年回本；上证从 5522 → 1664（-70%）
- advice: 收益率曲线倒挂预警 / 信用利差飙升是领先信号 / 流动性危机中现金为王 / 恐慌抛售 vs 均值回归

- [ ] **Step 2-6: 其余 5 场**（同样的完整结构；1929/1997/2000 用 snapshotData 人工点位，如道琼斯 1929-10 381→1932-07 41）

- [ ] **Step 7: 构建验证**

```bash
npm run build
```

- [ ] **Step 8: 提交**

```bash
git add lib/data/crisis/
git commit -m "feat: 6 场完整危机叙事数据"
```

### Task 11: 14 场标准/简版案例

**Files:**
- Create: `lib/data/crisis/lesser.ts`

- [ ] **Step 1: 数据**

8 场 standard（5-8 节点 + impact + advice 简短版）：1987 黑色星期一（人工点位）/ 1998 俄罗斯违约LTCM / 2011 欧债 / 2013 钱荒 / 2016 熔断 / 2018 贸易战 / 2022 美联储加息 / 2023 硅谷银行
6 场 brief（3-5 节点 + impact 数据）：2004 中航油 / 2007 中石油 / 2018 中石化联合石化 / 2021 恒大 / 2019 包商银行 / 2014 油价暴跌
standard 场 markets 用真实 secid（2013/2016/2018/2022/2023 均可拉真实K线）；2011 用 `100.SPX`。

- [ ] **Step 2: 构建 + 提交**

```bash
npm run build
git add lib/data/crisis/lesser.ts
git commit -m "feat: 14 场标准与简版危机案例"
```

---

## Phase 6: 危机重演引擎

### Task 12: 危机K线 API

**Files:**
- Create: `app/api/crisis/kline/route.ts`

- [ ] **Step 1: 实现**

```ts
// GET /api/crisis/kline?secid=100.SPX&from=2007-01-01&to=2009-12-31
import { NextResponse } from "next/server";
import { fetchKline } from "@/lib/data/kline";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const bars = await fetchKline(secid, 2000); // 最多 2000 日（8 年）
  if (!bars?.length) return NextResponse.json({ error: "K 线不可用" }, { status: 502 });
  const filtered = bars.filter((b) => (!from || b.date >= from) && (!to || b.date <= to));
  return NextResponse.json({ ok: true, bars: filtered });
}
```

- [ ] **Step 2: 验证接口（2008 上证）**

```bash
# 本地 :3777
Invoke-WebRequest "http://localhost:3777/api/crisis/kline?secid=1.000001&from=2008-01-01&to=2008-12-31" -UseBasicParsing
# 期望 200 + bars 长度 ~240
```

- [ ] **Step 3: 提交**

```bash
git add app/api/crisis/kline/route.ts
git commit -m "feat: 危机K线时间窗 API"
```

### Task 13: 重演引擎主组件

**Files:**
- Create: `components/crisis/CrisisEngine.tsx`
- Create: `components/crisis/VirtualAccount.tsx`
- Create: `components/crisis/DecisionQuiz.tsx`

- [ ] **Step 1: VirtualAccount**

```tsx
"use client";
// props: { initialCapital: number; marketName: string }
// 状态: { cash: number; position: number /* 0-1 仓位 */; nav: number }
// 每个节点回调 onStep(prevNav, newNav): 按节点间指数涨跌幅 × 仓位 计算盈亏
// 展示: 总资产 / 现金 / 仓位条 / 累计收益%（红绿）
```

- [ ] **Step 2: DecisionQuiz**

```tsx
"use client";
// props: { quiz: { question, options, answer, insight }, onAnswer: (correct: boolean) => void }
// 状态: answered?: number | null
// 选择后显示对错 + insight 专业点评；onAnswer 通知引擎累计测验分
```

- [ ] **Step 3: CrisisEngine 主组件**

```tsx
"use client";
// props: { crisis: Crisis }
// 状态机: stepIndex(当前节点) / account(虚拟账户) / quizScore / finished
// 流程:
// 1. 开场: heroStory + 市场环境 + 100 万账户初始化 + markets 选择（首个指数为默认）
// 2. 加载真实K线: /api/crisis/kline?secid=...&from=period[0]&to=period[1]
// 3. 节点推进: 每节点展示 叙事+政策+K线图（当前时点 markLine 标记）+ 可选决策题 + 账户面板（可调仓位）
// 4. 节点间K线动画: 点"推进" → K线高亮线从上一节点日期移动到本节点
// 5. 结束: impact + advice 列表 + 账户对照（你的资产 vs 满仓 vs 巴菲特式操作）+ 测验评分 + 复盘
// 6. "重新经历" 按钮重置状态
```

关键实现：K 线图用 echarts candlestick + dataZoom，`markLine` 标注当前节点日期；虚拟账户按节点间指数收益率计算：

```ts
// 账户计算（每步推进时）：
// prevNav × (1 + (idxClose - prevIdxClose) / prevIdxClose × position) = newNav
```

- [ ] **Step 4: 挂载到 history 页 crisis tab**

`app/history/page.tsx` 的 crisis tab 渲染：危机列表（20 场分级卡片，点击进入重演）+ 选中危机 → CrisisEngine。

- [ ] **Step 5: 构建 + 冒烟**

```bash
npm run build
Invoke-WebRequest "http://localhost:3777/history?tab=crisis" -UseBasicParsing  # 200
```

- [ ] **Step 6: 提交**

```bash
git add components/crisis/ app/history/page.tsx
git commit -m "feat: 危机重演引擎（节点推进+虚拟账户+决策测验）"
```

---

## Phase 7: 各板块深化

### Task 14: 宏观危机预警指标

**Files:**
- Create: `lib/data/risk.ts`
- Create: `app/api/risk/indicators/route.ts`
- Create: `components/RiskIndicators.tsx`
- Modify: `app/macro/page.tsx`

- [ ] **Step 1: risk.ts 数据获取**

```ts
// 东财接口拉取（真实值，失败降级为最新已知值+标注"延迟"）：
// VIX 恐慌指数: secid 100.VIX → push2 /api/qt/stock/get fields f43
// 美债 10Y-2Y 倒挂: 需收益率曲线数据（东财 f152/f153 或降级：人工维护的最新值）
// 信用利差: 降级为人工维护
// 铜金比: 伦敦金 119.GC00Y + 铜 119.HG00Y，计算比值
export interface RiskIndicator {
  key: string; label: string; value: number; unit: string;
  level: "low" | "mid" | "high";  // 基于阈值
  note: string; stale?: boolean;
}
// VIX: <15 low, 15-25 mid, >25 high
// 10Y-2Y: >0 low, -50~0 mid, <-50 high
// 铜金比: >8 low(风险偏好高), 4-8 mid, <4 high
```

- [ ] **Step 2: RiskIndicators 组件**

4 张指标卡：数值 + 等级徽标（低/中/高恐慌色）+ 说明 + 历史极端值对照（如"2008 峰值 89"）。加入 macro 页新 tab 或指标区顶部（放 indicators tab 顶部区块）。

- [ ] **Step 3: 构建 + 提交**

```bash
npm run build
git add lib/data/risk.ts app/api/risk/indicators/route.ts components/RiskIndicators.tsx app/macro/page.tsx
git commit -m "feat: 宏观危机预警指标"
```

### Task 15: 市场危机对比 + 产业冲击案例

**Files:**
- Create: `components/CrisisImpactTable.tsx`
- Modify: `components/MarketIndexes.tsx`
- Modify: `components/IndustryHeatCard.tsx`

- [ ] **Step 1: CrisisImpactTable**

从 CRISES 数据生成表格：危机名 / 级别 / 时间窗 / 主指数跌幅（从 impact 字段提取或独立字段）/ 复苏时间。挂载到 MarketIndexes 的复盘报告下方，标题"历史危机对指数的实际影响"。

- [ ] **Step 2: IndustryHeatCard 加冲击案例**

6 条核心链（新能源车/半导体/AI/光伏/创新药/低空经济）的关联危机案例，加在卡片详情入口：卡片新增一行"历史冲击：2008 半导体 -57% / 2015 新能源 -60%"。数据维护在 `lib/data/crisis/chainImpact.ts`（新文件：链名 → 危机冲击记录数组）。

- [ ] **Step 3: 构建 + 提交**

```bash
npm run build
git add components/CrisisImpactTable.tsx components/MarketIndexes.tsx components/IndustryHeatCard.tsx lib/data/crisis/chainImpact.ts
git commit -m "feat: 市场危机对比表 + 产业链冲击案例"
```

---

## Phase 8: 收尾

### Task 16: 全量验证 + 部署

**Files:**
- 无新文件（验证与发布）

- [ ] **Step 1: 构建**

```bash
npm run build
```

- [ ] **Step 2: 本地全量冒烟**

```bash
# 重启 :3777 后依次验证：
/macro?tab=policy /macro?tab=cycle /macro?tab=map /macro?tab=advice   # 各 200
/market?tab=stocks /market?tab=etf                                     # 各 200
/industry?tab=overview /industry?tab=chains                            # 各 200
/history?tab=timeline /history?tab=crisis /history?tab=waves /history?tab=dynasties  # 各 200
/api/crisis/kline?secid=1.000001&from=2015-01-01&to=2015-12-31         # 200 有 bars
/api/risk/indicators                                                   # 200
```

- [ ] **Step 3: 提交 + 推送**

```bash
git reset data/max.db-shm data/max.db-wal
git add -A
git commit -m "feat: 四板块整合 + 危机重演全量上线"
git push origin main
```

- [ ] **Step 4: 生产冒烟（代理）**

```bash
curl.exe -s -m 60 -x http://127.0.0.1:10793 "https://max-fm.vercel.app/market" -o NUL -w "%{http_code}"      # 200
curl.exe -s -m 60 -x http://127.0.0.1:10793 "https://max-fm.vercel.app/history?tab=crisis" -o NUL -w "%{http_code}"  # 200
curl.exe -s -m 60 -x http://127.0.0.1:10793 "https://max-fm.vercel.app/api/crisis/kline?secid=1.000001&from=2008-01-01&to=2008-12-31"
# 验证 bars 数组长度 > 200
```

---

## 自查结论

- **Spec 覆盖**：四板块整合（T1-3 导航首页、T4-5 市场、T6 产业、T7-8 历史）、危机重演（T9-11 数据、T12-13 引擎）、各板块深化（T14-15）、部署（T16）——全覆盖。
- **类型一致性**：Crisis/CrisisNode 类型在 T9 定义、T10-11 使用、T13 消费，签名一致；HistoryEvent 扩展在 T7。
- **无占位符**：所有任务含具体文件与验证命令。
- **范围**：单一大计划（16 任务），按 Phase 推进，每 Phase 可独立验收。