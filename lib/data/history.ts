import events from "@/data/history-events.json";
import worldEvents from "@/data/history-world.json";

export type HistoryRegion =
  | "cn" | "asia" | "west" | "africa" | "america" | "oceania" | "global";

export type HistoryEvent = {
  year: number;
  region: HistoryRegion;
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

export const HISTORY_EVENTS = [...events, ...worldEvents] as HistoryEvent[];

export const REGIONS = [
  { key: "all", label: "全部地区" },
  { key: "cn", label: "中国" },
  { key: "asia", label: "亚洲" },
  { key: "west", label: "西方" },
  { key: "africa", label: "非洲" },
  { key: "america", label: "美洲" },
  { key: "oceania", label: "大洋洲" },
  { key: "global", label: "全球" },
] as const;

export const HISTORY_CATEGORIES = [
  "王朝更替", "制度改革", "战争冲突", "思想文化", "文化艺术", "经济贸易", "技术迭代",
] as const;

export const ERAS = [
  { key: "ancient", label: "古代", range: "公元前 — 公元 500" },
  { key: "medieval", label: "中古", range: "500 — 1500" },
  { key: "modern", label: "近代", range: "1500 — 1900" },
  { key: "contemporary", label: "现代", range: "1900 — 今" },
] as const;

export function eraOf(year: number): string {
  if (year < 500) return "ancient";
  if (year < 1500) return "medieval";
  if (year < 1900) return "modern";
  return "contemporary";
}

export const CAT_TONE: Record<string, string> = {
  王朝更替: "red", 制度改革: "blue", 战争冲突: "purple",
  思想文化: "green", 文化艺术: "cyan", 经济贸易: "amber", 技术迭代: "cyan",
};

export const REGION_TONE: Record<string, string> = {
  cn: "red", asia: "teal", west: "blue",
  africa: "amber", america: "purple", oceania: "green", global: "gray",
};

export const REGION_LABEL: Record<string, string> = {
  cn: "中国", asia: "亚洲", west: "西方",
  africa: "非洲", america: "美洲", oceania: "大洋洲", global: "全球",
};

export const REGION_COLOR: Record<string, string> = {
  cn: "#c8102e", asia: "#0d9488", west: "#2563eb",
  africa: "#d97706", america: "#7c3aed", oceania: "#059669", global: "#6b7280",
};

export function slugOf(e: HistoryEvent): string {
  return `${e.year}-${e.title.replace(/[^\w\u4e00-\u9fa5]/g, "")}`;
}

export function findHistoryBySlug(slug: string): HistoryEvent | undefined {
  return HISTORY_EVENTS.find((e) => slugOf(e) === slug);
}

export function filterHistory(opts: {
  region?: string;
  cat?: string;
  era?: string;
}): HistoryEvent[] {
  const region = opts.region && opts.region !== "all" ? opts.region : "";
  const cat = opts.cat && opts.cat !== "全部" ? opts.cat : "";
  const era = opts.era && opts.era !== "all" ? opts.era : "";
  return HISTORY_EVENTS.filter(
    (e) =>
      (!region || e.region === region) &&
      (!cat || e.category === cat) &&
      (!era || eraOf(e.year) === era)
  ).sort((a, b) => a.year - b.year);
}
