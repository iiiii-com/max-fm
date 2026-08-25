/**
 * 《全球资本市场研究与投资决策体系》(GMRDS) 数据模型
 * 依据深化文档：十二学院 + 决策委员会、11 环节决策闭环、V1/V2/V3 版本路径
 * 整合原则：统一数据底座 → 共享分析工具箱 → 决策闭环贯通 → AI 中台 → 版本平滑升级
 */

export interface GIndicator {
  name: string;
  desc: string;
  source: string; // 数据来源（保证可溯源）
}

export interface GMethod {
  title: string;
  desc: string;
}

export interface Academy {
  slug: string;
  no: string; // 学院编号
  name: string;
  en: string;
  icon: string;
  tone: string;
  stage: 1 | 2 | 3 | 4; // 决策阶段
  role: string; // 职责
  questions: string[]; // 核心研究问题
  indicators: GIndicator[]; // 数据字段（共享数据底座）
  methods: GMethod[]; // 分析方法/工具
  outputs: string[]; // 决策输出物
  connectivity: string; // 与其它学院/数据层的连通
  upstream: string[];
  downstream: string[];
  siteModules: { label: string; href: string }[];
  roadmap: { v1: string; v2: string; v3: string };
}

export const ACADEMIES: Academy[] = [
  {
    slug: "global",
    no: "A01",
    name: "全球市场学院",
    en: "Global Markets",
    icon: "globe",
    tone: "#0ea5e9",
    stage: 1,
    role: "建立统一市场档案（UMP），覆盖全球主要资产与市场结构，为各学院提供标准化行情与结构数据。",
    questions: [
      "全球市场周期位置在哪里？",
      "跨市场联动方向如何演变？",
      "各市场相对强弱如何排序？",
    ],
    indicators: [
      { name: "指数行情", desc: "收盘价、涨跌幅、成交量、成交额、换手率、振幅、52周高低点", source: "腾讯财经 / 东方财富公开接口" },
      { name: "市场结构", desc: "行业分布权重、成分股数量、市值中位数、PE/PB 分位", source: "公开行情 + 财报" },
      { name: "市场状态", desc: "牛熊阶段标记、波动率（20/60日）、趋势方向（MA20/MA60/MA200 位置）", source: "自算（基于公开行情）" },
      { name: "覆盖市场", desc: "美股（标普500/纳指/道指）·港股（恒指/恒生科技）·A股（上证/深证/创业板/科创）·欧股（DAX/CAC）·日经225·MSCI 新兴市场", source: "公开行情" },
      { name: "债券与商品", desc: "中美 10Y 国债收益率、信用利差、黄金、原油、铜", source: "FRED / 公开行情" },
      { name: "外汇", desc: "美元指数 DXY、人民币汇率", source: "公开行情" },
    ],
    methods: [
      { title: "UMP 统一市场档案", desc: "行情/结构/状态三类字段一次录入，多学院复用" },
      { title: "跨市场相对强弱矩阵", desc: "滚动动量与区间分位的横截面排序" },
      { title: "风险雷达图", desc: "波动率/相关性/趋势多维度风险画像" },
      { title: "周期位置判定", desc: "估值分位 + 均线结构 + 波动率定位牛熊阶段" },
    ],
    outputs: ["全球市场周报", "跨市场相对强弱矩阵", "风险雷达图"],
    connectivity: "UMP 数据底座向行业、估值、技术分析学院提供标准化行情与结构数据。",
    upstream: [],
    downstream: ["macro", "liquidity", "cycle", "industry", "valuation", "technical"],
    siteModules: [
      { label: "大盘指数", href: "/market" },
      { label: "美股年度 K 线", href: "/analysis/bullbear" },
    ],
    roadmap: {
      v1: "全球指数日度监控 + 相对强弱排序",
      v2: "跨市场联动矩阵 + 风险雷达图自动化",
      v3: "全谱系资产实时档案 + AI 周期状态识别",
    },
  },
  {
    slug: "macro",
    no: "A02",
    name: "宏观经济学院",
    en: "Macroeconomics",
    icon: "landmark",
    tone: "#8b5cf6",
    stage: 1,
    role: "判断全球与中国宏观周期，构建政策传导路径，为资产配置提供宏观锚点。",
    questions: [
      "当前处于美林时钟哪个周期阶段（复苏/过热/滞胀/衰退）？",
      "货币政策与财政政策的松紧力度如何？",
      "当前周期对股、债、商品何者有利？",
    ],
    indicators: [
      { name: "周期指标组合", desc: "领先/同步/滞后指标：PMI、工业增加值、社融、CPI/PPI、失业率、企业利润", source: "国家统计局 / 央行" },
      { name: "美林时钟定位", desc: "增长-通胀二维 → 复苏/过热/滞胀/衰退", source: "自算" },
      { name: "政策利率与存准", desc: "LPR/MLF/OMO/存准率变动", source: "中国人民银行" },
      { name: "财政收支", desc: "财政支出与减税力度", source: "财政部" },
      { name: "汇率与资本流动", desc: "利差 → 资本流动 → 汇率 → 进出口传导", source: "公开行情" },
    ],
    methods: [
      { title: "美林时钟框架", desc: "增长 × 通胀四象限映射资产与行业偏好" },
      { title: "政策传导路径", desc: "货币（利率→信贷→投资→增长）/ 财政（支出→总需求→盈利→估值）/ 汇率（利差→资本流动→进出口）" },
      { title: "领先指标组合", desc: "PMI 新订单、社融脉冲等前瞻拐点" },
      { title: "宏观景气指数", desc: "多指标合成，输出宏观评分与资产偏好" },
    ],
    outputs: ["宏观景气指数", "周期研判报告", "资产配置宏观指引"],
    connectivity: "宏观周期结论作为资产配置学院 SAA/TAA 的输入；景气指数联动流动性学院。",
    upstream: ["global"],
    downstream: ["liquidity", "cycle", "allocation", "industry"],
    siteModules: [
      { label: "宏观仪表盘", href: "/macro" },
      { label: "政策解读", href: "/policy" },
      { label: "经济分布图", href: "/map" },
    ],
    roadmap: {
      v1: "核心宏观指标看板 + 温度计合成",
      v2: "美林时钟定位 + 政策传导评分",
      v3: "高频数据实时映射 + AI 政策文本自动解读",
    },
  },
  {
    slug: "liquidity",
    no: "A03",
    name: "流动性学院",
    en: "Liquidity",
    icon: "droplets",
    tone: "#06b6d4",
    stage: 1,
    role: "监测全球央行政策与资金流向，衡量流动性松紧与增量资金方向。",
    questions: [
      "全球与国内流动性处于宽松还是收紧？",
      "增量资金正在流向哪个市场与风格？",
    ],
    indicators: [
      { name: "央行政策", desc: "美联储（利率/QT/纪要鹰鸽）、中国央行（MLF/LPR/OMO/存准/社融）、欧日央行（YCC）", source: "央行官网 / 公开会议纪要" },
      { name: "资金流向", desc: "北向/南向净流入、两融余额、公募发行与 ETF 份额", source: "交易所 / 基金公开数据" },
      { name: "回购利率", desc: "GC001 / DR007 资金价格", source: "交易所 / 银行间" },
      { name: "美元与新兴市场", desc: "美元指数与新兴市场资金流关系", source: "公开行情" },
    ],
    methods: [
      { title: "松紧四维判断", desc: "央行操作 + 资金价格 + 信用扩张 + 增量资金四维打分" },
      { title: "风格资金推断", desc: "增量资金流向 → 大盘/小盘、成长/价值风格判断" },
      { title: "央行政策日历", desc: "议息会议与关键窗口前瞻" },
      { title: "资金热度图", desc: "成交与两融数据的行业热度热力图" },
    ],
    outputs: ["流动性周报", "央行政策日历", "资金流向热度图"],
    connectivity: "资金风格判断直接输入决策流程第 2 步流动性评估；热度图与市场/技术学院共享成交与两融数据。",
    upstream: ["global", "macro"],
    downstream: ["cycle", "allocation", "trading"],
    siteModules: [
      { label: "市场资金流", href: "/market" },
      { label: "个股资金双图", href: "/market?tab=stocks" },
    ],
    roadmap: {
      v1: "资金面指标看板（北向/两融/利率）",
      v2: "松紧打分 + 风格资金推断 + 央行日历",
      v3: "实时资金流监测 + AI 流动性拐点预警",
    },
  },
  {
    slug: "cycle",
    no: "A04",
    name: "市场周期学院",
    en: "Market Cycles & Sentiment",
    icon: "waves",
    tone: "#f59e0b",
    stage: 2,
    role: "识别牛熊阶段与市场情绪冷热，输出周期结论与风险偏好（含情绪评估数据支持）。",
    questions: [
      "当前处于牛熊周期的哪个阶段？",
      "市场情绪处于极端冷还是极端热？",
      "风险偏好应上调还是下调？",
    ],
    indicators: [
      { name: "牛熊阶段标记", desc: "估值分位 + 均线结构 + 波动率的阶段判定", source: "自研（历史行情）" },
      { name: "情绪指标", desc: "换手率、两融余额、贪婪指数、成交热度", source: "交易所 / 自算" },
      { name: "市场广度", desc: "涨跌家数比、新高新低家数、均线之上比例", source: "自算（公开行情）" },
      { name: "波动率", desc: "20/60 日已实现波动率与极端水平", source: "自算" },
    ],
    methods: [
      { title: "牛熊周期框架", desc: "估值分位 + 趋势结构 + 情绪极值三因子" },
      { title: "情绪逆向/顺势", desc: "极端情绪（贪婪/恐慌）作为逆向信号" },
      { title: "风险偏好评分", desc: "周期结论 + 情绪冷热合成风险偏好等级" },
    ],
    outputs: ["周期结论", "情绪冷热评分", "风险偏好等级"],
    connectivity: "周期与情绪结论输入决策流程第 3 步周期定位与第 8 步情绪评估；广度数据与量化学院共享。",
    upstream: ["macro", "liquidity", "global"],
    downstream: ["allocation", "industry", "trading"],
    siteModules: [
      { label: "危机重演", href: "/history?tab=crisis" },
      { label: "康波全景", href: "/history?tab=waves" },
      { label: "牛熊深度报告", href: "/analysis/bullbear" },
    ],
    roadmap: {
      v1: "牛熊周期定位 + 历史区间对比",
      v2: "情绪冷热评分 + 市场广度监控",
      v3: "周期状态机自动判定 + 情绪极端实时预警",
    },
  },
  {
    slug: "industry",
    no: "A05",
    name: "行业研究学院",
    en: "Industry Research",
    icon: "network",
    tone: "#10b981",
    stage: 2,
    role: "跟踪重点行业景气变化，识别结构性机会与拥挤风险。",
    questions: [
      "哪些行业景气正在上行？",
      "行业的拥挤度是否过高？",
    ],
    indicators: [
      { name: "行业清单", desc: "科技（半导体/AI/消费电子/软件）·制造（新能源车/光伏/军工/高端装备）·消费（白酒/食品饮料/医药/免税/旅游）·金融（银行/券商/保险）·周期（煤炭/有色/钢铁/化工/地产）", source: "行业分类公开数据" },
      { name: "量价数据", desc: "价格、产量、库存、订单", source: "行业统计" },
      { name: "高频数据", desc: "乘联会周度销售、光伏装机、SEMI 半导体销售", source: "行业机构公开数据" },
      { name: "财务验证", desc: "营收增速、利润率、资本开支", source: "上市公司财报" },
    ],
    methods: [
      { title: "景气度四维验证", desc: "量价 + 高频 + 财务三重交叉验证景气方向" },
      { title: "拥挤度计算", desc: "复用量化学院相关性工具评估交易拥挤" },
      { title: "行业轮动建议", desc: "景气上行 + 低拥挤的行业优先配置" },
    ],
    outputs: ["行业景气跟踪表", "行业轮动建议", "深度报告"],
    connectivity: "景气结果输入决策流程第 4 步行业景气判断；拥挤度复用量化统计学院相关性工具。",
    upstream: ["macro", "cycle", "liquidity"],
    downstream: ["company", "valuation", "allocation"],
    siteModules: [
      { label: "产业链全景", href: "/industry" },
      { label: "城市产业图谱", href: "/map" },
    ],
    roadmap: {
      v1: "行业行情与资金热度看板",
      v2: "景气度评分 + 高频数据自动抓取 + 拥挤度",
      v3: "AI 行业研报摘要 + 景气拐点自动预警",
    },
  },
  {
    slug: "company",
    no: "A06",
    name: "公司研究学院",
    en: "Company Research",
    icon: "building",
    tone: "#6366f1",
    stage: 3,
    role: "聚焦龙头公司商业模式拆解与财务质量评估，建立个股跟踪池。",
    questions: [
      "公司能否维持竞争优势？",
      "盈利质量与成长是否可持续？",
    ],
    indicators: [
      { name: "商业模式", desc: "类型（平台/制造/消费）、核心竞争力（品牌/技术/渠道/成本/规模）、护城河（无形资产/转换成本/网络效应/成本优势）、成长空间（TAM/渗透率/市占率）", source: "公司公告 + 研报" },
      { name: "盈利能力", desc: "ROE / ROIC / 毛利率 / 净利率趋势", source: "财报计算" },
      { name: "成长性", desc: "营收/净利/扣非增速", source: "财报" },
      { name: "现金流", desc: "经营现金流/净利、自由现金流", source: "财报" },
      { name: "负债与分红", desc: "资产负债率/有息负债/流动比率、股息率/回购力度", source: "财报" },
    ],
    methods: [
      { title: "商业模式拆解", desc: "类型 → 竞争力 → 护城河 → 成长空间的四层拆解" },
      { title: "财务评分卡", desc: "盈利/成长/现金流/负债/分红五维打分" },
      { title: "个股跟踪池", desc: "按财务质量与成长排序建立跟踪名单" },
    ],
    outputs: ["研究框架", "财务评分卡", "个股跟踪池"],
    connectivity: "财务数据与估值学院共用公司财务数据库；个股池供技术分析学院择时。",
    upstream: ["industry", "cycle"],
    downstream: ["valuation", "technical", "trading"],
    siteModules: [
      { label: "个股行情 + 评分", href: "/market?tab=stocks" },
      { label: "个股对比", href: "/compare" },
    ],
    roadmap: {
      v1: "财务指标展示 + 基础评分",
      v2: "财务评分卡 + 护城河评估 + 跟踪池",
      v3: "AI 财报解读 + 财务风险自动预警",
    },
  },
  {
    slug: "valuation",
    no: "A07",
    name: "估值学院",
    en: "Valuation",
    icon: "scale",
    tone: "#ec4899",
    stage: 3,
    role: "建立分行业估值体系，判断合理估值区间与安全边际。",
    questions: [
      "当前估值处于历史什么分位？",
      "是否存在明显低估或高估？",
    ],
    indicators: [
      { name: "分行业估值方法", desc: "成长型（PE/PEG/PS）、价值型（PB/股息率/PE）、周期型（PB+周期调整PE）、消费型（PE/PEG/DCF）", source: "自算（行情+财报）" },
      { name: "历史分位", desc: "近 5/10 年 PE/PB 百分位", source: "自算" },
      { name: "相对溢价", desc: "对大盘 / 全球同业溢价率", source: "自算" },
      { name: "股债性价比", desc: "ERP = 1/PE - 无风险利率", source: "自算" },
    ],
    methods: [
      { title: "分行业估值框架", desc: "按行业属性选用适配估值方法" },
      { title: "安全边际提示", desc: "历史分位极值 + 相对溢价过高的警示" },
      { title: "估值区间测算", desc: "绝对与相对结合的合理区间" },
    ],
    outputs: ["全行业估值分位表", "重点个股估值", "安全边际提示"],
    connectivity: "估值分位复用全球市场学院 PE/PB 分位字段；估值结论输入决策流程第 6 步估值判断。",
    upstream: ["company", "industry", "global"],
    downstream: ["allocation", "trading"],
    siteModules: [
      { label: "个股评分", href: "/market?tab=stocks" },
      { label: "牛熊估值定位", href: "/analysis/bullbear" },
    ],
    roadmap: {
      v1: "PE/PB 分位 + ERP 展示",
      v2: "分行业估值框架 + 相对溢价矩阵",
      v3: "AI 估值模型自动化 + 合理区间动态跟踪",
    },
  },
  {
    slug: "technical",
    no: "A08",
    name: "技术分析学院",
    en: "Technical Analysis",
    icon: "candlestick",
    tone: "#f43f5e",
    stage: 3,
    role: "识别价格趋势与市场广度，捕捉交易时机与关键点位。",
    questions: [
      "趋势方向与强度如何？",
      "市场广度是支持还是背离趋势？",
    ],
    indicators: [
      { name: "均线系统", desc: "MA20/60/200 多空排列与位置关系", source: "自算" },
      { name: "趋势与形态", desc: "趋势线/通道、头肩顶底/双顶底/三角形、量价配合", source: "自研识别" },
      { name: "市场广度", desc: "涨跌家数比、新高新低家数、NH-NL 指数、均线之上比例、腾落指数 ADL", source: "自算（公开行情）" },
      { name: "指标组合", desc: "MACD / KDJ / RSI / BOLL", source: "自算" },
    ],
    methods: [
      { title: "多周期趋势确认", desc: "日/周/月级别一致性检查" },
      { title: "广度验证", desc: "广度指标确认或背离趋势" },
      { title: "支撑压力定位", desc: "均线 + 形态 + 画线标注的关键点位" },
    ],
    outputs: ["技术面研判", "市场广度周报", "支撑压力位"],
    connectivity: "复用全球市场学院行情与均线数据；择时信号输入决策流程第 7 步技术确认。",
    upstream: ["global", "company"],
    downstream: ["trading", "quant"],
    siteModules: [
      { label: "K 线 + 技术指标", href: "/market?tab=stocks" },
      { label: "画线标注工具", href: "/market?tab=stocks" },
    ],
    roadmap: {
      v1: "主流指标叠加与多周期切换",
      v2: "市场广度监控 + 形态自动识别",
      v3: "AI 模式识别 + 技术信号与基本面融合",
    },
  },
  {
    slug: "quant",
    no: "A09",
    name: "量化统计学院",
    en: "Quantitative & Statistics",
    icon: "calculator",
    tone: "#14b8a6",
    stage: 4,
    role: "提供回撤、收益分布、相关性等统计工具，作为跨学院共享的「分析工具箱」。",
    questions: [
      "组合的风险收益特征如何？",
      "资产相关性是否上升（系统性风险抬升）？",
    ],
    indicators: [
      { name: "收益分布", desc: "均值/标准差/偏度/峰度/VaR（95%/99%）", source: "自算" },
      { name: "回撤分析", desc: "最大回撤/持续时长/恢复时长", source: "自算" },
      { name: "相关性矩阵", desc: "跨资产/跨市场动态相关性与热图", source: "自算" },
      { name: "波动率", desc: "历史波动/隐含波动/波动率聚类", source: "自算" },
      { name: "风险指标", desc: "夏普 / 索提诺 / 卡玛比率", source: "自算" },
    ],
    methods: [
      { title: "统计工具箱", desc: "回撤/分布/相关性/VaR 等工具横向输出给各学院" },
      { title: "相关性动态监测", desc: "滚动相关系数捕捉系统性风险抬升" },
      { title: "回测框架", desc: "配置与择时策略的样本外验证" },
    ],
    outputs: ["资产风险特征统计表", "相关性动态热图", "回撤分析报告"],
    connectivity: "统计工具被行业学院拥挤度、风险学院 VaR、资产配置学院回测复用，作为「分析工具箱」横跨各学院。",
    upstream: ["technical", "valuation", "company"],
    downstream: ["allocation", "trading", "ai"],
    siteModules: [{ label: "历史数据回溯", href: "/history" }],
    roadmap: {
      v1: "基础统计指标（收益/回撤/夏普）",
      v2: "回撤/分布/相关性自动化 + 回测框架",
      v3: "AI 因子挖掘 + 实时统计引擎",
    },
  },
  {
    slug: "allocation",
    no: "A10",
    name: "资产配置学院",
    en: "Asset Allocation",
    icon: "pie-chart",
    tone: "#22c55e",
    stage: 2,
    role: "研究股债金轮动，构建 SAA/TAA 配置框架与再平衡规则。",
    questions: [
      "当前哪类资产占优？",
      "股、债、金如何分配？",
    ],
    indicators: [
      { name: "股债轮动", desc: "利率周期、股债利差/ERP", source: "自算" },
      { name: "股金轮动", desc: "实际利率驱动的黄金配置", source: "自算" },
      { name: "美林时钟配置", desc: "四象限资产偏好", source: "自算" },
      { name: "风险平价", desc: "波动率加权的配置范式", source: "自算" },
    ],
    methods: [
      { title: "战略配置 SAA", desc: "长期预期收益 + 风险容忍度确定基准比例" },
      { title: "战术配置 TAA", desc: "宏观/估值/技术信号驱动的偏离调整" },
      { title: "再平衡规则", desc: "时间 / 阈值 / 波动三种再平衡触发" },
    ],
    outputs: ["配置建议书", "轮动模型", "组合回测报告"],
    connectivity: "输入来自宏观学院周期、估值学院股债利差、量化学院回测；输出指导风险学院仓位。",
    upstream: ["macro", "cycle", "valuation", "quant", "liquidity"],
    downstream: ["trading"],
    siteModules: [
      { label: "个人理财建议", href: "/advice" },
      { label: "对比中心", href: "/compare" },
    ],
    roadmap: {
      v1: "资产类别概览与简单配置建议",
      v2: "SAA/TAA 双层模型 + 再平衡规则",
      v3: "风险平价引擎 + AI 动态再平衡",
    },
  },
  {
    slug: "trading",
    no: "A11",
    name: "交易与风险学院",
    en: "Trading & Risk",
    icon: "shield",
    tone: "#eab308",
    stage: 4,
    role: "建立仓位规则与风控阈值，确保风险可控、执行有纪律。",
    questions: [
      "组合风险敞口是否在阈值内？",
      "如何动态调仓以控制回撤？",
    ],
    indicators: [
      { name: "仓位规则", desc: "单笔风险 ≤1%-2%、单行业 ≤25%、单个股 ≤10%、总仓位动态（进攻60-80%/平衡40-60%/防守20-40%）、金字塔加仓（盈利递减/亏损不加）", source: "策略设定" },
      { name: "风控阈值", desc: "止损（个股 -8%/行业 -10%/账户 -15%）、回撤 ≥20% 调整上限、波动目标", source: "策略设定" },
      { name: "压力测试", desc: "极端情景组合回撤模拟", source: "自算" },
    ],
    methods: [
      { title: "仓位管理手册", desc: "分层仓位规则与加仓纪律" },
      { title: "风控阈值表", desc: "个股/行业/账户三级止损与回撤熔断" },
      { title: "每日风险监控", desc: "敞口、VaR、回撤的日度核对" },
    ],
    outputs: ["仓位管理手册", "风控阈值表", "每日风险监控"],
    connectivity: "接收配置学院目标仓位与量化学院风险数据；输出约束决策流程第 9/10 步（风险评估/仓位决策）。",
    upstream: ["allocation", "quant", "technical", "valuation"],
    downstream: [],
    siteModules: [{ label: "危机决策测验", href: "/history?tab=crisis" }],
    roadmap: {
      v1: "交易纪律框架 + 风控清单",
      v2: "仓位规则 + 风控阈值系统化",
      v3: "AI 交易助手 + 实时风控预警",
    },
  },
  {
    slug: "ai",
    no: "A12",
    name: "AI 研究中心",
    en: "AI Research Center",
    icon: "sparkles",
    tone: "#a855f7",
    stage: 4,
    role: "辅助数据整理与报告生成，作为跨学院「数据与报告中台」，不替代人工决策。",
    questions: [
      "如何自动化数据抓取与报告初稿？",
      "情报聚合与异常监测如何支撑研究？",
    ],
    indicators: [
      { name: "数据抓取清洗", desc: "行情/公告/舆情的数据自动化", source: "公开数据源" },
      { name: "报告初稿生成", desc: "日报/周报初稿的自动草拟", source: "AI 生成（人工审定）" },
      { name: "情报聚合", desc: "舆情 / 公告 / 研报摘要", source: "公开资讯" },
      { name: "异常监测", desc: "财务 / 价格异常预警", source: "模型检测" },
    ],
    methods: [
      { title: "自动日报草稿", desc: "数据整理 → 初稿生成 → 人工审定" },
      { title: "复盘辅助", desc: "决策归档、检索与盈亏归因整理" },
      { title: "合规边界", desc: "仅提供信息与初稿；最终研判与买卖必须人工；AI 输出不构成投资建议；合规/风控/伦理判断不自动化" },
    ],
    outputs: ["自动日报草稿", "舆情摘要", "数据工具集", "预警清单"],
    connectivity: "作为跨学院「数据与报告中台」，为各学院周报与复盘归档提供自动化支撑，但不介入最终决策。",
    upstream: ["macro", "industry", "company", "quant", "trading"],
    downstream: [],
    siteModules: [{ label: "政策 AI 解读", href: "/policy" }],
    roadmap: {
      v1: "AI 政策解读 + 内容生成",
      v2: "情报聚合 + 报告初稿 + 异常监测",
      v3: "全流程线上化 + 复盘迭代闭环",
    },
  },
  {
    slug: "committee",
    no: "C01",
    name: "决策委员会",
    en: "Decision Committee",
    icon: "users",
    tone: "#c8102e",
    stage: 4,
    role: "统筹各学院输出，整合信号、交叉验证、形成统一观点并输出最终决策，协调执行与复盘。",
    questions: [
      "各学院信号是否交叉验证一致？",
      "最终决策与仓位是否与风险偏好匹配？",
    ],
    indicators: [
      { name: "信号汇总", desc: "11 环节评分信号的汇集与权重", source: "各学院输出" },
      { name: "交叉验证", desc: "多源信号一致性检查", source: "自研" },
      { name: "决策档案", desc: "决策记录、依据与结果归档", source: "自研" },
    ],
    methods: [
      { title: "统一观点形成", desc: "汇集信号 → 交叉验证 → 形成统一观点" },
      { title: "决策输出", desc: "买卖/结构/仓位最终裁定" },
      { title: "复盘闭环", desc: "盈亏归因 → 流程复盘 → 体系迭代" },
    ],
    outputs: ["最终投资决策", "仓位指令", "复盘报告"],
    connectivity: "统筹第 10 步仓位决策与第 11 步复盘优化；AI 中心提供归档与复盘辅助，决策由委员会人工作出。",
    upstream: ["macro", "liquidity", "cycle", "industry", "company", "valuation", "technical", "quant", "allocation", "trading"],
    downstream: [],
    siteModules: [{ label: "体系总览", href: "/gmrds" }],
    roadmap: {
      v1: "决策流程文档化",
      v2: "评分信号汇总面板",
      v3: "全流程线上化决策 + 复盘迭代",
    },
  },
];

/** 统一决策流程：11 环节闭环（宏观 → 决策 → 复盘），输入/分析/输出逐级传递 */
export interface FlowStep {
  no: number;
  title: string;
  input: string;
  analysis: string;
  output: string;
  sourceAcademies: string[];
  stage: 1 | 2 | 3 | 4;
}

export const DECISION_FLOW: FlowStep[] = [
  { no: 1, title: "宏观研判", input: "周期 / 政策 / 通胀", analysis: "美林时钟、政策松紧", output: "宏观评分 + 资产偏好", sourceAcademies: ["macro"], stage: 1 },
  { no: 2, title: "流动性评估", input: "央行 / 资金 / 利率", analysis: "松紧判断、增量方向", output: "流动性评分 + 风格", sourceAcademies: ["liquidity"], stage: 1 },
  { no: 3, title: "周期定位", input: "趋势 / 估值 / 广度", analysis: "牛熊识别、情绪冷热", output: "周期结论 + 风险偏好", sourceAcademies: ["cycle", "technical"], stage: 2 },
  { no: 4, title: "行业景气", input: "量价 / 高频 / 景气", analysis: "上/下行判断、拥挤度", output: "优选行业 + 配置建议", sourceAcademies: ["industry"], stage: 2 },
  { no: 5, title: "盈利评估", input: "财务 / 模式 / 成长", analysis: "盈利质量与可持续", output: "重点公司池 + 排序", sourceAcademies: ["company"], stage: 3 },
  { no: 6, title: "估值判断", input: "PE/PB/PEG/分位", analysis: "合理区间、安全边际", output: "估值分位 + 低估/高估", sourceAcademies: ["valuation"], stage: 3 },
  { no: 7, title: "技术确认", input: "均线 / 形态 / 广度", analysis: "趋势方向与择时", output: "技术信号 + 关键点位", sourceAcademies: ["technical"], stage: 3 },
  { no: 8, title: "情绪评估", input: "两融 / 成交 / 贪婪指数", analysis: "冷热、逆向/顺势", output: "情绪评分 + 逆向提示", sourceAcademies: ["cycle", "liquidity"], stage: 2 },
  { no: 9, title: "风险评估", input: "回撤 / 相关性 / VaR", analysis: "敞口、极端测试", output: "风险等级 + 规避项", sourceAcademies: ["quant", "trading"], stage: 4 },
  { no: 10, title: "仓位决策", input: "全部评分信号", analysis: "综合打分、定仓位", output: "最终决策（买卖/结构）", sourceAcademies: ["committee"], stage: 4 },
  { no: 11, title: "复盘优化", input: "交易结果 / 记录", analysis: "盈亏归因、流程复盘", output: "优化建议 + 迭代", sourceAcademies: ["committee", "ai"], stage: 4 },
];

export const FLOW_STAGES = [
  { no: 1, label: "宏观环境", desc: "环境扫描与周期定位" },
  { no: 2, label: "资产与行业", desc: "配置框架与赛道筛选" },
  { no: 3, label: "标的研究", desc: "基本面 · 估值 · 技术" },
  { no: 4, label: "执行与优化", desc: "验证 · 决策 · 风控 · 复盘" },
] as const;

/** 迭代路线图（核心能力 + 模块边界） */
export interface RoadmapVersion {
  version: string;
  name: string;
  core: string[];
  boundary: string;
  quantLevel: string;
  linkageLevel: string;
  aiLevel: string;
}

export const ROADMAP: RoadmapVersion[] = [
  {
    version: "V1.0",
    name: "基础版",
    core: [
      "十二学院框架文档化",
      "全球指数日度监控",
      "宏观与行业基础整理",
      "核心公司池与基础估值",
      "决策流程文档化",
    ],
    boundary: "人工主导 · Excel 辅助 · 公开宏观与指数数据",
    quantLevel: "基础统计：收益 / 回撤 / 夏普等描述性指标",
    linkageLevel: "全球指数日度监控与相对强弱排序",
    aiLevel: "内容生成与政策解读",
  },
  {
    version: "V2.0",
    name: "专业版",
    core: [
      "量化统计模块（回撤/分布/相关性自动化）",
      "跨市场联动矩阵",
      "行业高频景气自动抓取",
      "仓位与风控系统化",
      "SAA/TAA 配置模型",
    ],
    boundary: "量化 + 跨市场联动 + 行业数据自动化",
    quantLevel: "回撤/分布/相关性自动化 + 回测框架",
    linkageLevel: "跨市场联动矩阵 + 风险雷达图",
    aiLevel: "情报聚合 + 报告初稿 + 异常监测",
  },
  {
    version: "V3.0",
    name: "研究平台版",
    core: [
      "一体化平台（数据库 + 分析工具 + 看板）",
      "AI 辅助（数据 / 报告 / 情报 / 预警）",
      "实时流动性监测",
      "全流程线上化（决策 / 复盘 / 迭代）",
      "全谱系资产覆盖与智能配置",
    ],
    boundary: "AI 赋能 + 实时数据 + 平台化运作",
    quantLevel: "AI 因子挖掘 + 实时统计引擎",
    linkageLevel: "全谱系资产实时档案 + 跨市场风险传导监测",
    aiLevel: "全流程线上化 + 复盘迭代闭环",
  },
];

/** 跨版本整合核心（5 条） */
export const INTEGRATION_PILLARS = [
  { title: "统一数据底座", desc: "指数行情、财务、估值分位、资金流向等核心数据一次录入，多学院复用，消除重复建设。" },
  { title: "共享分析工具箱", desc: "量化统计学院的相关性/回撤/统计方法被行业拥挤度、风险监控、配置回测横向调用。" },
  { title: "决策闭环贯通", desc: "11 环节逐级传递评分，每步明确上游输入与下游输出，形成可追溯、可复盘的完整链路。" },
  { title: "AI 作为中台", desc: "AI 研究中心横跨各学院提供自动化支撑，但不介入人工决策，确保合规与风控边界。" },
  { title: "版本平滑升级", desc: "V2.0 在 V1.0 数据基础上叠加量化模块，V3.0 在 V2.0 模型基础上平台化与 AI 化，每版保留上版成果。" },
];

export function academyBySlug(slug: string): Academy | undefined {
  return ACADEMIES.find((a) => a.slug === slug);
}
