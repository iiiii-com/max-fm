/**
 * 城市解读的类型定义。单独成文件，供 cityInsights/ 下按省份分批的内容文件引用，
 * 避免每个批次都重复一份接口声明（之前单文件版本导致跨省追加时极易出错位）。
 */

export interface CityInsight {
  /** 产业讲解：这些产业为什么在这儿，在链条上处于什么位置 */
  industry: string;
  /** 城市特点：功能定位与气质 */
  character: string;
  /** 就业结构 */
  jobs: { structure: string; directions: string[]; caveat: string };
  /** 收入机制（不给数值，给决定因素与取数口径） */
  income: { drivers: string; structure: string; source: string };
  /** 开支机制 */
  cost: { housing: string; living: string; source: string };
  /** 优势：可验证的结构性优势 */
  pros: string[];
  /** 短板：真实存在但常被忽视的约束 */
  cons: string[];
  /** 生活质量 */
  life: { strengths: string[]; tradeoffs: string[]; fitFor: string[] };
}