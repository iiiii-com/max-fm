export interface CityInfo {
  name: string;
  gdp: string;
  pillar: string[];
  advantage: string[];
  companies: string[];
}

export interface StaticRegion {
  province: string;
  zone: "东部" | "中部" | "西部" | "东北";
  position: string;
  cities: CityInfo[];
}

export const STATIC_REGIONS: StaticRegion[] = [
  {
    province: "广东", zone: "东部", position: "外贸与高端制造第一大省，电子信息产业全球枢纽",
    cities: [
      { name: "深圳", gdp: "约 3.6 万亿", pillar: ["电子信息", "金融科技"], advantage: ["新能源车", "人工智能"], companies: ["华为", "腾讯", "比亚迪"] },
      { name: "广州", gdp: "约 3.1 万亿", pillar: ["汽车", "商贸"], advantage: ["生物医药", "数字经济"], companies: ["广汽集团", "小鹏汽车"] },
      { name: "东莞", gdp: "约 1.1 万亿", pillar: ["电子信息制造"], advantage: ["先进制造"], companies: ["立讯精密"] },
      { name: "佛山", gdp: "约 1.4 万亿", pillar: ["家电"], advantage: ["智能制造"], companies: ["美的集团", "海天味业"] },
    ],
  },
  {
    province: "江苏", zone: "东部", position: "制造业强省，工业增加值全国第一",
    cities: [
      { name: "南京", gdp: "约 1.9 万亿", pillar: ["软件信息", "汽车"], advantage: ["集成电路", "人工智能"], companies: ["国电南瑞", "南京银行"] },
      { name: "苏州", gdp: "约 2.6 万亿", pillar: ["电子信息", "装备制造"], advantage: ["生物医药", "人工智能"], companies: ["亨通光电", "东山精密"] },
      { name: "无锡", gdp: "约 1.6 万亿", pillar: ["集成电路", "物联网"], advantage: ["新能源", "高端装备"], companies: ["药明康德", "先导智能"] },
    ],
  },
  {
    province: "浙江", zone: "东部", position: "民营经济与数字经济大省",
    cities: [
      { name: "杭州", gdp: "约 2.4 万亿", pillar: ["数字经济", "电商"], advantage: ["人工智能", "金融科技"], companies: ["阿里巴巴", "海康威视", "网易"] },
      { name: "宁波", gdp: "约 1.8 万亿", pillar: ["港口物流", "制造业"], advantage: ["新材料", "汽车零部件"], companies: ["宁波银行", "均胜电子"] },
      { name: "温州", gdp: "约 0.9 万亿", pillar: ["轻工制造", "电气"], advantage: ["新能源", "民营金融"], companies: ["正泰电器", "森马服饰"] },
    ],
  },
  {
    province: "山东", zone: "东部", position: "工业门类最全的省份之一",
    cities: [
      { name: "济南", gdp: "约 1.4 万亿", pillar: ["装备制造", "软件"], advantage: ["新一代信息技术", "生物医药"], companies: ["浪潮信息", "山东黄金"] },
      { name: "青岛", gdp: "约 1.7 万亿", pillar: ["家电", "港口"], advantage: ["海洋经济", "新能源"], companies: ["海尔智家", "青岛啤酒", "海信视像"] },
      { name: "烟台", gdp: "约 1.0 万亿", pillar: ["化工", "有色"], advantage: ["核电", "高端化工"], companies: ["万华化学", "杰瑞股份"] },
    ],
  },
  {
    province: "四川", zone: "西部", position: "西部经济龙头，能源与军工重镇",
    cities: [
      { name: "成都", gdp: "约 2.5 万亿", pillar: ["电子信息", "装备制造"], advantage: ["数字经济", "航空航天"], companies: ["通威股份", "成都银行"] },
      { name: "绵阳", gdp: "约 0.4 万亿", pillar: ["电子信息", "军工电子"], advantage: ["核技术", "高端装备"], companies: ["四川长虹", "四川九洲"] },
      { name: "宜宾", gdp: "约 0.4 万亿", pillar: ["白酒", "动力电池"], advantage: ["新能源"], companies: ["五粮液", "宁德时代基地"] },
    ],
  },
  {
    province: "湖北", zone: "中部", position: "九省通衢，汽车与光电子重镇",
    cities: [
      { name: "武汉", gdp: "约 2.2 万亿", pillar: ["光电子", "汽车"], advantage: ["集成电路", "生物医药"], companies: ["烽火通信", "华工科技", "人福医药"] },
      { name: "襄阳", gdp: "约 0.6 万亿", pillar: ["汽车", "装备制造"], advantage: ["新能源汽车"], companies: ["骆驼股份"] },
      { name: "宜昌", gdp: "约 0.6 万亿", pillar: ["化工", "水电"], advantage: ["清洁能源", "磷化工"], companies: ["兴发集团", "安琪酵母"] },
    ],
  },
  {
    province: "福建", zone: "东部", position: "民营经济与新能源大省",
    cities: [
      { name: "福州", gdp: "约 1.3 万亿", pillar: ["纺织", "电子信息"], advantage: ["数字经济", "海洋经济"], companies: ["兴业银行", "福耀玻璃"] },
      { name: "厦门", gdp: "约 0.9 万亿", pillar: ["电子信息", "商贸"], advantage: ["集成电路", "生物医药"], companies: ["厦门钨业", "亿联网络"] },
      { name: "泉州", gdp: "约 1.2 万亿", pillar: ["纺织鞋服", "石化"], advantage: ["智能制造", "新材料"], companies: ["七匹狼", "九牧王"] },
      { name: "宁德", gdp: "约 0.4 万亿", pillar: ["动力电池", "锂电材料"], advantage: ["新能源"], companies: ["宁德时代", "上汽宁德基地"] },
    ],
  },
  {
    province: "安徽", zone: "中部", position: "科创策源地，新能源汽车产业黑马",
    cities: [
      { name: "合肥", gdp: "约 1.3 万亿", pillar: ["显示面板", "集成电路"], advantage: ["新能源汽车", "人工智能"], companies: ["科大讯飞", "阳光电源", "江淮汽车"] },
      { name: "芜湖", gdp: "约 0.5 万亿", pillar: ["汽车", "家电"], advantage: ["机器人", "新材料"], companies: ["海螺水泥", "长信科技"] },
    ],
  },
  {
    province: "河南", zone: "中部", position: "农业与制造业大省",
    cities: [
      { name: "郑州", gdp: "约 1.5 万亿", pillar: ["电子信息", "装备制造"], advantage: ["新能源汽车", "跨境电商"], companies: ["宇通客车", "明泰铝业"] },
      { name: "洛阳", gdp: "约 0.7 万亿", pillar: ["装备制造", "有色"], advantage: ["军工", "新材料"], companies: ["洛阳钼业", "中航光电"] },
    ],
  },
  {
    province: "湖南", zone: "中部", position: "工程机械之都",
    cities: [
      { name: "长沙", gdp: "约 1.5 万亿", pillar: ["工程机械", "食品"], advantage: ["先进制造", "数字经济"], companies: ["三一重工", "中联重科", "长沙银行"] },
      { name: "株洲", gdp: "约 0.4 万亿", pillar: ["轨道交通", "硬质合金"], advantage: ["高端装备"], companies: ["时代电气", "旗滨集团"] },
      { name: "岳阳", gdp: "约 0.5 万亿", pillar: ["石化", "食品加工"], advantage: ["现代物流"], companies: ["岳阳林纸"] },
    ],
  },
  {
    province: "上海", zone: "东部", position: "国际金融中心，全国经济第一大市",
    cities: [
      { name: "上海", gdp: "约 5.4 万亿", pillar: ["金融", "汽车"], advantage: ["集成电路", "人工智能"], companies: ["上汽集团", "中芯国际", "上海机场"] },
    ],
  },
  {
    province: "北京", zone: "东部", position: "国家科技创新中心与首都经济",
    cities: [
      { name: "北京", gdp: "约 5.2 万亿", pillar: ["软件信息", "金融"], advantage: ["人工智能", "集成电路"], companies: ["京东方A", "北方华创", "中国移动"] },
    ],
  },
  {
    province: "天津", zone: "东部", position: "北方工业重镇",
    cities: [
      { name: "天津", gdp: "约 1.8 万亿", pillar: ["石油化工", "装备制造"], advantage: ["信创", "航空航天"], companies: ["TCL中环", "天津港"] },
    ],
  },
  {
    province: "重庆", zone: "西部", position: "西部金融与制造中心",
    cities: [
      { name: "重庆", gdp: "约 3.2 万亿", pillar: ["汽车", "电子制造"], advantage: ["新能源汽车", "数字经济"], companies: ["长安汽车", "赛力斯", "重庆银行"] },
    ],
  },
  {
    province: "陕西", zone: "西部", position: "军工与能源大省",
    cities: [
      { name: "西安", gdp: "约 1.2 万亿", pillar: ["军工电子", "航空航天"], advantage: ["半导体", "数字经济"], companies: ["隆基绿能", "西部超导"] },
      { name: "咸阳", gdp: "约 0.3 万亿", pillar: ["电子", "食品"], advantage: ["新能源", "装备制造"], companies: ["彩虹股份"] },
    ],
  },
  {
    province: "河北", zone: "东部", position: "钢铁大省与京津冀协同腹地",
    cities: [
      { name: "石家庄", gdp: "约 0.8 万亿", pillar: ["医药", "纺织"], advantage: ["生物医药", "新一代信息技术"], companies: ["以岭药业", "华北制药"] },
      { name: "唐山", gdp: "约 0.94 万亿", pillar: ["钢铁", "装备制造"], advantage: ["高端钢材", "港口物流"], companies: ["唐山港", "冀东水泥"] },
    ],
  },
  {
    province: "辽宁", zone: "东北", position: "老工业基地，装备制造与软件外包",
    cities: [
      { name: "沈阳", gdp: "约 0.8 万亿", pillar: ["装备制造", "汽车"], advantage: ["机器人", "军工"], companies: ["新松机器人", "东北制药"] },
      { name: "大连", gdp: "约 0.9 万亿", pillar: ["石化", "造船"], advantage: ["海洋经济", "软件"], companies: ["恒力石化", "大连重工"] },
    ],
  },
  {
    province: "吉林", zone: "东北", position: "汽车工业摇篮",
    cities: [
      { name: "长春", gdp: "约 0.7 万亿", pillar: ["汽车", "轨道客车"], advantage: ["新能源汽车", "光电信息"], companies: ["一汽解放", "长春高新"] },
      { name: "吉林", gdp: "约 0.2 万亿", pillar: ["化工", "碳纤维"], advantage: ["新材料"], companies: ["吉林化纤"] },
    ],
  },
  {
    province: "黑龙江", zone: "东北", position: "农业与能源大省",
    cities: [
      { name: "哈尔滨", gdp: "约 0.5 万亿", pillar: ["装备制造", "食品"], advantage: ["航空航天", "生物医药"], companies: ["中直股份", "哈药股份"] },
      { name: "大庆", gdp: "约 0.3 万亿", pillar: ["石油化工", "装备"], advantage: ["页岩油", "新能源"], companies: ["大庆华科"] },
    ],
  },
  {
    province: "江西", zone: "中部", position: "有色金属与航空重镇",
    cities: [
      { name: "南昌", gdp: "约 0.8 万亿", pillar: ["汽车", "电子信息"], advantage: ["VR 产业", "航空制造"], companies: ["江铃汽车", "洪都航空"] },
      { name: "赣州", gdp: "约 0.5 万亿", pillar: ["稀土", "钨"], advantage: ["新材料", "有色金属"], companies: ["金力永磁"] },
      { name: "景德镇", gdp: "约 0.1 万亿", pillar: ["陶瓷", "航空"], advantage: ["直升机产业"], companies: ["黑猫股份"] },
    ],
  },
  {
    province: "山西", zone: "中部", position: "煤炭与能源基地",
    cities: [
      { name: "太原", gdp: "约 0.6 万亿", pillar: ["煤炭", "钢铁"], advantage: ["新材料", "信息技术"], companies: ["山西焦煤", "太钢不锈"] },
      { name: "长治", gdp: "约 0.3 万亿", pillar: ["煤炭", "光伏"], advantage: ["新能源"], companies: ["潞安环能"] },
    ],
  },
  {
    province: "贵州", zone: "西部", position: "大数据与白酒大省",
    cities: [
      { name: "贵阳", gdp: "约 0.6 万亿", pillar: ["大数据", "装备制造"], advantage: ["数字经济", "新能源材料"], companies: ["中航重机", "贵州燃气"] },
      { name: "遵义", gdp: "约 0.4 万亿", pillar: ["白酒", "茶叶"], advantage: ["酱香白酒"], companies: ["贵州茅台"] },
    ],
  },
  {
    province: "云南", zone: "西部", position: "绿色能源与旅游大省",
    cities: [
      { name: "昆明", gdp: "约 0.8 万亿", pillar: ["烟草", "生物医药"], advantage: ["绿色能源", "旅游"], companies: ["云南白药", "云天化"] },
      { name: "曲靖", gdp: "约 0.4 万亿", pillar: ["煤化工", "光伏"], advantage: ["新能源电池"], companies: ["驰宏锌锗"] },
    ],
  },
  {
    province: "广西", zone: "西部", position: "面向东盟开放门户",
    cities: [
      { name: "南宁", gdp: "约 0.6 万亿", pillar: ["食品", "机械"], advantage: ["东盟经贸", "新能源"], companies: ["南宁糖业"] },
      { name: "柳州", gdp: "约 0.4 万亿", pillar: ["汽车", "钢铁"], advantage: ["智能制造"], companies: ["柳工", "柳钢股份"] },
    ],
  },
  {
    province: "内蒙古", zone: "西部", position: "能源大区",
    cities: [
      { name: "呼和浩特", gdp: "约 0.4 万亿", pillar: ["乳业", "能源"], advantage: ["绿色能源", "大数据"], companies: ["伊利股份"] },
      { name: "包头", gdp: "约 0.4 万亿", pillar: ["钢铁", "稀土"], advantage: ["稀土新材料"], companies: ["包钢股份", "北方稀土"] },
      { name: "鄂尔多斯", gdp: "约 0.6 万亿", pillar: ["煤炭", "电力"], advantage: ["新能源", "氢能"], companies: ["鄂尔多斯"] },
    ],
  },
  {
    province: "甘肃", zone: "西部", position: "有色与航天基地",
    cities: [
      { name: "兰州", gdp: "约 0.4 万亿", pillar: ["石化", "有色"], advantage: ["新材料", "生物医药"], companies: ["兰州银行"] },
      { name: "酒泉", gdp: "约 0.1 万亿", pillar: ["风电装备", "新能源"], advantage: ["航天发射", "新能源"], companies: ["敦煌种业"] },
    ],
  },
  {
    province: "新疆", zone: "西部", position: "能源与丝绸之路经济带核心区",
    cities: [
      { name: "乌鲁木齐", gdp: "约 0.4 万亿", pillar: ["能源", "商贸"], advantage: ["新能源", "物流枢纽"], companies: ["天山股份"] },
      { name: "克拉玛依", gdp: "约 0.1 万亿", pillar: ["石油石化"], advantage: ["石油装备", "新能源"], companies: ["准油股份"] },
    ],
  },
  {
    province: "海南", zone: "东部", position: "自由贸易港",
    cities: [
      { name: "海口", gdp: "约 0.2 万亿", pillar: ["旅游", "免税"], advantage: ["自贸港", "数字贸易"], companies: ["海南机场"] },
      { name: "三亚", gdp: "约 0.1 万亿", pillar: ["旅游", "酒店"], advantage: ["免税购物", "深海科技"], companies: ["海南瑞泽"] },
    ],
  },
  {
    province: "宁夏", zone: "西部", position: "新能源与算力枢纽",
    cities: [
      { name: "银川", gdp: "约 0.3 万亿", pillar: ["化工", "装备"], advantage: ["数据中心", "新能源"], companies: ["宝丰能源"] },
    ],
  },
  {
    province: "青海", zone: "西部", position: "清洁能源与盐湖资源",
    cities: [
      { name: "西宁", gdp: "约 0.2 万亿", pillar: ["盐湖化工", "有色"], advantage: ["清洁能源", "锂电材料"], companies: ["西部矿业"] },
    ],
  },
  {
    province: "西藏", zone: "西部", position: "清洁能源与文旅资源",
    cities: [
      { name: "拉萨", gdp: "约 0.08 万亿", pillar: ["旅游", "藏药"], advantage: ["清洁能源", "数字经济"], companies: ["西藏天路", "西藏药业"] },
    ],
  },
];

export const CITY_RANK: Array<{ name: string; gdp: string; listed: number; note: string }> = [
  { name: "上海", gdp: "5.4 万亿", listed: 560, note: "2025 年口径，预估" },
  { name: "北京", gdp: "5.2 万亿", listed: 480, note: "2025 年口径，预估" },
  { name: "深圳", gdp: "3.6 万亿", listed: 570, note: "2025 年口径，预估" },
  { name: "广州", gdp: "3.2 万亿", listed: 160, note: "2025 年口径，预估" },
  { name: "重庆", gdp: "3.2 万亿", listed: 70, note: "2025 年口径，预估" },
  { name: "苏州", gdp: "2.6 万亿", listed: 200, note: "2025 年口径，预估" },
  { name: "成都", gdp: "2.5 万亿", listed: 110, note: "2025 年口径，预估" },
  { name: "杭州", gdp: "2.4 万亿", listed: 230, note: "2025 年口径，预估" },
  { name: "武汉", gdp: "2.2 万亿", listed: 70, note: "2025 年口径，预估" },
  { name: "南京", gdp: "2.0 万亿", listed: 120, note: "2025 年口径，预估" },
  { name: "宁波", gdp: "1.8 万亿", listed: 110, note: "2025 年口径，预估" },
  { name: "天津", gdp: "1.8 万亿", listed: 70, note: "2025 年口径，预估" },
  { name: "青岛", gdp: "1.7 万亿", listed: 65, note: "2025 年口径，预估" },
  { name: "无锡", gdp: "1.6 万亿", listed: 110, note: "2025 年口径，预估" },
  { name: "长沙", gdp: "1.5 万亿", listed: 80, note: "2025 年口径，预估" },
  { name: "郑州", gdp: "1.5 万亿", listed: 30, note: "2025 年口径，预估" },
  { name: "佛山", gdp: "1.4 万亿", listed: 50, note: "2025 年口径，预估" },
  { name: "济南", gdp: "1.4 万亿", listed: 50, note: "2025 年口径，预估" },
  { name: "合肥", gdp: "1.3 万亿", listed: 80, note: "2025 年口径，预估" },
  { name: "福州", gdp: "1.3 万亿", listed: 50, note: "2025 年口径，预估" },
  { name: "泉州", gdp: "1.2 万亿", listed: 40, note: "2025 年口径，预估" },
  { name: "西安", gdp: "1.2 万亿", listed: 60, note: "2025 年口径，预估" },
  { name: "南通", gdp: "1.2 万亿", listed: 50, note: "2025 年口径，预估" },
  { name: "东莞", gdp: "1.1 万亿", listed: 40, note: "2025 年口径，预估" },
  { name: "烟台", gdp: "1.0 万亿", listed: 50, note: "2025 年口径，预估" },
  { name: "常州", gdp: "1.0 万亿", listed: 70, note: "2025 年口径，预估" },
  { name: "徐州", gdp: "0.95 万亿", listed: 10, note: "2025 年口径，预估" },
  { name: "唐山", gdp: "0.94 万亿", listed: 10, note: "2025 年口径，预估" },
  { name: "大连", gdp: "0.9 万亿", listed: 50, note: "2025 年口径，预估" },
  { name: "温州", gdp: "0.9 万亿", listed: 40, note: "2025 年口径，预估" },
];

export const ZONES: Array<{ zone: "东部" | "中部" | "西部" | "东北"; position: string; provinces: string[] }> = [
  { zone: "东部", position: "高端制造、金融、数字经济", provinces: ["广东", "江苏", "浙江", "山东", "上海", "北京", "福建", "天津", "河北", "海南"] },
  { zone: "中部", position: "先进制造、交通枢纽", provinces: ["河南", "湖北", "湖南", "安徽", "江西", "山西"] },
  { zone: "西部", position: "能源、资源、军工", provinces: ["四川", "重庆", "陕西", "贵州", "云南", "广西", "内蒙古", "甘肃", "新疆", "宁夏", "青海", "西藏"] },
  { zone: "东北", position: "重工业、农业、装备", provinces: ["辽宁", "吉林", "黑龙江"] },
];