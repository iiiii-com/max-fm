/**
 * 政策 ↔ 产业链的关键词关联表（**双向共用同一份**）。
 *
 * 为什么必须抽成共享模块：政策详情页要「这条政策涉及哪些链」，
 * 链详情页要「哪些政策涉及这条链」。两处各写一份关键词表，
 * 迟早会出现"政策页说涉及半导体、链页说没有"这种自相矛盾 ——
 * 而这类矛盾不会报错，只会让读者对整站的可信度打折。
 *
 * 口径纪律（与政策页原有说明一致，不可放宽）：
 *  - 只用于**定位原文涉及的领域**，不宣称政策利好该行业；
 *  - 只用指向具体产业的强特征词，不用「银行」「消费」这类泛词
 *    （旧表把泛词也算命中，导致《审计法实施条例》因出现"银行""消费"
 *     字样被标注为"受益产业链：银行保险、消费"，而审计条例只会收紧审计监督）；
 *  - 命中是关键词匹配结果，不代表因果。
 */

export interface SectorHint {
  label: string;
  /** 与 STATIC_CHAINS 的 id 对齐 */
  slug: string;
  words: string[];
}

export const SECTOR_HINTS: SectorHint[] = [
  { label: "新能源汽车", slug: "nev", words: ["新能源汽车", "动力电池", "充电桩", "购置税"] },
  { label: "半导体", slug: "semiconductor", words: ["集成电路", "晶圆", "半导体", "芯片"] },
  { label: "人工智能", slug: "ai", words: ["人工智能", "大模型", "算力"] },
  { label: "房地产", slug: "realestate", words: ["商品房", "楼市", "住房公积金", "房地产", "房贷"] },
  { label: "医药生物", slug: "pharma", words: ["集中采购", "医保", "创新药", "医疗器械"] },
  { label: "光伏", slug: "solar", words: ["光伏", "风电", "可再生能源装机"] },
  { label: "机器人", slug: "robot", words: ["人形机器人", "机器人产业"] },
  { label: "银行保险", slug: "finance", words: ["资本充足率", "存款准备金", "偿付能力", "不良贷款率"] },
  { label: "消费", slug: "baijiu", words: ["以旧换新", "消费券", "家电下乡", "促消费"] },
  { label: "农业食品", slug: "agrifood", words: ["粮食", "种业", "耕地", "农产品"] },
  { label: "军工", slug: "defense", words: ["国防科技", "军民融合", "装备采购"] },
  { label: "低空经济", slug: "lowaltitude", words: ["低空经济", "通用航空", "无人机"] },
];

/** slug → 提示（链页反向查询用） */
export const HINT_BY_SLUG: Record<string, SectorHint> = Object.fromEntries(
  SECTOR_HINTS.map((h) => [h.slug, h])
);

/**
 * 一条政策命中了哪些链。
 * corpus 必须是**标题 + 摘要 + 原文**，不要把 AI 解读文本算进来 ——
 * 解读里出现的词会把政策原本没提的行业也标成命中。
 */
export function chainsHitBy(corpus: string): SectorHint[] {
  return SECTOR_HINTS.filter((h) => h.words.some((w) => corpus.includes(w)));
}

/** 反向：一条链被哪些政策命中 */
export function policyHitsChain(corpus: string, slug: string): boolean {
  const hint = HINT_BY_SLUG[slug];
  if (!hint) return false;
  return hint.words.some((w) => corpus.includes(w));
}

/** 命中的具体词（用于在 UI 上说明"因为哪几个词命中"，比只给结论更可核对） */
export function hitWords(corpus: string, slug: string): string[] {
  const hint = HINT_BY_SLUG[slug];
  if (!hint) return [];
  return hint.words.filter((w) => corpus.includes(w));
}