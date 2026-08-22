import { STATIC_REGIONS } from "./regions";
import { CITY_COORDS } from "@/components/CityIndustryMap";

/** 图谱产业大类（颜色区分） */
export type IndustryCat =
  | "电子信息"
  | "高端制造"
  | "新能源"
  | "金融商贸"
  | "医药健康"
  | "资源能源"
  | "食品消费"
  | "数字经济";

export const INDUSTRY_CATS: IndustryCat[] = [
  "电子信息", "高端制造", "新能源", "金融商贸", "医药健康", "资源能源", "食品消费", "数字经济",
];

export const INDUSTRY_COLORS: Record<IndustryCat, string> = {
  电子信息: "#3b82f6",
  高端制造: "#8b5cf6",
  新能源: "#16a34a",
  金融商贸: "#f59e0b",
  医药健康: "#ec4899",
  资源能源: "#64748b",
  食品消费: "#ef4444",
  数字经济: "#06b6d4",
};

/** 细分产业 → 大类映射（基于公开产业归类） */
const INDUSTRY_MAP: Record<string, IndustryCat> = {
  // 电子信息
  电子信息: "电子信息", 电子信息制造: "电子信息", 集成电路: "电子信息", 光电子: "电子信息",
  显示面板: "电子信息", 电子制造: "电子信息", 电子: "电子信息", 软件信息: "数字经济",
  // 数字经济
  数字经济: "数字经济", 电商: "数字经济", 软件: "数字经济", 大数据: "数字经济",
  物联网: "数字经济", 金融科技: "金融商贸",
  // 高端制造
  装备制造: "高端制造", 装备: "高端制造", 制造业: "高端制造", 轻工制造: "高端制造",
  军工电子: "高端制造", 工程机械: "高端制造", 轨道交通: "高端制造", 造船: "高端制造",
  航空航天: "高端制造", 航空: "高端制造", 电气: "高端制造", 机械: "高端制造",
  轨道客车: "高端制造", 碳纤维: "高端制造", 硬质合金: "高端制造", 陶瓷: "高端制造",
  家电: "高端制造", 港口物流: "金融商贸", 港口: "金融商贸",
  // 新能源
  新能源: "新能源", 动力电池: "新能源", 锂电材料: "新能源", 光伏: "新能源",
  风电装备: "新能源", 水电: "新能源", 新能源车: "新能源",
  // 金融商贸
  金融: "金融商贸", 商贸: "金融商贸", 免税: "金融商贸", 旅游: "食品消费", 酒店: "食品消费",
  // 医药健康
  医药: "医药健康", 生物医药: "医药健康", 藏药: "医药健康",
  // 资源能源
  化工: "资源能源", 有色: "资源能源", 石油化工: "资源能源", 石化: "资源能源",
  石油石化: "资源能源", 钢铁: "资源能源", 煤炭: "资源能源", 煤化工: "资源能源",
  稀土: "资源能源", 钨: "资源能源", 能源: "资源能源", 电力: "资源能源",
  盐湖化工: "资源能源", 纺织: "食品消费", 纺织鞋服: "食品消费",
  // 食品消费
  食品: "食品消费", 食品加工: "食品消费", 白酒: "食品消费", 乳业: "食品消费",
  茶叶: "食品消费", 烟草: "食品消费", 汽车: "高端制造",
};

/** 城市等级（一线/新一线/二线，公开商业机构口径近似） */
export const CITY_TIER: Record<string, "一线" | "新一线" | "二线" | "三线"> = {
  北京: "一线", 上海: "一线", 广州: "一线", 深圳: "一线",
  杭州: "新一线", 南京: "新一线", 苏州: "新一线", 成都: "新一线",
  重庆: "新一线", 武汉: "新一线", 西安: "新一线", 天津: "新一线",
  长沙: "新一线", 郑州: "新一线", 合肥: "新一线", 福州: "新一线",
  厦门: "新一线", 济南: "新一线", 青岛: "新一线", 沈阳: "新一线",
  宁波: "新一线", 无锡: "新一线", 佛山: "新一线", 东莞: "新一线",
  大连: "二线", 长春: "二线", 哈尔滨: "二线", 南昌: "二线",
  太原: "二线", 贵阳: "二线", 昆明: "二线", 南宁: "二线",
  兰州: "二线", 海口: "二线", 乌鲁木齐: "二线", 石家庄: "二线",
  泉州: "二线", 温州: "二线", 烟台: "二线", 珠海: "二线",
  徐州: "二线", 常州: "二线", 南通: "二线", 惠州: "二线",
  呼和浩特: "三线", 银川: "三线", 西宁: "三线", 拉萨: "三线",
  遵义: "三线", 绵阳: "三线", 襄阳: "三线", 洛阳: "三线",
  柳州: "三线", 唐山: "三线", 淄博: "三线", 宜昌: "三线",
  赣州: "三线", 桂林: "三线", 株洲: "三线", 包头: "三线",
};

export const TIER_ORDER = ["一线", "新一线", "二线", "三线"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export interface CityGraphNode {
  name: string;
  tier: Tier;
  zone: string;
  province: string;
  coords: [number, number];
  /** 主导产业大类 */
  cat: IndustryCat;
  /** 原始支柱产业标签 */
  pillars: string[];
  /** 代表企业 */
  companies: string[];
  /** GDP 文案 */
  gdp: string;
  /** 产业规模（0-100 归一化，基于 GDP 解析） */
  size: number;
}

/** 解析 GDP 文案 → 数值（万亿元） */
function parseGdp(gdp: string): number {
  const m = gdp.match(/约?\s*([\d.]+)\s*万亿/);
  return m ? parseFloat(m[1]) : 0;
}

/** 构建城市图谱节点（真实数据，产业规模由 GDP 归一化） */
export function buildCityGraphNodes(): CityGraphNode[] {
  const out: CityGraphNode[] = [];
  for (const region of STATIC_REGIONS) {
    for (const c of region.cities) {
      const coord = CITY_COORDS[c.name];
      if (!coord) continue;
      const gdpVal = parseGdp(c.gdp);
      // 主导产业 = 第一个 pillar 归类
      const cat = INDUSTRY_MAP[c.pillar[0]] ?? ("高端制造" as IndustryCat);
      const tier = CITY_TIER[c.name] ?? "三线";
      out.push({
        name: c.name,
        tier,
        zone: region.zone,
        province: region.province,
        coords: coord,
        cat,
        pillars: c.pillar,
        companies: c.companies,
        gdp: c.gdp,
        // 规模归一化：GDP 0-4 万亿 → 12-48
        size: Math.max(12, Math.min(48, 10 + gdpVal * 10)),
      });
    }
  }
  return out;
}

export interface CityGraphEdge {
  source: string;
  target: string;
  /** 共享产业数量（关联强度） */
  weight: number;
  /** 共享产业标签 */
  shared: string[];
}

/** 构建产业关联边：两城市共享主导产业大类 → 连线（同类城市互联） */
export function buildCityGraphEdges(nodes: CityGraphNode[]): CityGraphEdge[] {
  const edges: CityGraphEdge[] = [];
  const byCat = new Map<IndustryCat, CityGraphNode[]>();
  for (const n of nodes) {
    if (!byCat.has(n.cat)) byCat.set(n.cat, []);
    byCat.get(n.cat)!.push(n);
  }
  for (const [cat, list] of byCat) {
    if (list.length < 2) continue;
    // 同产业城市两两相连（限制单城最多 3 条，避免过密）
    const connectCount = Math.min(list.length - 1, 3);
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < connectCount; j++) {
        const target = list[(i + 1 + j) % list.length];
        edges.push({ source: list[i].name, target: target.name, weight: 1, shared: [cat] });
      }
    }
  }
  // 去重
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = [e.source, e.target].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 图谱总览统计 */
export function buildCityGraphStats(nodes: CityGraphNode[]) {
  const byCat = new Map<IndustryCat, number>();
  const byZone = new Map<string, number>();
  const byTier = new Map<Tier, number>();
  for (const n of nodes) {
    byCat.set(n.cat, (byCat.get(n.cat) ?? 0) + 1);
    byZone.set(n.zone, (byZone.get(n.zone) ?? 0) + 1);
    byTier.set(n.tier, (byTier.get(n.tier) ?? 0) + 1);
  }
  return { byCat, byZone, byTier, total: nodes.length };
}
