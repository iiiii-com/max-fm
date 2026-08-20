import events from "@/data/history-events.json";

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
  featured?: boolean; // 精选标记：时间轴默认只展示 featured 事件
};

export const HISTORY_EVENTS = events as HistoryEvent[];

export const REGIONS = [
  { key: "all", label: "全部地区" },
  { key: "cn", label: "中国" },
  { key: "west", label: "西方" },
] as const;

export const HISTORY_CATEGORIES = [
  "王朝更替", "制度改革", "战争冲突", "思想文化", "经济贸易", "技术迭代",
] as const;

export const CAT_TONE: Record<string, string> = {
  王朝更替: "red", 制度改革: "blue", 战争冲突: "purple",
  思想文化: "green", 经济贸易: "amber", 技术迭代: "cyan",
};

export const REGION_TONE: Record<string, string> = {
  cn: "red", west: "blue",
};

export const REGION_LABEL: Record<string, string> = {
  cn: "中国", west: "西方",
};

export function slugOf(e: HistoryEvent): string {
  return `${e.year}-${e.title.replace(/[^\w\u4e00-\u9fa5]/g, "")}`;
}

export function findHistoryBySlug(slug: string): HistoryEvent | undefined {
  return HISTORY_EVENTS.find((e) => slugOf(e) === slug);
}

export function filterHistory(opts: { region?: string; cat?: string }): HistoryEvent[] {
  const region = opts.region && opts.region !== "all" ? opts.region : "";
  const cat = opts.cat && opts.cat !== "全部" ? opts.cat : "";
  return HISTORY_EVENTS.filter(
    (e) => (!region || e.region === region) && (!cat || e.category === cat)
  ).sort((a, b) => a.year - b.year);
}