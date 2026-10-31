import { etfCategoryOf, fetchEtfBoard, type EtfBoardItem, type EtfCat } from "./market";

/**
 * 产业链 ↔ ETF 互通层。
 *
 * 设计原则（与 chain-sector-sync 同一套纪律）：
 * 1. 「映射」是人工精选：按产业链的成分/主题与 ETF 跟踪指数的重合度指定，
 *    每条链控制在 1~3 只，宁缺毋滥；错配的 ETF 比没有 ETF 更伤害可信度。
 * 2. 「名称匹配」是实时全市场筛选：名称命中链的关键词才进面板，作为补充而非主力；
 *    名称匹配会明确标注为「名称匹配」，不与精选映射混淆。
 * 3. 行情来自东财 ETF 板块实时榜单（20s 缓存）；上游失败时仍展示映射关系，
 *    价格标「行情暂缺」，链接照样可点 —— 关系本身不依赖行情。
 * 4. 反向（ETF → 链）同样先查映射，再用名称关键词兜底。
 */

export interface ChainEtfRef {
  code: string;
  name: string;
  /** 为什么是这只 ETF —— 展示给用户看，不写就等于没说 */
  why: string;
}

/** 人工精选映射：链 slug → ETF。代码均已于 2026-10 用东财实时行情逐只核对。 */
export const CHAIN_ETFS: Record<string, ChainEtfRef[]> = {
  semiconductor: [
    { code: "512480", name: "半导体ETF", why: "跟踪中证全指半导体，覆盖设计/制造/封测/设备材料全链" },
    { code: "159995", name: "芯片ETF", why: "跟踪国证芯片，侧重设计龙头" },
    { code: "512760", name: "芯片ETF", why: "跟踪中华半导体芯片，成分偏设备材料" },
  ],
  nev: [
    { code: "515030", name: "新能源车ETF", why: "跟踪中证新能源汽车，整车+电池+材料一条链" },
    { code: "159755", name: "电池ETF", why: "跟踪电池主题，对应链中游电芯环节" },
    { code: "516160", name: "新能源ETF", why: "新能源发电与电动车混合暴露" },
  ],
  ai: [
    { code: "515070", name: "人工智能ETF", why: "跟踪中证人工智能主题，算法与应用层为主" },
    { code: "159819", name: "人工智能ETF", why: "跟踪中证人工智能，同一指数另一家产品" },
    { code: "516510", name: "云计算ETF", why: "算力底座，对应链上游云与芯片环节" },
  ],
  solar: [
    { code: "515790", name: "光伏ETF", why: "跟踪中证光伏产业，硅料/硅片/电池/组件全链" },
    { code: "159857", name: "光伏ETF", why: "跟踪中证光伏产业，另一家产品" },
  ],
  lowaltitude: [],
  robot: [{ code: "562500", name: "机器人ETF", why: "跟踪中证机器人，减速器/伺服/整机" }],
  computing: [
    { code: "516510", name: "云计算ETF", why: "算力租赁与云服务的主要暴露" },
    { code: "512720", name: "计算机ETF", why: "计算机软硬件全行业，对应算力中下游" },
    { code: "515880", name: "通信ETF", why: "光模块/交换机，算力网络环节" },
  ],
  pharma: [
    { code: "512010", name: "医药ETF", why: "跟踪沪深300医药卫生，全行业宽口径" },
    { code: "512170", name: "医疗ETF", why: "跟踪中证医疗，器械与服务为主" },
  ],
  innovdrug: [
    { code: "159992", name: "创新药ETF", why: "跟踪中证创新药产业，创新药械核心池" },
    { code: "517110", name: "创新药ETF", why: "沪市创新药产业指数产品" },
    { code: "517380", name: "创新药ETF", why: "同一指数的第三只产品，流动性备选" },
  ],
  meddevice: [{ code: "159883", name: "医疗器械ETF", why: "跟踪中证全指医疗器械" }],
  baijiu: [{ code: "512690", name: "酒ETF", why: "跟踪中证酒指数，白酒为主" }],
  consumer: [
    { code: "159732", name: "消费电子ETF", why: "跟踪中证消费电子主题" },
    { code: "562950", name: "消费电子ETF", why: "同一主题另一家产品" },
  ],
  telecom: [{ code: "515880", name: "通信ETF", why: "跟踪中证全指通信设备" }],
  storage: [{ code: "159566", name: "储能电池ETF", why: "跟踪中证储能电池主题" }],
  wind: [{ code: "516160", name: "新能源ETF", why: "风电尚未有独立 ETF，用新能源宽基近似" }],
  hydrogen: [],
  defense: [
    { code: "512660", name: "军工ETF", why: "跟踪中证军工，主机厂与配套" },
    { code: "512670", name: "国防ETF", why: "跟踪中证国防，成分更偏军工电子" },
  ],
  steelcoal: [
    { code: "515210", name: "钢铁ETF", why: "跟踪中证钢铁，长流程与特钢" },
    { code: "515220", name: "煤炭ETF", why: "跟踪中证煤炭，动力煤与焦煤" },
  ],
  agrifood: [
    { code: "159865", name: "养殖ETF", why: "跟踪中证畜牧养殖，猪禽产业链" },
    { code: "516670", name: "畜牧养殖ETF", why: "同一主题另一家产品" },
  ],
  petrochem: [{ code: "561360", name: "石油ETF", why: "跟踪中证石油天然气，上游油气开采" }],
  realestate: [{ code: "512200", name: "房地产ETF", why: "跟踪中证全指房地产" }],
  finance: [
    { code: "512800", name: "银行ETF", why: "跟踪中证银行，链内最大权重" },
    { code: "512880", name: "证券ETF", why: "跟踪中证全指证券公司" },
  ],
  crossborder: [
    { code: "513050", name: "中概互联网ETF", why: "跨境互联网平台，跨境电商链的需求侧" },
    { code: "513330", name: "恒生互联网ETF", why: "港股互联网平台" },
    { code: "513180", name: "恒生科技ETF", why: "港股科技硬件与平台混合" },
  ],
  "medical-service": [
    { code: "512170", name: "医疗ETF", why: "医疗服务是主要权重之一" },
    { code: "516820", name: "医疗创新ETF", why: "医疗服务与器械创新暴露" },
  ],
  nuclear: [{ code: "159611", name: "电力ETF", why: "核电运营属电力公用，尚无独立核电 ETF" }],
  logistics: [{ code: "516910", name: "物流ETF", why: "跟踪中证现代物流，快递+航运" }],
  "media-game": [
    { code: "159869", name: "游戏ETF", why: "跟踪中证动漫游戏，对应链下游内容" },
    { code: "512980", name: "传媒ETF", why: "跟踪中证传媒，影视/出版/游戏混合" },
  ],
  "commercial-space": [{ code: "512660", name: "军工ETF", why: "商业航天标的多数计入军工指数" }],
  "intelligent-driving": [
    { code: "515250", name: "智能汽车ETF", why: "跟踪中证智能汽车主题" },
    { code: "516110", name: "汽车ETF", why: "整车与零部件宽基" },
  ],
  machinery: [
    { code: "560280", name: "工程机械ETF", why: "跟踪中证工程机械主题" },
    { code: "516970", name: "基建ETF", why: "基建投资的上游需求侧" },
  ],
  homeappliance: [{ code: "159996", name: "家电ETF", why: "跟踪中证家电，白电+小家电" }],
  shipbuilding: [],
  synbio: [],
  "gpu-cloud": [{ code: "516510", name: "云计算ETF", why: "算力基础设施与租赁的资产暴露" }],
  "innov-device": [{ code: "159883", name: "医疗器械ETF", why: "创新器械是医疗器械指数核心成分" }],
  "pet-food": [{ code: "159865", name: "养殖ETF", why: "宠物食品属饲料/养殖后周期，暂无纯主题 ETF" }],
  "satellite-internet": [{ code: "515880", name: "通信ETF", why: "卫星互联网归属通信设备，尚无独立 ETF" }],
  "sodium-battery": [{ code: "159755", name: "电池ETF", why: "钠电池属电池技术路线之一" }],
};

/** 名称匹配关键词：按链的强特征词，仅用于全市场 ETF 名称筛选，不参与映射判定 */
const CHAIN_ETF_KEYWORDS: Record<string, string[]> = {
  semiconductor: ["半导体", "芯片", "集成电路"],
  nev: ["新能源车", "电池", "新能源汽车"],
  ai: ["人工智能", "AI", "云", "科技"],
  solar: ["光伏", "新能源"],
  lowaltitude: ["低空", "无人机", "通用航空", "航空"],
  robot: ["机器人", "智能制造"],
  computing: ["云计算", "计算机", "通信", "算力"],
  pharma: ["医药", "医疗"],
  innovdrug: ["创新药"],
  meddevice: ["医疗器械", "医疗"],
  baijiu: ["酒"],
  consumer: ["消费电子", "电子"],
  telecom: ["通信", "5G"],
  storage: ["储能", "电池"],
  wind: ["风电", "新能源"],
  hydrogen: ["氢能", "新能源", "碳中和"],
  defense: ["军工", "国防", "航天"],
  steelcoal: ["钢铁", "煤炭", "有色"],
  agrifood: ["农业", "养殖", "畜牧", "食品"], 
  petrochem: ["石油", "能源", "化工"],
  realestate: ["房地产", "基建", "建材"],
  finance: ["银行", "证券", "保险", "金融"],
  crossborder: ["中概", "恒生", "港股", "跨境"],
  "medical-service": ["医疗", "医药", "创新药"],
  nuclear: ["核电", "电力"],
  logistics: ["物流", "航运", "交通"],
  "media-game": ["游戏", "传媒", "影视"],
  "commercial-space": ["航天", "卫星", "军工"],
  "intelligent-driving": ["智能汽车", "汽车"],
  machinery: ["机械", "基建"],
  homeappliance: ["家电"],
  shipbuilding: ["船舶", "军工", "海洋"],
  synbio: ["生物", "医药", "化工"],
  "gpu-cloud": ["云计算", "算力", "计算机"],
  "innov-device": ["医疗器械", "医疗"],
  "pet-food": ["宠物", "养殖", "食品"],
  "satellite-internet": ["卫星", "通信", "航天"],
  "sodium-battery": ["电池", "储能"],
};

export interface ChainEtfItem {
  code: string;
  name: string;
  secid: string;
  cat: EtfCat;
  price: number | null;
  changePct: number | null;
  amount: number | null;
  turnover: number | null;
  source: "映射" | "名称匹配";
  why: string;
}

export interface ChainEtfOverview {
  items: ChainEtfItem[];
  avgPct: number | null;
  up: number;
  down: number;
  flat: number;
  /** 精选映射里的第一只，作为「主 ETF」 */
  primary: ChainEtfItem | null;
  note: string;
}

function boardItemToChainItem(b: EtfBoardItem, why: string, source: "映射" | "名称匹配"): ChainEtfItem {
  return {
    code: b.code,
    name: b.name,
    secid: b.secid,
    cat: b.cat,
    price: b.price || null,
    changePct: b.changePct,
    amount: b.amount || null,
    turnover: b.turnover,
    source,
    why,
  };
}

/** 映射里存在、但榜单（成交额前100）没覆盖到的 ETF：保留关系、行情置空 */
function refToPlaceholderItem(ref: ChainEtfRef): ChainEtfItem {
  const code = ref.code;
  const secid = `${code.startsWith("5") ? "1" : "0"}.${code}`;
  return {
    code,
    name: ref.name,
    secid,
    cat: etfCategoryOf(ref.name),
    price: null,
    changePct: null,
    amount: null,
    turnover: null,
    source: "映射",
    why: ref.why,
  };
}

function matchByName(slug: string, board: EtfBoardItem[], limit: number): ChainEtfItem[] {
  const words = CHAIN_ETF_KEYWORDS[slug] ?? [];
  if (!words.length) return [];
  const out: ChainEtfItem[] = [];
  const seen = new Set<string>();
  for (const b of board) {
    if (seen.has(b.code)) continue;
    const hit = words.find((w) => b.name.includes(w));
    if (!hit) continue;
    seen.add(b.code);
    out.push(boardItemToChainItem(b, `名称含「${hit}」`, "名称匹配"));
    if (out.length >= limit) break;
  }
  return out;
}

function summarize(items: ChainEtfItem[]): Pick<ChainEtfOverview, "avgPct" | "up" | "down" | "flat"> {
  const valid = items.filter((i) => i.changePct != null) as Array<ChainEtfItem & { changePct: number }>;
  if (!valid.length) return { avgPct: null, up: 0, down: 0, flat: 0 };
  const sum = valid.reduce((s, i) => s + i.changePct, 0);
  return {
    avgPct: sum / valid.length,
    up: valid.filter((i) => i.changePct > 0).length,
    down: valid.filter((i) => i.changePct < 0).length,
    flat: valid.filter((i) => i.changePct === 0).length,
  };
}

/**
 * 单链的 ETF 互通数据。榜单失败时仍返回人工映射（行情暂缺），
 * 保证「链 ↔ ETF」的对应关系在任何行情状态下都可用。
 */
export async function getChainEtfOverview(slug: string): Promise<ChainEtfOverview> {
  const refs = CHAIN_ETFS[slug] ?? [];
  const board = (await fetchEtfBoard().catch(() => null)) ?? [];
  const byCode = new Map(board.map((b) => [b.code, b]));
  const items: ChainEtfItem[] = refs.map((ref) => {
    const hit = byCode.get(ref.code);
    return hit ? boardItemToChainItem(hit, ref.why, "映射") : refToPlaceholderItem(ref);
  });
  if (!refs.length) items.push(...matchByName(slug, board, 5));
  const stat = summarize(items);
  const note = board.length
    ? "行情为东财 ETF 板块实时报价（20 秒缓存）；映射为人工精选，按跟踪指数与产业链成分的重合度指定。"
    : "行情源暂不可用，仅展示已核对的链 ↔ ETF 映射关系；点击代码仍可在 ETF 专区查看看盘与净值。";
  return { items, ...stat, primary: items[0] ?? null, note };
}

export interface ChainEtfRow {
  slug: string;
  name: string;
  primary: ChainEtfItem | null;
  items: ChainEtfItem[];
  avgPct: number | null;
}

/**
 * 产业地图总览用：一次拉榜单，为多条链生成 ETF 行的实时涨跌。
 * chains 需要按站内顺序传入（来自 getChains 的 slug/name）。
 */
export async function getChainEtfRows(chains: Array<{ slug: string; name: string }>): Promise<ChainEtfRow[]> {
  const board = (await fetchEtfBoard().catch(() => null)) ?? [];
  const byCode = new Map(board.map((b) => [b.code, b]));
  return chains.map((c) => {
    const refs = CHAIN_ETFS[c.slug] ?? [];
    const items: ChainEtfItem[] = refs.map((ref) => {
      const hit = byCode.get(ref.code);
      return hit ? boardItemToChainItem(hit, ref.why, "映射") : refToPlaceholderItem(ref);
    });
    if (!refs.length) items.push(...matchByName(c.slug, board, 3));
    const stat = summarize(items);
    return { slug: c.slug, name: c.name, primary: items[0] ?? null, items, avgPct: stat.avgPct };
  });
}

/** ETF → 链：精选映射反查（供 ETF 专区「相关产业链」使用） */
export function chainSlugsForEtf(code: string): string[] {
  return Object.keys(CHAIN_ETFS).filter((slug) => CHAIN_ETFS[slug].some((r) => r.code === code));
}

/** ETF → 链：名称关键词兜底。仅在映射查不到时使用，且最多返回 3 条。 */
export function chainHitsByEtfName(
  name: string,
  chains: Array<{ slug: string; name: string }>
): Array<{ slug: string; name: string; basis: string }> {
  const hits: Array<{ slug: string; name: string; basis: string; weight: number }> = [];
  for (const c of chains) {
    const words = CHAIN_ETF_KEYWORDS[c.slug] ?? [];
    const matched = words.filter((w) => w.length >= 2 && name.includes(w)).sort((a, b) => b.length - a.length);
    if (!matched.length) continue;
    hits.push({ slug: c.slug, name: c.name, basis: matched[0], weight: matched[0].length });
  }
  return hits.sort((a, b) => b.weight - a.weight).slice(0, 3).map(({ weight: _w, ...rest }) => rest);
}
