/**
 * 来源声明：本文件危机历史数据基于公开史料与权威历史记录整理（如美联储历史数据、
 * 道琼斯/标普历史行情、公开学术与史料文献），数值可能存在历史口径差异；
 * 阶段 K 线由行情接口实时绘制。核验日期：2026-08-25。
 */
export type CrisisLevel = "major" | "standard" | "brief";

export type Regime = "crash" | "rally" | "range";

export interface InvestorMove {
  label: string;
  stance: "cut" | "hold" | "buy";
  desc: string;
  outcome: string;
}

export interface GlobalMarketPoint {
  name: string;
  change: number; // percentage change during this stage, e.g. -0.236 = -23.6%
  note?: string;
}

export interface CrisisStage {
  name: string;
  regime: Regime;
  from: string;
  to: string;
  narrative: string;
  moves: InvestorMove[];
  bestMove: number;
  globalMarkets?: GlobalMarketPoint[];
  /** 本阶段全球市场联动小结（跨市场/跨地区的传导逻辑） */
  globalSummary?: string;
  /** 本阶段场景化策略（针对该历史阶段的差异化应对） */
  strategy?: string;
  /** 可执行等级：A 高确定性 / B 中等 / C 需谨慎 */
  grade?: "A" | "B" | "C";
  /** 历史成功率 / 胜率区间 */
  winRate?: string;
  /** 该策略最大回撤幅度 */
  drawdown?: string;
}

export interface CrisisNode {
  date: string;
  title: string;
  story: string;
  policy?: string;
  news?: string[];
  quiz?: {
    question: string;
    options: string[];
    answer: number;
    insight: string;
  };
  marketNote?: string;
}

export interface CrisisCohort {
  label: string;
  description: string;
}

/** 危机全景叙事（结构遵循《危机叙事创作提示词》） */
export interface CrisisNarrative {
  /** 开篇数据速览卡 */
  dataCard?: Array<{ label: string; value: string }>;
  /** 第一部分：危机前夜 */
  prelude?: {
    marketEnv: string;
    world: string;
  };
  /** 第二部分：危机全景 */
  roots?: string;
  timeline?: Array<{ date: string; event: string; impact: string }>;
  aftermath?: string;
}

export interface Crisis {
  id: string;
  title: string;
  level: CrisisLevel;
  period: [string, string];
  markets: Array<{ name: string; secid: string }>;
  heroStory: string;
  nodes: CrisisNode[];
  stages?: CrisisStage[];
  impact: string;
  advice: string[];
  cohorts: CrisisCohort[];
  snapshotData?: Record<string, Array<{ date: string; value: number }>>;
  /** 内置历史 K 线（月度/周度 OHLC，key=市场名）：在线接口覆盖不到的历史时期使用 */
  snapshotKline?: Record<string, Array<{ date: string; open: number; close: number; high: number; low: number }>>;
  stocks?: Array<{ name: string; secid: string; role: string; nameOnly?: boolean }>;
  vixData?: Array<{ date: string; value: number }>;
  context?: Array<{ date: string; event: string }>;
  narrative?: CrisisNarrative;
}