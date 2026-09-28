/**
 * 宏观指标清单（站内唯一事实来源）
 *
 * 此前这份清单同时散落在 `app/macro/page.tsx`（页面卡片）与 `scripts/seed.ts`（入库脚本），
 * 加上「单位」与「同比/环比变动单位」两份各自维护的配置，导致：
 *  - 风险预警面板取到的值与指标卡对不上（10Y 国债 2.31% vs 1.56%）；
 *  - 同比/环比标签对所有指标一律写 "pct"，把 1bp 的利率变动说成「个百分点」、
 *    把 +171% 的金价说成「+171.1 个百分点」；
 *  - AI 生成的「关联指标」无法校验，可能指向站内根本不存在的指标。
 *
 * 现在统一在此定义：type / 标题 / 分组 / 数值单位 / 变动单位 / 是否真实实时源 / 口径来源。
 */

export type MacroGroup = "总量景气" | "价格" | "货币金融" | "需求外贸";

/** Tab 顺序即声明顺序 */
export const MACRO_GROUPS: MacroGroup[] = ["总量景气", "价格", "货币金融", "需求外贸"];

export interface MacroIndicatorDef {
  /** 指标类型，与 economic_indicators.type 对应 */
  type: string;
  /** 展示标题（同时作为关联指标的可引用名称） */
  title: string;
  /**
   * 分组（/macro 的 Tab）。24 张图平铺会让页面长到 8000px 且无从下手，
   * 按「总量景气 / 价格 / 货币金融 / 需求外贸」四组切分后每组 4~7 张，一屏可读。
   */
  group: MacroGroup;
  /** 数值单位，"" 表示无量纲 */
  unit: string;
  /**
   * 同比/环比变动的单位：
   *  - "个百分点"：本身是比率的指标（同比/增速/收益率）
   *  - "%"：本身是价格 / 数量 / 金额的指标
   *  - "点"：指数型（PMI 等）
   */
  changeUnit: "个百分点" | "%" | "点";
  /** 真实数据源（true）还是本地种子数据（false），用于 UI 标注 */
  real: boolean;
  /** 口径来源说明 */
  source: "东方财富数据中心" | "中债登" | "东方财富行情接口";
}

export const MACRO_INDICATORS: MacroIndicatorDef[] = [
  { type: "gdp", group: "总量景气", title: "GDP 同比增速", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "cpi", group: "价格", title: "CPI 同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "ppi", group: "价格", title: "PPI 同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "pmi", group: "总量景气", title: "制造业 PMI", unit: "", changeUnit: "点", real: true, source: "东方财富数据中心" },
  { type: "m2", group: "货币金融", title: "M2 同比增速", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "tsf", group: "货币金融", title: "社融增量", unit: "万亿", changeUnit: "%", real: true, source: "东方财富数据中心" },
  { type: "lpr", group: "货币金融", title: "1年期 LPR", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "fx", group: "需求外贸", title: "外汇储备", unit: "万亿$", changeUnit: "%", real: true, source: "东方财富数据中心" },
  { type: "ind", group: "总量景气", title: "工业增加值同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "retail", group: "需求外贸", title: "社零同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "invest", group: "总量景气", title: "固定资产投资同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "realestate", group: "总量景气", title: "房地产开发投资同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "fin", group: "总量景气", title: "财政收入同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "export", group: "需求外贸", title: "出口同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "import", group: "需求外贸", title: "进口同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "unemp", group: "需求外贸", title: "城镇调查失业率", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "houseprice", group: "价格", title: "百城房价同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "yield10y", group: "货币金融", title: "10年期国债收益率", unit: "%", changeUnit: "个百分点", real: true, source: "中债登" },
  { type: "usdcny", group: "需求外贸", title: "美元兑人民币(离岸)", unit: "", changeUnit: "%", real: true, source: "东方财富行情接口" },
  { type: "m1", group: "货币金融", title: "M1 同比增速", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "tsfstock", group: "货币金融", title: "社融存量同比", unit: "%", changeUnit: "个百分点", real: true, source: "东方财富数据中心" },
  { type: "loans", group: "货币金融", title: "新增人民币贷款", unit: "万亿", changeUnit: "%", real: true, source: "东方财富数据中心" },
  { type: "gold", group: "价格", title: "伦敦金现货", unit: "美元/盎司", changeUnit: "%", real: true, source: "东方财富数据中心" },
  { type: "carsales", group: "需求外贸", title: "乘用车零售销量", unit: "万辆", changeUnit: "%", real: true, source: "东方财富数据中心" },
];

/** 站内真实存在的指标名集合：用于校验 AI 生成的「关联指标」，防止指向不存在的指标 */
export const VALID_INDICATOR_NAMES: string[] = MACRO_INDICATORS.map((m) => m.title);

export const MACRO_INDICATOR_BY_TYPE: Record<string, MacroIndicatorDef> = Object.fromEntries(
  MACRO_INDICATORS.map((m) => [m.type, m])
);
