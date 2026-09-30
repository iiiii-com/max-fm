/**
 * 产业链指标的「三件套」准入规则。
 *
 * 为什么要有这道闸：
 * chain_nodes 曾在 seed 阶段用 `Math.random()` 生成 value / growth
 * （200~2000 亿的"规模"、由链级 sentiment 反推区间的"增速"），
 * 随后被详情页当作权威数据渲染，还带涨跌色 —— 一个 40 字的数字
 * 承载了完整的虚假权威感。清空存量只是止血，**必须立规则防止它再回来**。
 *
 * 硬性要求（缺一不可）：
 *   unit      —— 没有单位的数字没有意义（"4514" 是亿块还是万辆？）
 *   date      —— 没有时点的数字会过期（"渗透率 47%"是哪一年的？）
 *   source    —— 没有来源的数字无法核验，也就无法被纠正
 *
 * 这条规则的价值在于它很便宜：宁可不显示，也不显示一个站不住的数字。
 * 少是真的。
 */

/** 指标类型白名单。新增类型必须同时补齐渲染与口径说明。 */
export const METRIC_KEYS = {
  /** 市场规模：整个链的年度产值/销售额（金额口径） */
  market_size: { label: "市场规模", def: "年度市场规模，需注明是否含进出口", unitHint: ["亿元", "万亿元"] },
  /** 国产化率：本土供应占比 */
  localization_rate: { label: "国产化率", def: "本土供应占该环节总需求的比重", unitHint: ["%"] },
  /** 产量：实物产出量 */
  output: { label: "产量", def: "实物产量，需注明统计范围", unitHint: ["亿块", "万辆", "GWh", "万吨", "亿吨"] },
  /** 增速：官方发布的同比增速 */
  growth_rate: { label: "增加值增速", def: "该行业增加值同比实际增速（不变价）", unitHint: ["%"] },
  /** 出口额 */
  export_value: { label: "出口额", def: "年度出口金额", unitHint: ["亿元", "亿美元"] },
  /** 渗透率：终端需求中的占比 */
  penetration: { label: "渗透率", def: "占终端需求总量的比重", unitHint: ["%"] },
} as const;

export type MetricKey = keyof typeof METRIC_KEYS;

export interface ChainMetricRow {
  id?: string | null;
  /** 产业链 slug */
  slug?: string | null;
  /** metric_key */
  type?: string | null;
  /** 指标显示名 */
  name?: string | null;
  value?: number | null;
  unit?: string | null;
  /** 统计时点：'2024' / '2024-06' */
  date?: string | null;
  /** 来源名称 */
  source?: string | null;
  sourceUrl?: string | null;
  /** 口径说明 */
  detail?: string | null;
}

export interface MetricValidation {
  ok: boolean;
  reason?: string;
}

/** 指标时点必须可识别：4 位年 或 YYYY-MM */
const DATE_RE = /^\d{4}(-\d{2})?$/;

export function validateMetric(m: ChainMetricRow): MetricValidation {
  if (!m.slug) return { ok: false, reason: "缺少产业链 slug" };
  if (!m.type || !(m.type in METRIC_KEYS)) {
    return { ok: false, reason: `未知指标类型 "${m.type}"（需在 METRIC_KEYS 中登记）` };
  }
  if (m.value == null || !Number.isFinite(m.value)) {
    return { ok: false, reason: "数值缺失或非有限" };
  }
  const spec = METRIC_KEYS[m.type as MetricKey];
  if (!m.unit) {
    return { ok: false, reason: `「${spec.label}」缺单位` };
  }
  if (!(spec.unitHint as readonly string[]).includes(m.unit)) {
    return {
      ok: false,
      reason: `「${spec.label}」单位 "${m.unit}" 不在允许集合 [${spec.unitHint.join("/")}] 内`,
    };
  }
  if (!m.date || !DATE_RE.test(m.date)) {
    return { ok: false, reason: `缺统计时点或格式非 YYYY / YYYY-MM（收到 "${m.date ?? ""}"）` };
  }
  if (!m.source) return { ok: false, reason: "缺来源，无法核验" };
  if (!m.detail) {
    return { ok: false, reason: `缺口径说明（例：${spec.def}）` };
  }
  return { ok: true };
}

/** 通过校验的指标，可安全渲染 */
export interface ValidMetric {
  slug: string;
  key: MetricKey;
  name: string;
  value: number;
  unit: string;
  asOf: string;
  source: string;
  sourceUrl: string | null;
  caliber: string;
}

/** 过滤出可渲染的指标；不合法的一条都不返回（宁可空着） */
export function validMetrics(rows: ChainMetricRow[]): ValidMetric[] {
  const out: ValidMetric[] = [];
  for (const r of rows) {
    if (!validateMetric(r).ok) continue;
    out.push({
      slug: r.slug!,
      key: r.type as MetricKey,
      name: r.name?.trim() || METRIC_KEYS[r.type as MetricKey].label,
      value: r.value!,
      unit: r.unit!,
      asOf: r.date!,
      source: r.source!,
      sourceUrl: r.sourceUrl || null,
      caliber: r.detail!,
    });
  }
  return out;
}

/** 展示用格式化：数值千分位 + 单位；时点只取年份 */
export function formatMetric(m: ValidMetric): string {
  const v = Number.isInteger(m.value) ? m.value.toLocaleString("zh-CN") : m.value.toFixed(1);
  return `${v}${m.unit}`;
}

export function metricAsOfYear(m: ValidMetric): string {
  return m.asOf.slice(0, 4);
}
