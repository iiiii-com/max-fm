/**
 * 城市解读层 —— 产业讲解 / 城市特点 / 就业结构 / 收入与开支机制 / 优缺点 / 生活质量。
 *
 * ⚠ 数据纪律（与 chainInsights.ts 同一原则，且本项目已因此清掉过造假数据）
 *
 * 这里**不写任何数字**：不写「平均年薪 X 万」「房价均价 Y 万/㎡」「就业率 Z%」。
 * 站内没有城市级的薪资、居民收入、消费支出、房价绝对值数据
 * （唯一有官方口径的城市级数据是统计局 70 城房价**指数**，基期=100，不是价格）。
 * 凭印象填一个数，就是 province_stats.trade 造假
 * （gdp × (0.25 + rng()×0.4)）的翻版，而且更隐蔽 ——
 * 薪资和房价的量级看起来都「很合理」。
 *
 * 写的是**机制与结构**，这些不依赖具体数字也成立：
 *   - 收入由什么决定（产业结构决定利润在哪一环）
 *   - 成本压力来自哪里（住房 / 通勤 / 教育）
 *   - 就业岗位集中在哪类行业、门槛在哪
 *   - 要看数值，应查哪个官方口径的哪个指标
 * 同时给出取数指引，指向统计局年鉴与省统计局的正确表名，
 * 避免读者误用「在岗职工平均工资」冒充「居民人均可支配收入」
 * —— 前者含单位、后者是住户调查抽样，是两个完全不同的口径。
 *
 * 内容按批次分文件存放（cityInsights/*.ts），
 * 由 BARTS 显式登记后汇总 —— 不做目录自动扫描：
 * 自动扫描会把临时文件、备份文件一起并进来，且顺序不可控，
 * 出现同名城市时后写入的会静默覆盖前一个，无法察觉。
 * scripts/verify-city-insights.ts 会断言无重名、无缺失、字段齐全、无编造数值。
 */
import type { CityInsight } from "./cityInsightsTypes";
import { GUANGDONG } from "./cityInsights/guangdong";
import { JIANGSU_ZHEJIANG_SHANDONG } from "./cityInsights/jiangsuZhejiangShandong";
import { SICHUAN_HUBEI_FUJIAN_ANHUI_HUNAN_HENAN } from "./cityInsights/sichuanHubeiFujianAnhuiHunanHenan";
import { NORTHWEST_MUNICIPALS_NORTHEAST } from "./cityInsights/northwestMunicipalsNortheast";
import { JIANGXI_GUIZHOU_YUNNAN } from "./cityInsights/jiangxiGuizhouYunnan";
import { GUANGXI_INNERMONGOLIA_GANSU_QINGHAI_TIBET } from "./cityInsights/guangxiInnerMongoliaGansuQinghaiTibet";

export type { CityInsight };

/** 各批次内容。同名城市后出现者覆盖前者（校验脚本会断言不发生） */
const BARTS: Array<Record<string, CityInsight>> = [
  GUANGDONG,
  JIANGSU_ZHEJIANG_SHANDONG,
  SICHUAN_HUBEI_FUJIAN_ANHUI_HUNAN_HENAN,
  NORTHWEST_MUNICIPALS_NORTHEAST,
  JIANGXI_GUIZHOU_YUNNAN,
  GUANGXI_INNERMONGOLIA_GANSU_QINGHAI_TIBET,
];

export const CITY_INSIGHTS: Record<string, CityInsight> = Object.assign({}, ...BARTS);

export function hasCityInsight(name: string): boolean {
  return Boolean(CITY_INSIGHTS[name]?.industry);
}

/** 站点全部城市中，尚未撰写解读的（供回归脚本断言覆盖率） */
export function missingCityInsights(allCityNames: string[]): string[] {
  return allCityNames.filter((n) => !CITY_INSIGHTS[n]);
}