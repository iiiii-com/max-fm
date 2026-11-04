/**
 * 数据溯源（Provenance）纯函数层。
 *
 * 为什么拆出来：数据血统的判断规则（多大年龄算「延迟」、什么情况算「示例数据」、
 * 空表算不算「不可用」）是**业务口径**，必须能被单元测试钉住；如果写进页面组件里，
 * 规则会随 UI 改动漂移，最后没人说得清「陈旧」到底是几天。
 *
 * 这里不 import 任何 DB / Next / React 代码，方便 `tests/*.test.ts` 直接断言。
 */

/** 数据集状态：用户在第一屏就能一眼看懂的六档。 */
export type ProvenanceStatus =
  /** 新鲜：最近一次更新在预期周期内 */
  | "live"
  /** 延迟：超出了常规节奏，但还没到「陈旧」 */
  | "delayed"
  /** 陈旧：超过一个以上完整周期没更新，需要人工排查 */
  | "stale"
  /** 示例数据：库里是 seed 的演示序列，不是真实来源 */
  | "seed"
  /** 不可用：空表、查询失败、上游停更 */
  | "down"
  /** 实时接口：不落库，按 TTL 现取，没有「上次更新时间」可展示 */
  | "stream";

/** 数据性质：决定页面文案与「失真风险」提示。 */
export type ProvenanceKind =
  /** 官方发布（统计局 / 央行 / 部委官网） */
  | "official"
  /** 公开行情接口（东财 / 腾讯 / 新浪） */
  | "market"
  /** 资讯媒体 */
  | "media"
  /** 站内整理或由其它数据计算得出 */
  | "derived"
  /** 种子 / 演示数据 */
  | "seed"
  /** 用户提交（问卷、自选） */
  | "user";

export interface Cadence {
  /** 展示文案，如「每日」 */
  label: string;
  /** 超过这个年龄算「延迟」 */
  warnMs: number;
  /** 超过这个年龄算「陈旧」 */
  staleMs: number;
}

export type CadenceKey = keyof typeof CADENCE;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const CADENCE = {
  realtime: { label: "实时（秒级缓存）", warnMs: 10 * MINUTE, staleMs: 2 * HOUR },
  intraday: { label: "盘中定时", warnMs: 2 * HOUR, staleMs: DAY },
  daily: { label: "每日", warnMs: 36 * HOUR, staleMs: 7 * DAY },
  weekly: { label: "每周", warnMs: 10 * DAY, staleMs: 30 * DAY },
  monthly: { label: "每月", warnMs: 45 * DAY, staleMs: 100 * DAY },
  quarterly: { label: "每季", warnMs: 120 * DAY, staleMs: 400 * DAY },
  yearly: { label: "每年", warnMs: 400 * DAY, staleMs: 800 * DAY },
  ondemand: { label: "随提交更新", warnMs: 30 * DAY, staleMs: 180 * DAY },
} satisfies Record<string, Cadence>;

/** 由「数据年龄」判定状态；ageMs 为 null 表示还没有可信的更新时间。 */
export function statusFromAge(ageMs: number | null, cadence: Cadence): ProvenanceStatus {
  if (ageMs === null || !Number.isFinite(ageMs) || ageMs < 0) return "down";
  if (ageMs <= cadence.warnMs) return "live";
  if (ageMs <= cadence.staleMs) return "delayed";
  return "stale";
}

/** 由「表行数 + 最近更新时间」判定状态。空表/查询失败一律算不可用。 */
export function statusFromMetric(
  metric: { rows: number | null; lastUpdated: number | null },
  cadence: Cadence,
  nowMs = Date.now()
): ProvenanceStatus {
  if (metric.rows === null) return "down";
  if (metric.rows <= 0) return "down";
  if (metric.lastUpdated === null || !Number.isFinite(metric.lastUpdated)) return "down";
  return statusFromAge(nowMs - metric.lastUpdated, cadence);
}

/** 把毫秒年龄转成「12 分钟前 / 3 小时前 / 2 天前」。 */
export function formatAge(ageMs: number | null): string {
  if (ageMs === null || !Number.isFinite(ageMs)) return "—";
  const abs = Math.max(0, ageMs);
  if (abs < MINUTE) return "刚刚";
  if (abs < HOUR) return `${Math.floor(abs / MINUTE)} 分钟前`;
  if (abs < DAY) return `${Math.floor(abs / HOUR)} 小时前`;
  if (abs < 30 * DAY) return `${Math.floor(abs / DAY)} 天前`;
  if (abs < 365 * DAY) return `${Math.floor(abs / (30 * DAY))} 个月前`;
  return `${Math.floor(abs / (365 * DAY))} 年前`;
}

export interface ProvenanceSummary {
  total: number;
  live: number;
  stream: number;
  delayed: number;
  stale: number;
  seed: number;
  down: number;
  /** 需要人工处理（stale + down + seed） */
  problems: number;
}

/** 汇总各状态数量。页面顶部的概览数字直接用它，避免页面里再写一套过滤逻辑。 */
export function summarizeProvenance(items: Array<{ status: ProvenanceStatus }>): ProvenanceSummary {
  const summary: ProvenanceSummary = {
    total: items.length,
    live: 0,
    stream: 0,
    delayed: 0,
    stale: 0,
    seed: 0,
    down: 0,
    problems: 0,
  };
  for (const item of items) {
    summary[item.status] += 1;
  }
  summary.problems = summary.stale + summary.down + summary.seed;
  return summary;
}

/** 状态 → 中文标签（页面与接口共用，避免两处文案不一致）。 */
export const STATUS_LABEL: Record<ProvenanceStatus, string> = {
  live: "新鲜",
  delayed: "延迟",
  stale: "陈旧",
  seed: "示例数据",
  down: "不可用",
  stream: "实时接口",
};

/** 状态 → Badge tone（components/ui.tsx 的 Badge 只支持这些取值）。 */
export const STATUS_TONE: Record<ProvenanceStatus, "green" | "amber" | "red" | "blue" | "purple" | "gray" | "cyan"> = {
  live: "green",
  delayed: "amber",
  stale: "red",
  seed: "purple",
  down: "red",
  stream: "blue",
};

/** 数据性质 → 中文标签。 */
export const KIND_LABEL: Record<ProvenanceKind, string> = {
  official: "官方发布",
  market: "公开行情",
  media: "财经媒体",
  derived: "站内整理/计算",
  seed: "示例数据",
  user: "用户提交",
};

/** 判断某状态是否需要在页面上突出（用于「需关注」筛选）。 */
export function needsAttention(status: ProvenanceStatus): boolean {
  return status === "stale" || status === "down" || status === "seed";
}
