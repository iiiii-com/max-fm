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
  stocks?: Array<{ name: string; secid: string; role: string; nameOnly?: boolean }>;
  vixData?: Array<{ date: string; value: number }>;
  context?: Array<{ date: string; event: string }>;
}