export type CrisisLevel = "major" | "standard" | "brief";

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
  impact: string;
  advice: string[];
  cohorts: CrisisCohort[];
  snapshotData?: Record<string, Array<{ date: string; value: number }>>;
  stocks?: Array<{ name: string; secid: string; role: string }>;
  vixData?: Array<{ date: string; value: number }>;
  context?: Array<{ date: string; event: string }>;
}