import { bootstrap, db, uid, now } from "../lib/db";
import { isPg } from "../lib/db";
import * as s from "../lib/db/schema";

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260819);
const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function ym(yearsBackCount: number, monthOffset = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsBackCount);
  d.setMonth(d.getMonth() + monthOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function ymd(yearsBackCount: number, monthOffset = 0, day = 1) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsBackCount);
  d.setMonth(d.getMonth() + monthOffset);
  d.setDate(day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PROVINCES: Record<string, { gdp2025: number; pop: number; growth: number }> = {
  广东: { gdp2025: 14.6, pop: 1.27, growth: 5.5 }, 江苏: { gdp2025: 13.9, pop: 0.85, growth: 5.8 },
  山东: { gdp2025: 10.2, pop: 1.01, growth: 5.6 }, 浙江: { gdp2025: 9.4, pop: 0.66, growth: 6.0 },
  河南: { gdp2025: 6.6, pop: 0.98, growth: 4.5 }, 四川: { gdp2025: 6.7, pop: 0.84, growth: 5.7 },
  湖北: { gdp2025: 6.3, pop: 0.58, growth: 5.9 }, 福建: { gdp2025: 6.0, pop: 0.42, growth: 5.5 },
  湖南: { gdp2025: 5.5, pop: 0.66, growth: 4.8 }, 上海: { gdp2025: 5.6, pop: 0.25, growth: 5.2 },
  安徽: { gdp2025: 5.3, pop: 0.61, growth: 5.6 }, 河北: { gdp2025: 4.9, pop: 0.74, growth: 4.2 },
  北京: { gdp2025: 5.2, pop: 0.22, growth: 5.0 }, 陕西: { gdp2025: 3.7, pop: 0.39, growth: 5.4 },
  江西: { gdp2025: 3.5, pop: 0.45, growth: 4.6 }, 重庆: { gdp2025: 3.4, pop: 0.32, growth: 5.8 },
  辽宁: { gdp2025: 3.3, pop: 0.42, growth: 4.1 }, 云南: { gdp2025: 3.3, pop: 0.47, growth: 4.9 },
  广西: { gdp2025: 3.0, pop: 0.5, growth: 4.4 }, 山西: { gdp2025: 2.7, pop: 0.35, growth: 4.3 },
  内蒙古: { gdp2025: 2.7, pop: 0.24, growth: 5.2 }, 贵州: { gdp2025: 2.4, pop: 0.39, growth: 5.1 },
  新疆: { gdp2025: 2.2, pop: 0.26, growth: 6.3 }, 天津: { gdp2025: 1.9, pop: 0.14, growth: 4.7 },
  黑龙江: { gdp2025: 1.7, pop: 0.31, growth: 3.0 }, 吉林: { gdp2025: 1.5, pop: 0.24, growth: 5.0 },
  甘肃: { gdp2025: 1.4, pop: 0.25, growth: 4.8 }, 海南: { gdp2025: 0.85, pop: 0.1, growth: 6.8 },
  宁夏: { gdp2025: 0.6, pop: 0.07, growth: 5.6 }, 青海: { gdp2025: 0.42, pop: 0.06, growth: 4.2 },
  西藏: { gdp2025: 0.3, pop: 0.04, growth: 7.0 },
};

const INDICATOR_DEFS = [
  { name: "CPI 同比", category: "物价", unit: "%", source: "国家统计局", type: "cpi" },
  { name: "PPI 同比", category: "物价", unit: "%", source: "国家统计局", type: "ppi" },
  { name: "制造业 PMI", category: "景气", unit: "—", source: "国家统计局", type: "pmi" },
  { name: "M2 同比增速", category: "货币", unit: "%", source: "中国人民银行", type: "m2" },
  { name: "社会融资规模增量", category: "货币", unit: "万亿元", source: "中国人民银行", type: "tsf" },
  { name: "出口同比", category: "外贸", unit: "%", source: "海关总署", type: "export" },
  { name: "城镇调查失业率", category: "就业", unit: "%", source: "国家统计局", type: "unemp" },
  { name: "工业增加值同比", category: "生产", unit: "%", source: "国家统计局", type: "ind" },
  { name: "社会消费品零售同比", category: "消费", unit: "%", source: "国家统计局", type: "retail" },
  { name: "固定资产投资同比", category: "投资", unit: "%", source: "国家统计局", type: "invest" },
];

function series(type: string, i: number): number {
  const t = i / 12;
  const season = Math.sin(t * Math.PI * 2) * 0.6;
  const noise = (rng() - 0.5) * 1.4;
  switch (type) {
    case "cpi": return round1(1.6 + t * -0.02 + season * 0.5 + noise * 0.4);
    case "ppi": return round1(-1.5 + t * 0.12 + season * 0.4 + noise);
    case "pmi": return round1(50.1 + Math.sin(t * Math.PI * 0.6) * 0.9 + noise * 0.5);
    case "m2": return round1(8.4 + t * 0.15 + noise * 0.4);
    case "tsf": return round2(2.3 + Math.abs(noise) * 1.2 + season * 0.6);
    case "export": return round1(3.5 + t * 0.1 + season * 1.5 + noise * 2);
    case "unemp": return round1(5.2 + season * 0.15 + noise * 0.2);
    case "ind": return round1(5.4 + season * 0.8 + noise);
    case "retail": return round1(4.6 + season * 0.8 + noise * 1.2);
    case "invest": return round1(3.8 + t * -0.05 + noise);
    default: return round1(noise);
  }
}

const POLICIES = [
  {
    title: "国务院关于加力扩围实施“两新”政策的通知", department: "国务院", category: "消费促进",
    summary: "加力支持大规模设备更新和消费品以旧换新，扩大补贴范围与力度。",
    popular: "简单说：国家出钱鼓励大家换新家电、换新车、企业换新设备，买东西有补贴，既能省钱又能拉动经济。",
    professional: "政策要点：1）消费品以旧换新补贴品类从 8 类扩围至 12 类；2）设备更新贷款财政贴息比例提高至 2 个百分点；3）对新能源汽车、家电等重点领域安排超长期特别国债资金支持。预计带动社会消费品零售总额增长 0.5-0.8 个百分点。利好家电、汽车、工程机械产业链，关注白色家电龙头与充电桩基础设施运营商。",
  },
  {
    title: "中国人民银行决定下调金融机构存款准备金率0.5个百分点", department: "中国人民银行", category: "货币政策",
    summary: "全面降准 0.5 个百分点，释放长期资金约 1 万亿元。",
    popular: "简单说：银行不用存那么多“押金”了，可以多放贷款，市场上的钱变多，贷款利率有望下降。",
    professional: "降准释放约 1 万亿长期资金，对冲 MLF 到期并降低银行负债成本约 20bp。预计 1Y LPR 后续有 10-20bp 下调空间，对银行息差中性偏正、对地产链与高股息资产形成流动性支撑。股市风险偏好改善，成长风格短期占优。",
  },
  {
    title: "国家发展改革委：加快建设全国统一大市场", department: "国家发展改革委", category: "改革",
    summary: "破除地方保护和市场分割，推动要素市场化配置。",
    popular: "简单说：以后各省之间做生意更顺畅，商品和人才流动的“隐形门槛”要被拆掉。",
    professional: "核心是清理废除妨碍全国统一市场的政策文件，规范招商引资行为，推进电力、数据等要素市场化。利好跨区域布局的消费品龙头、物流企业；对依赖地方保护的中小企业短期形成竞争压力。关注后续细则对平台经济反垄断的边际影响。",
  },
  {
    title: "财政部：提高个人所得税专项附加扣除标准", department: "财政部", category: "财税",
    summary: "提高子女教育、赡养老人等专项附加扣除标准，减轻居民负担。",
    popular: "简单说：交税更少了，上有老下有小的家庭每个月能多留点钱。",
    professional: "子女教育、3 岁以下婴幼儿照护扣除标准各提高 1000 元/月，赡养老人扣除提高至 3000 元/月。测算全年减税约 1500 亿元，边际消费倾向约 0.6，对应拉动居民消费约 900 亿元，对必需消费、教育板块有正面传导。",
  },
  {
    title: "国务院印发《推动大规模设备更新和消费品以旧换新行动方案》", department: "国务院", category: "产业政策",
    summary: "统筹设备更新、消费品以旧换新、回收循环利用三大行动。",
    popular: "简单说：国家鼓励工厂换机器、家庭换家电，旧东西回收再利用，一套组合拳拉动内需。",
    professional: "行动方案覆盖工业、农业、建筑、交通、教育文旅医疗六大领域设备更新，明确到 2027 年设备投资规模较 2023 年增长 25% 以上。重点受益：数控机床、工业机器人、农机、客车龙头；回收环节利好再生资源龙头。测算五年拉动投资超 5 万亿元。",
  },
  {
    title: "证监会：深化资本市场改革 提高上市公司质量", department: "证监会", category: "资本市场",
    summary: "严格退市标准，强化分红约束，引导中长期资金入市。",
    popular: "简单说：上市公司的门槛和规矩更严了，差的公司会被淘汰，好公司要老实分红。",
    professional: "退市新规收紧财务类与交易类退市指标，鼓励分红与回购注销。利好高股息蓝筹与治理优质公司；壳资源与微盘股承压。中长期资金（保险、社保）入市比例提升，市场风格向价值与龙头集中。",
  },
  {
    title: "国务院关于促进民营经济发展壮大的意见", department: "国务院", category: "改革",
    summary: "优化民营经济发展环境，破除市场准入壁垒。",
    popular: "简单说：国家给民营企业“撑腰”，做生意更公平，贷款更容易。",
    professional: "从营商环境、政策支持、法治保障三方面提出 31 条举措，明确民营经济是推进中国式现代化的生力军。利好平台经济、专精特新中小企业；配套的融资支持政策利好银行对公信贷投放。关注民营房企融资白名单的落地节奏。",
  },
  {
    title: "工信部：加快推进新型工业化 建设制造强国", department: "工信部", category: "产业政策",
    summary: "聚焦高端化、智能化、绿色化，巩固产业基础能力。",
    popular: "简单说：国家要把制造业做强做精，重点支持高端芯片、工业软件这些“卡脖子”领域。",
    professional: "实施产业基础再造工程和重大技术装备攻关工程，制造业重点产业链高质量发展行动加码。利好半导体设备与材料、工业母机、工业软件、机器人本体与核心零部件；关注国产替代进度与下游资本开支周期。",
  },
  {
    title: "住建部：多措并举促进房地产市场平稳健康发展", department: "住建部", category: "房地产",
    summary: "因城施策支持刚性和改善性住房需求，加快保交楼。",
    popular: "简单说：国家想让房子“稳”下来，该交的楼要交，买房的支持政策继续给。",
    professional: "政策组合：首付比例与利率下行、城中村改造扩围、保交楼专项借款加码。核心城市限购继续松绑。短期看销售数据筑底，关注核心城市二手房成交与土地市场溢价率边际变化；中期行业进入“保障房+商品房”双轨制新阶段。",
  },
  {
    title: "商务部：全面实施跨境服务贸易负面清单", department: "商务部", category: "对外开放",
    summary: "放宽跨境服务贸易市场准入，提升制度型开放水平。",
    popular: "简单说：外国公司来中国做服务生意更容易了，中国服务业要跟国际接轨。",
    professional: "首张全国版跨境服务贸易负面清单发布，涉及专业服务、金融服务等领域有序开放。利好跨境电商、物流、数字服务企业；对国内竞争性服务业形成“鲶鱼效应”。关注后续细则对数据出境、外资控股比例的具体安排。",
  },
  {
    title: "央行：推动存量房贷利率下调", department: "中国人民银行", category: "货币政策",
    summary: "引导商业银行有序下调存量首套房贷利率，平均降幅约 0.5 个百分点。",
    popular: "简单说：以前买房贷款的人，每个月月供会变少，直接省下一笔钱。",
    professional: "存量房贷利率平均下调 50bp，涉及规模约 37 万亿，年化减轻居民利息负担约 1700 亿元。边际消费倾向约 0.55-0.65，预计拉动消费 900-1100 亿元。银行净息差短期承压约 7bp，降准对冲后影响可控。",
  },
  {
    title: "国务院：发展新一代人工智能产业", department: "国务院", category: "产业政策",
    summary: "实施“人工智能+”行动，推动 AI 与制造业、服务业深度融合。",
    popular: "简单说：国家大力支持人工智能，AI 会进入工厂、医院、学校，相关行业要起飞。",
    professional: "“人工智能+”行动覆盖制造、医疗、教育、交通等 15 个重点领域，配套算力基础设施、数据要素市场建设。利好 AI 算力（GPU 服务器、光模块）、大模型应用、智能终端产业链。测算到 2027 年 AI 核心产业规模超 6000 亿元。",
  },
  {
    title: "税务总局：延续实施小微企业税收优惠政策", department: "税务总局", category: "财税",
    summary: "小微企业增值税、所得税优惠政策再延续三年。",
    popular: "简单说：小公司、小店铺继续少交税，创业做生意的成本更低了。",
    professional: "小规模纳税人增值税起征点、小型微利企业所得税优惠延续至 2027 年，减税规模约 5000 亿元/年。直接改善小微企业现金流，利好消费服务、批发零售等吸纳就业主体；对地方财政收入形成一定压力，关注转移支付配套。",
  },
  {
    title: "国务院办公厅：优化完善生育支持政策体系", department: "国务院办公厅", category: "民生",
    summary: "完善生育补贴、托育服务、住房支持等生育配套政策。",
    popular: "简单说：国家补贴生娃养娃，托育更便宜，多孩家庭买房有照顾。",
    professional: "建立生育补贴制度，扩大普惠托育供给，多孩家庭住房支持纳入保障体系。利好母婴消费、托育服务、辅助生殖产业链；人口结构改善中期利好地产与消费。测算生育补贴年投入约 800 亿元。",
  },
];

const CHAINS = [
  {
    name: "新能源汽车产业链", slug: "nev", sentiment: "high", description: "电动化+智能化双轮驱动，出口与内需共振，产业链景气度处于高位。",
    nodes: [
      { name: "锂矿资源", level: "上游", companies: ["赣锋锂业", "天齐锂业", "盐湖股份"] },
      { name: "动力电池", level: "上游", companies: ["宁德时代", "比亚迪", "亿纬锂能"] },
      { name: "电池材料", level: "上游", companies: ["恩捷股份", "天赐材料", "璞泰来"] },
      { name: "电驱电控", level: "中游", companies: ["汇川技术", "方正电机", "精进电动"] },
      { name: "整车制造", level: "中游", companies: ["比亚迪", "理想汽车", "赛力斯", "吉利汽车"] },
      { name: "智能驾驶", level: "中游", companies: ["德赛西威", "经纬恒润", "中科创达"] },
      { name: "充电桩", level: "下游", companies: ["特锐德", "盛弘股份", "绿能慧充"] },
      { name: "汽车后市场", level: "下游", companies: ["途虎养车", "中升控股", "广汇汽车"] },
    ],
  },
  {
    name: "半导体产业链", slug: "semiconductor", sentiment: "medium", description: "国产替代主线持续，先进制程受限下成熟制程与设备材料先行。",
    nodes: [
      { name: "半导体设备", level: "上游", companies: ["北方华创", "中微公司", "拓荆科技"] },
      { name: "半导体材料", level: "上游", companies: ["沪硅产业", "江丰电子", "安集科技"] },
      { name: "芯片设计", level: "中游", companies: ["韦尔股份", "兆易创新", "卓胜微"] },
      { name: "晶圆制造", level: "中游", companies: ["中芯国际", "华虹公司", "晶合集成"] },
      { name: "封装测试", level: "中游", companies: ["长电科技", "通富微电", "华天科技"] },
      { name: "终端应用", level: "下游", companies: ["华为产业链", "小米集团", "工业富联"] },
    ],
  },
  {
    name: "人工智能产业链", slug: "ai", sentiment: "high", description: "算力需求爆发，大模型商业化提速，应用端多点开花。",
    nodes: [
      { name: "AI芯片", level: "上游", companies: ["寒武纪", "海光信息", "龙芯中科"] },
      { name: "算力基础设施", level: "上游", companies: ["浪潮信息", "中科曙光", "紫光股份"] },
      { name: "光模块", level: "上游", companies: ["中际旭创", "新易盛", "天孚通信"] },
      { name: "大模型", level: "中游", companies: ["科大讯飞", "商汤科技", "百度集团"] },
      { name: "数据服务", level: "中游", companies: ["海天瑞声", "拓尔思", "每日互动"] },
      { name: "行业应用", level: "下游", companies: ["金山办公", "恒生电子", "卫宁健康"] },
      { name: "智能硬件", level: "下游", companies: ["联想集团", "石头科技", "萤石网络"] },
    ],
  },
  {
    name: "医药生物产业链", slug: "pharma", sentiment: "medium", description: "创新药出海兑现，集采影响边际减弱，老龄化需求刚性。",
    nodes: [
      { name: "原料药", level: "上游", companies: ["华海药业", "普洛药业", "天宇股份"] },
      { name: "创新药研发", level: "中游", companies: ["恒瑞医药", "百济神州", "信达生物"] },
      { name: "CXO", level: "中游", companies: ["药明康德", "泰格医药", "凯莱英"] },
      { name: "医疗器械", level: "中游", companies: ["迈瑞医疗", "联影医疗", "乐普医疗"] },
      { name: "医疗服务", level: "下游", companies: ["爱尔眼科", "通策医疗", "国际医学"] },
      { name: "医药流通", level: "下游", companies: ["上海医药", "国药控股", "九州通"] },
    ],
  },
  {
    name: "房地产产业链", slug: "realestate", sentiment: "low", description: "行业深度调整中，政策托底但销售复苏仍需时间。",
    nodes: [
      { name: "上游建材", level: "上游", companies: ["海螺水泥", "东方雨虹", "北新建材"] },
      { name: "钢铁", level: "上游", companies: ["宝钢股份", "华菱钢铁", "南钢股份"] },
      { name: "地产开发", level: "中游", companies: ["保利发展", "万科A", "招商蛇口"] },
      { name: "物业管理", level: "下游", companies: ["华润万象生活", "碧桂园服务", "保利物业"] },
      { name: "家居装修", level: "下游", companies: ["欧派家居", "顾家家居", "索菲亚"] },
      { name: "家电", level: "下游", companies: ["美的集团", "格力电器", "海尔智家"] },
    ],
  },
  {
    name: "白酒消费产业链", slug: "baijiu", sentiment: "low", description: "行业进入去库存周期，高端酒批价承压，关注需求筑底信号。",
    nodes: [
      { name: "上游粮食", level: "上游", companies: ["苏垦农发", "北大荒", "金健米业"] },
      { name: "包装材料", level: "上游", companies: ["裕同科技", "合兴包装", "美盈森"] },
      { name: "白酒酿造", level: "中游", companies: ["贵州茅台", "五粮液", "泸州老窖", "山西汾酒"] },
      { name: "酒类流通", level: "下游", companies: ["华致酒行", "银基集团", "名品世家"] },
      { name: "餐饮零售", level: "下游", companies: ["海底捞", "九毛九", "永辉超市"] },
    ],
  },
];

const chainLinkTargets: Record<string, string[]> = {
  nev: ["锂电池", "汽车零部件", "消费电子"],
  semiconductor: ["消费电子", "人工智能", "新能源"],
  ai: ["软件服务", "消费电子", "传媒"],
  pharma: ["医药流通", "消费", "养老"],
  realestate: ["建材", "金融", "家居"],
  baijiu: ["消费", "食品饮料", "餐饮"],
};

async function main() {
  await bootstrap();
  console.log(`driver: ${isPg ? "postgres" : "sqlite"}`);
  const ts = now();

  const indRows: any[] = [];
  const start = new Date("2015-01");
  let i = 0;
  for (let d = new Date(start); d <= new Date(); d.setMonth(d.getMonth() + 1), i++) {
    for (const def of INDICATOR_DEFS) {
      indRows.push({
        id: uid("ind"), name: def.name, category: def.category, unit: def.unit, source: def.source,
        type: def.type,
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        value: series(def.type, i),
        createdAt: ts, updatedAt: ts,
      });
    }
  }
  const qStart = new Date("2015-03");
  for (let d = new Date(qStart); d <= new Date(); d.setMonth(d.getMonth() + 3)) {
    indRows.push({
      id: uid("ind"), name: "GDP 同比增速", category: "总量", unit: "%", source: "国家统计局", type: "gdp",
      date: `${d.getFullYear()}-Q${d.getMonth() / 3 + 1}`,
      value: round1(6.2 + (rng() - 0.5) * 2 + (d.getFullYear() < 2020 ? 0.5 : -1.2)),
      createdAt: ts, updatedAt: ts,
    });
  }
  if (indRows.length) await db.insert(s.economicIndicators).values(indRows).onConflictDoNothing();

  const provRows: any[] = [];
  for (const [prov, meta] of Object.entries(PROVINCES)) {
    for (let year = 2025; year >= 2018; year--) {
      const back = 2025 - year;
      const gdp = round1((meta.gdp2025 / Math.pow(1 + meta.growth / 100, back)) * (0.96 + rng() * 0.06));
      const growth = round1(meta.growth - back * 0.25 + (rng() - 0.5) * 1.2);
      const pop = round2(meta.pop * (1 + back * 0.004));
      provRows.push({
        id: uid("prov"), province: prov, year,
        gdp, growth: Math.max(0.5, growth),
        perCapitaGdp: round1(gdp / pop),
        population: pop,
        fiscalRevenue: round1(gdp * (0.08 + rng() * 0.03)),
        trade: round1(gdp * (0.25 + rng() * 0.4)),
        updatedAt: ts,
      });
    }
  }
  if (provRows.length) await db.insert(s.provinceStats).values(provRows).onConflictDoNothing();

  const polRows = POLICIES.map((p: any, idx: any) => ({
    id: uid("pol"),
    title: p.title, department: p.department, category: p.category,
    publishDate: ymd(0, -idx * 2 - 1, 3 + idx * 5),
    sourceUrl: "https://www.gov.cn/",
    summary: p.summary,
    content: `${p.summary}\n\n## 政策原文要点\n\n（示例摘要，实际由抓取任务获取全文）\n\n1. ${p.popular.split("：")[1] ?? p.popular}\n2. 配套细则陆续出台，关注各部门后续执行文件。`,
    status: "published", createdAt: ts, updatedAt: ts,
  }));
  if (polRows.length) await db.insert(s.policies).values(polRows).onConflictDoNothing();
  const polRowsFromDb = await db.select().from(s.policies).limit(50);
  const anaRows = polRowsFromDb.map((p: any, idx: any) => ({
    id: uid("ana"),
    uid: p.id,
    popular: POLICIES[idx % POLICIES.length]?.popular ?? p.summary,
    professional: POLICIES[idx % POLICIES.length]?.professional ?? p.summary,
    dataLinks: JSON.stringify(["CPI", "PMI", "社融"]),
    status: "published", createdAt: ts, updatedAt: ts,
  }));
  if (anaRows.length) await db.insert(s.policyAnalyses).values(anaRows).onConflictDoNothing();

  const artRows = [
    {
      id: uid("art"), type: "monthly", slug: "macro-monthly",
      title: `宏观月报：${new Date().getFullYear()}年${new Date().getMonth()}月 经济数据全景解读`,
      summary: "消费稳步回暖，出口韧性犹存，物价低位运行，政策组合拳效果初显。",
      content: `# 宏观月报\n\n## 一句话总结\n\n**经济延续温和复苏，内需修复与政策发力是主要支撑，物价仍处低位，货币政策保持宽松取向。**\n\n## 核心数据\n\n| 指标 | 最新值 | 环比变化 |\n|---|---|---|\n| GDP 同比 | 5.2% | +0.1pp |\n| CPI 同比 | 1.4% | +0.2pp |\n| PMI | 50.6 | +0.4 |\n| M2 同比 | 8.9% | +0.3pp |\n| 社融增量 | 3.1 万亿 | 多增 0.2 万亿 |\n\n## 三大看点\n\n1. **消费端**：以旧换新政策持续发力，社会消费品零售同比增速连续三个月回升。\n2. **生产端**：制造业 PMI 重返扩张区间，高技术制造业景气度领先。\n3. **外贸端**：出口同比转正，对新兴市场出口表现亮眼，对冲欧美需求波动。\n\n## 风险与展望\n\n物价低位的根本原因是内需偏弱与产能过剩并存，关注后续财政加码与地产销售企稳信号。预计下月数据延续温和改善。\n\n*本报告由 Max AI 自动生成，数据来源：国家统计局、中国人民银行。*`,
      tags: JSON.stringify(["宏观", "月报", "GDP"]), sourceModel: "deepseek-v4-flash",
      qualityScore: "88", status: "published", publishDate: ymd(0, -1, 28), createdAt: ts, updatedAt: ts,
    },
    {
      id: uid("art"), type: "weekly", slug: "weekly-report",
      title: "Max 周报：本周市场与政策要闻回顾",
      summary: "央行释放流动性、AI 产业政策加码、两市成交活跃度回升。",
      content: `# Max 周报\n\n## 本周大事\n\n1. **央行降准落地**：释放长期资金约 1 万亿，债市收益率下行。\n2. **AI 产业政策加码**：国务院部署“人工智能+”行动，算力板块领涨。\n3. **楼市边际改善**：重点城市二手房成交环比回升。\n\n## 市场表现\n\n上证指数周涨 1.2%，创业板指涨 2.8%，人工智能、半导体、消费电子板块领涨。\n\n## 下周关注\n\n- 月度经济数据发布\n- 美联储议息会议\n- 重点城市土拍结果\n\n*本报告由 Max AI 自动生成。*`,
      tags: JSON.stringify(["周报", "市场"]), sourceModel: "glm-5",
      qualityScore: "85", status: "published", publishDate: ymd(0, 0, -1), createdAt: ts, updatedAt: ts,
    },
    {
      id: uid("art"), type: "daily", slug: "daily-review",
      title: "今日复盘：AI 算力主线领涨，两市成交破万亿",
      summary: "三大指数集体收涨，成交额重回万亿上方，AI 算力、光模块表现强势。",
      content: `# 今日复盘\n\n**指数表现**：上证指数 +0.85%，深证成指 +1.21%，创业板指 +1.68%。\n\n**板块热点**：AI 算力（+3.2%）、光模块（+2.9%）、半导体设备（+2.1%）领涨；银行、煤炭小幅回调。\n\n**资金面**：两市成交额 1.05 万亿，较昨日放量 1200 亿；北向资金净流入 32 亿元。\n\n**明日关注**：AI 应用端能否接力、指数能否站稳关键点位。\n\n*内容由 AI 自动生成，不构成投资建议。*`,
      tags: JSON.stringify(["复盘", "A股"]), sourceModel: "deepseek-v4-flash",
      qualityScore: "90", status: "published", publishDate: ymd(0, 0, 0), createdAt: ts, updatedAt: ts,
    },
    {
      id: uid("art"), type: "temperature", slug: "temperature-report",
      title: "温差报告：宏观 62° 与体感 45° 的差距从哪来？",
      summary: "数据说经济在回暖，可为什么很多人感觉不到？本文拆解“温差”的四大来源。",
      content: `# 温差报告\n\n## 温差现状\n\n本月宏观温度计 **62°**（偏暖），大众体感温度 **45°**（偏冷），温差 **17 度**。\n\n## 温差从哪里来？\n\n### 1. 平均值掩盖了结构差异\n\nCPI 同比 1.4% 是“平均”，但不同群体消费篮子差异巨大：以食品为主的群体感受约 2.5%，以服务为主的群体感受约 0.8%。\n\n### 2. 宏观增长 ≠ 个体增收\n\nGDP 增长来自高技术产业与出口部门，但传统行业与中小企业的收入感受滞后。\n\n### 3. 指标滞后于感受\n\n官方指标反映过去一个季度，而大众感受基于当下的房租、菜价、就业预期。\n\n### 4. 地区与行业分化\n\n广东、江苏体感明显好于东北、中部资源型省份；互联网与 AI 行业从业者体感远好于传统制造。\n\n## 结论\n\n宏观数据与个人体感**可以同时为真**：一个是“平均的经济”，一个是“具体的生活”。理解温差，才能避免被任何单一数字误导。\n\n*本报告由 Max AI 基于官方数据与用户体感问卷自动生成。*`,
      tags: JSON.stringify(["温差", "体感", "科普"]), sourceModel: "deepseek-v4-flash",
      qualityScore: "92", status: "published", publishDate: ymd(0, 0, -2), createdAt: ts, updatedAt: ts,
    },
  ];
  if (artRows.length) await db.insert(s.articles).values(artRows).onConflictDoNothing();

  const chainRows = CHAINS.map((c: any) => ({ id: uid("chain"), name: c.name, slug: c.slug, sentiment: c.sentiment, description: c.description, updatedAt: ts }));
  if (chainRows.length) await db.insert(s.industryChains).values(chainRows).onConflictDoNothing();
  const chainsInDb = await db.select().from(s.industryChains);
  const nodeRows: any[] = [];
  for (const c of chainsInDb) {
    const def = CHAINS.find((x: any) => x.slug === c.slug);
    if (!def) continue;
    for (const n of def.nodes) {
      nodeRows.push({
        id: uid("node"), chain_id: c.id, name: n.name, level: n.level,
        companies: JSON.stringify(n.companies), description: `${n.name}环节：${def.description.split("，")[0]}。`,
      });
    }
    for (const tgt of chainLinkTargets[c.slug] ?? []) {
      nodeRows.push({
        id: uid("node"), chain_id: c.id, name: `关联：${tgt}`, level: "下游",
        companies: JSON.stringify([]), description: `与${tgt}行业存在需求/供给联动。`,
      });
    }
  }
  if (nodeRows.length) await db.insert(s.chainNodes).values(nodeRows).onConflictDoNothing();

  const surveyRows: any[] = [];
  const ages = ["25岁以下", "25-34", "35-44", "45-54", "55岁以上"];
  const occs = ["互联网/IT", "制造业", "金融", "服务业", "公务员/事业单位", "个体/自由职业", "学生", "退休"];
  const regions = ["一线城市", "新一线", "二线城市", "三四线", "县城/农村"];
  for (let k = 0; k < 860; k++) {
    const macroHot = 62;
    const base = macroHot - 20 + rng() * 14;
    const score = Math.max(15, Math.min(95, Math.round(base + (rng() - 0.5) * 18)));
    surveyRows.push({
      id: uid("fs"), uid: null,
      answers: JSON.stringify({ income: pick([-2, -1, -1, 0, 0, 1]), job: pick([-2, -1, -1, 0, 0, 0, 1]), price: pick([-1, -1, 0, 0, 1]), housing: pick([-2, -1, -1, 0, 1]), consume: pick([-2, -1, 0, 0, 0, 1]) }),
      score, age_group: pick(ages), occupation: pick(occs), region: pick(regions),
      createdAt: ts - Math.floor(rng() * 30) * 86400000,
    });
  }
  if (surveyRows.length) await db.insert(s.feelingSurveys).values(surveyRows).onConflictDoNothing();

  const aggRows: any[] = [];
  const allScores = surveyRows.map((x: any) => x.score ?? 0);
  aggRows.push({
    id: uid("agg"), dimension: "overall", bucket: "all",
    avgScore: round1(allScores.reduce((a, b) => a + b, 0) / allScores.length),
    sampleCount: allScores.length, date: ymd(0, 0, 0),
  });
  for (const key of ["age_group", "occupation", "region"] as const) {
    const buckets = key === "age_group" ? ages : key === "occupation" ? occs : regions;
    for (const b of buckets) {
      const list = surveyRows.filter((x: any) => x[key] === b);
      if (!list.length) continue;
      aggRows.push({
        id: uid("agg"), dimension: key, bucket: b,
        avgScore: round1(list.reduce((a, x) => a + (x.score ?? 0), 0) / list.length),
        sampleCount: list.length, date: ymd(0, 0, 0),
      });
    }
  }
  if (aggRows.length) await db.insert(s.feelingAggregates).values(aggRows).onConflictDoNothing();

  const tempRows: any[] = [];
  const comps = { gdp: 58, cpi: 45, pmi: 66, employment: 50, credit: 64 };
  for (let m = 11; m >= 0; m--) {
    const base = 62 - Math.floor(rng() * 5);
    tempRows.push({
      id: uid("temp"), date: ym(0, -m), temperature: base,
      components: JSON.stringify({ ...comps, gdp: comps.gdp + Math.floor(rng() * 6) - 3 }),
      createdAt: ts,
    });
  }
  tempRows[tempRows.length - 1].temperature = 62;
  if (tempRows.length) await db.insert(s.macroTemperatures).values(tempRows).onConflictDoNothing();

  const diffRows = [
    {
      id: uid("tan"), date: ym(0, 0), temperature_diff: 17,
      content: `# 本月温差速览\n\n宏观温度 **62°**（偏暖）vs 大众体感 **45°**（偏冷），温差 **17 度**。\n\n**核心原因**：平均值掩盖结构差异、宏观增长未同步传导至居民收入、数据滞后于现实感受、地区与行业分化显著。详见《温差报告》。`,
      createdAt: ts,
    },
  ];
  if (diffRows.length) await db.insert(s.temperatureAnalyses).values(diffRows).onConflictDoNothing();

  const logRows = [
    { id: uid("log"), task_name: "macro-fetch", status: "success", detail: "国家统计局 1296 条指标入库", duration_ms: 3200, tokens: 0, createdAt: ts },
    { id: uid("log"), task_name: "policy-fetch", status: "success", detail: "抓取 3 条新政策并生成 AI 解读", duration_ms: 8400, tokens: 5200, createdAt: ts },
    { id: uid("log"), task_name: "daily-review", status: "success", detail: "收盘复盘已生成并发布", duration_ms: 6100, tokens: 3100, createdAt: ts },
    { id: uid("log"), task_name: "temperature-report", status: "success", detail: "温差报告已生成（温差 17°）", duration_ms: 7900, tokens: 4600, createdAt: ts },
  ];
  if (logRows.length) await db.insert(s.taskLogs).values(logRows).onConflictDoNothing();

  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});