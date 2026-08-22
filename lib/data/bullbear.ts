import raw from "@/data/bull-bear-raw.json";

export type CyclePhase = "bull" | "bear";

export interface BullBearCycle {
  id: number;
  period: string;      // 阶段名（牛1-试点牛）
  phase: CyclePhase;
  from: string;
  to: string;
  months: number;
  days: number;
  /** 阶段涨跌幅（%） */
  changePct: number;
  /** 阶段内最高点 */
  high: number;
  highDate: string;
  /** 阶段内最低点 */
  low: number;
  lowDate: string;
  /** 天量（单日最大成交量，手）；早期数据缺失为 null */
  maxVolHand: number | null;
  maxVolDate: string;
  /** 地量（单日最小成交量，手）；早期数据缺失为 null */
  minVolHand: number | null;
  minVolDate: string;
  /** 天量/地量倍数 */
  volRatio: number | null;
  /** 估值区间（PE-TTM 近似区间，可验证来源见 dataSource） */
  peRange?: string;
  /** 情绪特征 */
  sentiment?: string;
  /** 触发/驱动事件 */
  trigger?: string;
  /** 天量地量解读 */
  volNote?: string;
  /** 数据来源说明 */
  dataSource?: string;
  note?: string;
}

/** 早期三轮数据（1990-1993 腾讯源失真），点位来自上交所公开历史 */
const EARLY_NOTES: Record<string, { pe?: string; sentiment?: string; trigger?: string; volNote?: string; source?: string }> = {
  "牛1-试点牛": {
    pe: "无有效 PE（上市初期）",
    sentiment: "全民炒股：上交所开业仅 8 只股票（老八股），柜台交易抢购潮，申购表需通宵排队",
    trigger: "1990-12-19 上海证券交易所正式开业；股票供给稀缺 + 涨跌幅限制放开预期",
    volNote: "早期无量市：日成交常不足千手（1991 年低点日成交仅 10 手），天量日约 20 万手，属制度性稀缺市场，量能参考意义有限",
    source: "上交所公开历史行情：1990-12-19 开盘 96.05 → 1992-05-26 见顶 1429.01",
  },
  "熊1-回吐": {
    pe: "无有效 PE",
    sentiment: "放开涨跌幅后投机潮退潮，老八股估值崩塌，市场首次系统性回调",
    trigger: "1992-05-21 全面放开股价涨跌幅限制（此前 1%），股价一步到位后失去炒作空间",
    volNote: "数据源该区间缺失（腾讯源 1992-08~1993-01 有 145 天缺口），成交量口径不连续",
    source: "上交所公开历史行情：1992-11-17 见底 386.85，最大回撤 72.9%",
  },
  "牛2-反弹牛": {
    pe: "无有效 PE",
    sentiment: "三个月翻 4 倍，涨停板制度（1992-11-17 起恢复 5% 涨停）下“买不到”的焦虑行情",
    trigger: "1992-11-23 深交所“8·10”事件后监管层呵护市场 + 新股暂停发行，供需再度失衡",
    volNote: "量能口径同上（早期缺失），1993 年起与腾讯源对齐",
    source: "上交所公开历史行情：1993-02-16 见顶 1558.95",
  },
};

/** 1993 年后各轮估值/情绪/量能解读（来源：中证指数公司历史 PE、Wind 统计、公开报道） */
const DETAILS: Record<string, { pe?: string; sentiment?: string; trigger?: string; volNote?: string; source?: string }> = {
  "熊2-大熊": {
    pe: "高点 PE 约 50-60 倍 → 低点 PE 约 20 倍",
    sentiment: "宏观调控（1993 年 6 月“国十六条”治理通胀）+ 加息，机构撤资，股灾式下跌",
    trigger: "1993-02 经济过热见顶，央行收紧银根；1994 年上市公司亏损面扩大",
    volNote: "天量 641 万手（1994-05-30）vs 地量 10 万手（1993-09-15），量比 64 倍：熊市放量下跌后缩量阴跌",
  },
  "牛3-政策牛": {
    pe: "低点 PE 约 16-20 倍 → 高点 PE 约 40 倍",
    sentiment: "一个月翻 3 倍，三大救市政策点燃“井喷行情”，开户数单周暴增",
    trigger: "1994-07-29 证监会“三大救市政策”（暂停新股发行、扩大入市资金、严控配股）",
    volNote: "天量 1838 万手（1994-09-05）vs 起点地量 118 万手，量比 15.5 倍：政策利好放量拉升",
  },
  "熊3-慢熊": {
    pe: "高点 PE 约 40 倍 → 低点 PE 约 18 倍",
    sentiment: "题材退潮，1995 年“3·27”国债期货事件冲击，市场人气涣散",
    trigger: "1995-02 国债期货“3·27”事件（万国证券违规），1995-05 暂停国债期货交易",
    volNote: "天量 1207 万手（1995-05-22）vs 地量 10.6 万手（1995-05-12），量比 113 倍：暴跌后极度缩量，人气冰点",
  },
  "牛4-绩优牛": {
    pe: "低点 PE 约 15 倍 → 高点 PE 约 50 倍",
    sentiment: "价值投资萌芽：“绩优股”（四川长虹、深发展）领涨，人民日报发表社论肯定股市",
    trigger: "1996-01 央行两次降息，资金搬家入市；1996-12 人民日报社论《正确认识当前股票市场》",
    volNote: "天量 2148 万手（1996-12-03）vs 地量 33 万手（1996-02-09），量比 65 倍：降息驱动持续放量",
  },
  "熊4-回调": {
    pe: "高点 PE 约 50 倍 → 低点 PE 约 30 倍",
    sentiment: "1997 亚洲金融危机波及 + 过度投机监管（涨跌停、T+1、印花税上调）",
    trigger: "1997-05 印花税上调至 0.5% + 严禁国企炒股、银行资金入市",
    volNote: "天量 1686 万手（1998-05-08）vs 地量 154 万手（1997-10-14），量比 11 倍：缩量阴跌消化估值",
  },
  "牛5-519行情": {
    pe: "低点 PE 约 30 倍 → 高点 PE 约 60 倍（科技股泡沫）",
    sentiment: "“5·19”行情：网络科技股概念引爆，两个月上证 +66%，全民互联网狂热",
    trigger: "1999-05-19 国务院批准搞活股市六条政策；1999-07 减持国有股暂停",
    volNote: "天量 5718 万手（1999-06-25）vs 地量 234 万手（1999-10-12），量比 24 倍：主升浪天量换手",
  },
  "熊5-五年熊": {
    pe: "高点 PE 约 60 倍 → 低点 PE 约 16 倍（2005-06 上证约 998 点，PE 约 15-16 倍）",
    sentiment: "四年半熊市：国有股减持 + 股权分置改革悬而未决 + 2001 年互联网泡沫破裂，市场信心崩溃",
    trigger: "2001-06 国有股减持办法出台；2001-07 中石化上市抽血；2004-2005 券商综合治理",
    volNote: "天量 4852 万手（2002-06-24 国有股减持暂停“6·24”行情）vs 地量 250 万手（2002-09-23），量比 19 倍：反弹放量、阴跌缩量",
  },
  "牛6-大牛市": {
    pe: "低点 PE 约 16 倍 → 高点 PE 约 55-60 倍（2007-10 上证 6124 点）",
    sentiment: "全民炒股：基金发行秒光、开户数暴增、街谈巷议谈股票；“死了都不卖”口号流行",
    trigger: "2005-04 股权分置改革启动；2006-2007 人民币升值 + 流动性泛滥 + 两税合并预期",
    volNote: "天量 2.08 亿手（2007-05-09）vs 起点地量 857 万手（2005-07-07），量比 24 倍：牛市量能中枢逐级抬升，天量常现于加速段",
  },
  "熊6-大熊市": {
    pe: "高点 PE 约 60 倍 → 低点 PE 约 13-14 倍（2008-10 上证 1664 点）",
    sentiment: "全球金融危机 + A 股一年跌 72.9%，从全民疯狂到无人问津，基金遭遇巨额赎回",
    trigger: "2008 美国次贷危机爆发；2008-09 雷曼破产；国内货币紧缩（存款准备金率 17.5% 高位）",
    volNote: "天量 1.42 亿手（2008-04-24 印花税下调行情）vs 地量 3031 万手（2008-09-12），量比仅 4.7 倍：恐慌出清期放量不明显，反而缩量阴跌至底",
  },
  "牛7-四万亿反弹": {
    pe: "低点 PE 约 13 倍 → 高点 PE 约 30 倍",
    sentiment: "政策底到市场底：1664 见底后四万亿刺激 + 降息降准，杠杆资金入场",
    trigger: "2008-11 四万亿投资计划 + 央行连续降息（一年期贷款基准利率降至 5.31%）",
    volNote: "天量 2.76 亿手（2009-07-29 天量见顶信号）vs 地量 3586 万手（2008-11-03），量比 7.7 倍：反弹末段天量即顶部",
  },
  "熊7-慢熊": {
    pe: "高点 PE 约 30 倍 → 低点 PE 约 10 倍（2013-06 上证 1849 点，PE 约 10 倍，史上最低）",
    sentiment: "四年慢熊 + 2013 年“钱荒”（6 月银行间隔夜利率 30%），成长股结构性行情与权重阴跌并存",
    trigger: "2010-2011 欧债危机 + 国内地产调控 + 2013-06 银行间“钱荒”",
    volNote: "天量 2.63 亿手（2010-10-18）vs 地量 3113 万手（2011-12-13），量比 8.5 倍：权重缩量阴跌，中小创局部活跃",
  },
  "牛8-杠杆牛": {
    pe: "低点 PE 约 10 倍 → 高点 PE 约 22-24 倍（2015-06 上证 5178 点）",
    sentiment: "杠杆牛市：两融余额从 4000 亿飙至 2.27 万亿 + 场外配资约 1.5-2 万亿，全民加杠杆",
    trigger: "2014-11 央行降息 + “一带一路”主题 + 改革牛叙事；2015 场外配资野蛮生长",
    volNote: "天量 8.57 亿手（2015-04-20）vs 起点地量 5627 万手（2014-01-20），量比 15.2 倍：杠杆资金将量能推至历史峰值",
  },
  "熊8-股灾": {
    pe: "高点 PE 约 24 倍 → 低点 PE 约 14 倍",
    sentiment: "千股跌停奇观：6 月 26 日、7 月 27 日、8 月 24 日多次千股跌停，国家队入场救市",
    trigger: "2015-06 证监会清查场外配资（强制平仓引发踩踏）；2016-01 熔断机制 4 天 4 次熔断",
    volNote: "天量 8.31 亿手（2015-07-06 救市日）vs 地量 7057 万手（2016-01-07 熔断日），量比 11.8 倍：救市天量与熔断地量并存，极端情绪",
  },
  "牛9-白马牛": {
    pe: "低点 PE 约 14 倍 → 高点 PE 约 18-20 倍",
    sentiment: "核心资产抱团：贵州茅台、美的、格力等白马股领涨，“漂亮 50”风格确立",
    trigger: "2016-02 注册制预期调整 + 供给侧改革见效 + 外资（沪深港通）持续流入",
    volNote: "天量 3.52 亿手（2016-03-21）vs 地量 9222 万手（2017-02-03），量比仅 3.8 倍：结构性行情量能温和，指数慢牛个股分化",
  },
  "熊9-贸易战熊": {
    pe: "高点 PE 约 19 倍 → 低点 PE 约 11-12 倍（2019-01 上证 2440 点）",
    sentiment: "2018 单边下跌年：中美贸易摩擦 + 去杠杆（资管新规）+ 股权质押爆仓风险，全年 11 个月下跌",
    trigger: "2018-03 中美贸易摩擦升级；2018 资管新规、去杠杆；2018-10 股权质押平仓风险集中暴露",
    volNote: "天量 2.81 亿手（2018-02-06）vs 地量 8824 万手（2018-09-17），量比 3.2 倍：阴跌缩量至地量，情绪跌至冰点",
  },
  "牛10-结构牛": {
    pe: "低点 PE 约 11 倍 → 高点 PE 约 18-19 倍（2021-02 上证 3731 点）",
    sentiment: "结构性牛市：核心资产（茅指数）+ 新能源（宁组合）双主线，“抱团”行情极致化",
    trigger: "2019-01 央行全面降准；2020 疫情后流动性宽松 + 公募基金发行破 3 万亿",
    volNote: "天量 6.58 亿手（2020-07-07）vs 地量 1.17 亿手（2019-09-30），量比 5.6 倍：机构主导，量能温和放大",
  },
  "熊10-三年熊": {
    pe: "高点 PE 约 19 倍 → 低点 PE 约 11 倍（2024-02 上证 2635 点）",
    sentiment: "三年调整：互联网监管 + 地产暴雷 + 美联储激进加息 + 地缘冲突，市场进入“戴维斯双杀”",
    trigger: "2021 教培“双减”、平台反垄断；2022 俄乌冲突、美联储加息；2023-2024 地产链出清",
    volNote: "天量 6.67 亿手（2021-09-01）vs 地量 1.89 亿手（2022-12-21），量比 3.5 倍：熊市末端地量盘整，等待催化剂",
  },
  "牛11-924行情": {
    pe: "低点 PE 约 11 倍 → 2024-10 高点 PE 约 14-15 倍",
    sentiment: "政策强刺激：9·24 一揽子政策（降准降息 + 创设证券基金保险互换便利）+ 政治局会议定调，单日成交破 3 万亿创历史",
    trigger: "2024-09-24 央行/证监会/金融监管总局联合发布一揽子政策；2024-09-26 政治局会议罕见讨论经济",
    volNote: "天量 13.1 亿手（2024-10-08 上证单市场；当日沪深两市成交 3.48 万亿创历史纪录）vs 起点地量 2.18 亿手（2024-08-14），量比 6 倍：政策驱动的脉冲式天量",
  },
};

/** 合并为最终数据模型 */
export const BULL_BEAR_CYCLES: BullBearCycle[] = (raw as any[]).map((c, i) => {
  const detail = DETAILS[c.period] ?? {};
  const early = EARLY_NOTES[c.period] ?? {};
  return {
    id: i + 1,
    period: c.period,
    phase: c.phase as CyclePhase,
    from: c.from,
    to: c.to,
    months: c.months,
    days: c.days,
    changePct: c.change_pct,
    high: c.seg_high,
    highDate: c.high_date,
    low: c.seg_low,
    lowDate: c.low_date,
    maxVolHand: c.max_vol_hand,
    maxVolDate: c.max_vol_date,
    minVolHand: c.min_vol_hand,
    minVolDate: c.min_vol_date,
    volRatio: c.vol_ratio,
    peRange: detail.pe ?? early.pe,
    sentiment: detail.sentiment ?? early.sentiment,
    trigger: detail.trigger ?? early.trigger,
    volNote: detail.volNote ?? early.volNote,
    dataSource: detail.source ?? early.source,
    note: c.note ?? "",
  };
});

/** 牛熊统计汇总 */
export const BULL_BEAR_STATS = (() => {
  const bulls = BULL_BEAR_CYCLES.filter((c) => c.phase === "bull");
  const bears = BULL_BEAR_CYCLES.filter((c) => c.phase === "bear");
  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  const med = (arr: number[]) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
  };
  const bullChg = bulls.map((c) => c.changePct);
  const bearChg = bears.map((c) => c.changePct);
  const bullMonths = bulls.map((c) => c.months);
  const bearMonths = bears.map((c) => c.months);
  const bullRatio = bulls.map((c) => c.volRatio).filter((x): x is number => x != null && x > 0);
  const bearRatio = bears.map((c) => c.volRatio).filter((x): x is number => x != null && x > 0);
  // 大牛市（涨幅 > 100%）中的回调：阶段内最大回撤 = 低点相对高点的跌幅
  const maxDrawdowns = BULL_BEAR_CYCLES.map((c) => ({
    period: c.period,
    phase: c.phase,
    dd: Math.round(((c.low - c.high) / c.high) * 1000) / 10,
  }));
  return {
    bullCount: bulls.length,
    bearCount: bears.length,
    bullAvgChg: avg(bullChg),
    bullMedChg: med(bullChg),
    bullMaxChg: Math.max(...bullChg),
    bullMinChg: Math.min(...bullChg),
    bearAvgChg: avg(bearChg),
    bearMedChg: med(bearChg),
    bearMaxChg: Math.min(...bearChg),
    bullAvgMonths: avg(bullMonths),
    bearAvgMonths: avg(bearMonths),
    bullMedMonths: med(bullMonths),
    bearMedMonths: med(bearMonths),
    bullMedRatio: med(bullRatio),
    bearMedRatio: med(bearRatio),
    maxDrawdowns,
    // 回撤统计：每轮熊市回撤幅度（含早期三轮）
    bearDrawdowns: maxDrawdowns.filter((x) => x.phase === "bear").map((x) => x.dd),
  };
})();

/** 数据来源统一说明 */
export const BULL_BEAR_SOURCES = [
  "行情数据：腾讯财经 fqkline 历史日线接口（1990-12-19 ~ 2026-08，上证综指收盘/最高/最低/成交量），本地缓存于 data/sh-index.json（8536 个交易日）",
  "1990-1993 早期三段：上交所公开历史行情点位（96.05 / 1429.01 / 386.85 / 1558.95），因早期数据源成交量口径不连续，量能字段缺失",
  "估值区间（PE）：中证指数有限公司发布的上证综指历史市盈率区间及公开统计（如 2005-06 PE≈16、2007-10 PE≈55-60、2013-06 PE≈10、2024-02 PE≈11）",
  "情绪与触发事件：公开历史报道与监管文件（如 1994“三大救市政策”、1999“5·19”行情、2015 配资清查、2024“9·24”政策组合）",
  "两融数据：沪深交易所披露（2015 年 6 月融资余额峰值 2.27 万亿元）",
] as const;

/** 天量地量规律总结 */
export const VOLUME_PATTERNS = [
  { title: "牛市天量", body: "每轮牛市主升浪都会创出阶段天量（如 2007-05 2.08 亿手、2015-04 8.57 亿手、2024-10 13.1 亿手），天量常出现在加速上涨段或见顶前 1-3 个月——量在价先，天量后往往还有惯性冲高但风险积聚。" },
  { title: "熊市地量", body: "熊市末端普遍出现地量（2005-06 前日成交不足 300 万手、2013-06 前地量 3100 万手、2024-02 前 1.9 亿手），地量是情绪冰点的量化信号，但地量≠立即见底，常伴随 1-3 个月横盘磨底。" },
  { title: "量比规律", body: "21 轮牛熊中，牛市天量/地量中位数约 15 倍，熊市约 11 倍；量比最大的三轮（牛1 早期 / 熊3 的 113 倍 / 熊2 的 64 倍）都是市场制度剧变期，量比收敛（3-5 倍）的慢牛慢熊（牛9、牛10、熊9、熊10）反映机构化与有效性提升。" },
  { title: "政策脉冲", body: "政策驱动的行情量能呈脉冲式（1994 政策牛量比 15.5、2024 9·24 量比 6），天量集中于政策落地后 1-2 周；流动性/基本面驱动的行情量能呈阶梯式（2005-2007、2013-2015），天量随主升浪逐级抬升。" },
] as const;
