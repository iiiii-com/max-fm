export interface ChainSegment {
  stage: "上游" | "中游" | "下游";
  name: string;
  products: string;
  companies: Array<{ name: string; secid?: string; role: string }>;
}

export interface StaticChain {
  id: string;
  name: string;
  segments: ChainSegment[];
  prosperity: "高景气" | "中景气" | "低景气" | "分化";
  marketSize?: string;
  outlook?: string;
  relates: string[];
}

export const STATIC_CHAINS: StaticChain[] = [
  {
    id: "semiconductor",
    name: "半导体产业链",
    prosperity: "高景气",
    marketSize: "约 1.2 万亿（2024 年口径）",
    outlook: "AI 算力与国产替代双轮驱动，成熟制程扩产与先进封装景气延续",
    relates: ["ai", "computing", "nev", "consumer", "telecom"],
    segments: [
      {
        stage: "上游", name: "设备", products: "刻蚀机、薄膜沉积、光刻配套",
        companies: [
          { name: "北方华创", secid: "0.002371", role: "刻蚀/薄膜龙头" },
          { name: "中微公司", secid: "1.688012", role: "刻蚀设备" },
          { name: "拓荆科技", secid: "1.688072", role: "薄膜沉积" },
        ],
      },
      {
        stage: "上游", name: "材料", products: "大硅片、光刻胶、抛光液",
        companies: [
          { name: "沪硅产业", secid: "1.688126", role: "大硅片" },
          { name: "安集科技", secid: "1.688019", role: "抛光液" },
          { name: "鼎龙股份", secid: "0.300054", role: "CMP 材料" },
        ],
      },
      {
        stage: "中游", name: "设计", products: "CPU、GPU、CIS、模拟芯片",
        companies: [
          { name: "海光信息", secid: "1.688041", role: "CPU" },
          { name: "韦尔股份", secid: "1.603501", role: "CIS 图像传感器" },
          { name: "寒武纪", secid: "1.688256", role: "AI 芯片" },
        ],
      },
      {
        stage: "中游", name: "制造", products: "晶圆代工、特色工艺",
        companies: [
          { name: "中芯国际", secid: "1.688981", role: "晶圆代工" },
          { name: "华虹公司", secid: "1.688347", role: "特色工艺代工" },
        ],
      },
      {
        stage: "下游", name: "封测", products: "先进封装、测试",
        companies: [
          { name: "长电科技", secid: "1.600584", role: "封测龙头" },
          { name: "通富微电", secid: "0.002156", role: "AMD 封测" },
          { name: "华天科技", secid: "0.002185", role: "封测" },
        ],
      },
    ],
  },
  {
    id: "nev",
    name: "新能源汽车产业链",
    prosperity: "高景气",
    marketSize: "约 4.5 万亿（2024 年口径）",
    outlook: "渗透率过半后进入存量竞争，智能化与出海成为新增长极",
    relates: ["storage", "intelligent-driving", "semiconductor", "machinery", "consumer"],
    segments: [
      {
        stage: "上游", name: "锂电材料", products: "动力电池、锂盐、正负极/隔膜",
        companies: [
          { name: "宁德时代", secid: "0.300750", role: "动力电池龙头" },
          { name: "赣锋锂业", secid: "0.002460", role: "锂盐" },
          { name: "天齐锂业", secid: "0.002466", role: "锂矿" },
          { name: "恩捷股份", secid: "0.002812", role: "隔膜" },
          { name: "璞泰来", secid: "1.603659", role: "负极材料" },
        ],
      },
      {
        stage: "中游", name: "整车制造", products: "纯电/混动整车、智能座舱",
        companies: [
          { name: "比亚迪", secid: "0.002594", role: "新能源整车龙头" },
          { name: "赛力斯", secid: "1.601127", role: "问界" },
          { name: "长安汽车", secid: "0.000625", role: "自主品牌" },
        ],
      },
      {
        stage: "中游", name: "电驱电控", products: "电机、电控、热管理",
        companies: [
          { name: "汇川技术", secid: "0.300124", role: "电控龙头" },
          { name: "三花智控", secid: "0.002050", role: "汽车热管理" },
        ],
      },
      {
        stage: "下游", name: "充电与后市场", products: "充电桩运营、换电、二手车",
        companies: [
          { name: "特锐德", secid: "0.300001", role: "充电桩运营" },
          { name: "盛弘股份", secid: "0.300693", role: "充电模块" },
        ],
      },
    ],
  },
  {
    id: "ai",
    name: "人工智能产业链",
    prosperity: "高景气",
    marketSize: "约 2.5 万亿（2024 年口径）",
    outlook: "推理侧需求爆发，国产算力芯片与大模型应用双主线",
    relates: ["computing", "semiconductor", "intelligent-driving", "media-game", "lowaltitude"],
    segments: [
      {
        stage: "上游", name: "算力芯片", products: "AI 芯片、DCU、内存接口",
        companies: [
          { name: "寒武纪", secid: "1.688256", role: "AI 芯片" },
          { name: "海光信息", secid: "1.688041", role: "DCU 加速卡" },
          { name: "澜起科技", secid: "1.688008", role: "内存接口" },
        ],
      },
      {
        stage: "上游", name: "算力服务器", products: "AI 服务器、高性能计算",
        companies: [
          { name: "浪潮信息", secid: "0.000977", role: "AI 服务器" },
          { name: "中科曙光", secid: "1.603019", role: "高性能计算" },
        ],
      },
      {
        stage: "中游", name: "大模型平台", products: "基础大模型、行业模型、Agent",
        companies: [
          { name: "科大讯飞", secid: "0.002230", role: "大模型+教育" },
          { name: "三六零", secid: "1.601360", role: "安全大模型" },
        ],
      },
      {
        stage: "中游", name: "应用软件", products: "AI 办公、AIGC 创意工具",
        companies: [
          { name: "金山办公", secid: "1.688111", role: "AI 办公" },
          { name: "万兴科技", secid: "0.300624", role: "AIGC 创意软件" },
        ],
      },
      {
        stage: "下游", name: "行业应用", products: "AI 视觉、智能物联、金融科技",
        companies: [
          { name: "海康威视", secid: "0.002415", role: "AI 视觉" },
          { name: "大华股份", secid: "0.002236", role: "智能物联" },
        ],
      },
    ],
  },
  {
    id: "solar",
    name: "光伏产业链",
    prosperity: "低景气",
    marketSize: "约 1.5 万亿（2024 年口径）",
    outlook: "产能过剩出清中，N 型技术迭代与一体化龙头成本分化",
    relates: ["storage", "wind", "hydrogen", "machinery"],
    segments: [
      {
        stage: "上游", name: "硅料硅片", products: "多晶硅、单晶硅片",
        companies: [
          { name: "通威股份", secid: "1.600438", role: "多晶硅" },
          { name: "大全能源", secid: "1.688303", role: "硅料" },
          { name: "隆基绿能", secid: "1.601012", role: "单晶硅片" },
          { name: "TCL中环", secid: "0.002129", role: "硅片" },
        ],
      },
      {
        stage: "中游", name: "电池组件", products: "N 型电池、组件封装",
        companies: [
          { name: "晶科能源", secid: "1.688223", role: "N 型组件" },
          { name: "天合光能", secid: "1.688599", role: "组件" },
          { name: "晶澳科技", secid: "0.002459", role: "组件" },
        ],
      },
      {
        stage: "下游", name: "逆变器与电站", products: "逆变器、电站 EPC、运营",
        companies: [
          { name: "阳光电源", secid: "0.300274", role: "逆变器龙头" },
          { name: "正泰电器", secid: "1.601877", role: "户用光伏" },
        ],
      },
    ],
  },
  {
    id: "lowaltitude",
    name: "低空经济产业链",
    prosperity: "分化",
    marketSize: "约 5000 亿（2025 年口径）",
    outlook: "政策密集落地，适航审定、空管基建与整机取证先行",
    relates: ["defense", "commercial-space", "intelligent-driving", "telecom"],
    segments: [
      {
        stage: "上游", name: "电机与材料", products: "航空电机、碳纤维、复合材料",
        companies: [
          { name: "卧龙电驱", secid: "1.600580", role: "航空电机" },
          { name: "光威复材", secid: "0.300699", role: "碳纤维" },
          { name: "中复神鹰", secid: "1.688295", role: "碳纤维" },
        ],
      },
      {
        stage: "中游", name: "整机与无人机", products: "eVTOL、工业无人机、直升机",
        companies: [
          { name: "万丰奥威", secid: "0.002085", role: "eVTOL 合作" },
          { name: "纵横股份", secid: "1.688070", role: "工业无人机" },
          { name: "航天彩虹", secid: "0.002389", role: "无人机整机" },
        ],
      },
      {
        stage: "下游", name: "运营与空管", products: "低空运营、空管系统、飞行服务",
        companies: [
          { name: "中信海直", secid: "0.000099", role: "直升机运营" },
          { name: "深城交", secid: "0.301091", role: "低空规划" },
          { name: "莱斯信息", secid: "1.688631", role: "空管系统" },
        ],
      },
    ],
  },
  {
    id: "robot",
    name: "机器人产业链",
    prosperity: "高景气",
    marketSize: "约 1200 亿（2024 年口径）",
    outlook: "人形机器人量产元年临近，减速器、丝杠与灵巧手弹性最大",
    relates: ["machinery", "semiconductor", "intelligent-driving", "nev"],
    segments: [
      {
        stage: "上游", name: "核心零部件", products: "谐波/RV 减速器、伺服、丝杠",
        companies: [
          { name: "绿的谐波", secid: "1.688017", role: "谐波减速器" },
          { name: "双环传动", secid: "0.002472", role: "RV 减速器" },
          { name: "汇川技术", secid: "0.300124", role: "伺服系统" },
          { name: "贝斯特", secid: "0.300580", role: "滚柱丝杠" },
        ],
      },
      {
        stage: "中游", name: "机器人本体", products: "工业机器人、协作机器人、人形机器人",
        companies: [
          { name: "埃斯顿", secid: "0.002747", role: "工业机器人" },
          { name: "新松机器人", secid: "0.300024", role: "协作/移动机器人" },
          { name: "埃夫特", secid: "1.688165", role: "工业机器人" },
        ],
      },
      {
        stage: "中游", name: "灵巧手与电机", products: "空心杯电机、微型传动、传感器",
        companies: [
          { name: "鸣志电器", secid: "1.603728", role: "空心杯电机" },
          { name: "兆威机电", secid: "0.003021", role: "微型传动" },
        ],
      },
      {
        stage: "下游", name: "集成应用", products: "产线集成、焊接打磨、智慧工厂",
        companies: [
          { name: "拓斯达", secid: "0.300607", role: "智能制造集成" },
          { name: "江苏北人", secid: "1.688218", role: "焊接集成" },
        ],
      },
    ],
  },
  {
    id: "computing",
    name: "数字算力产业链",
    prosperity: "高景气",
    marketSize: "约 1.8 万亿（2024 年口径）",
    outlook: "算力基建投资高增，光模块、液冷与国产芯片景气突出",
    relates: ["ai", "semiconductor", "telecom", "storage"],
    segments: [
      {
        stage: "上游", name: "芯片与存储", products: "CPU/GPU、存储芯片、内存模组",
        companies: [
          { name: "海光信息", secid: "1.688041", role: "CPU/DCU" },
          { name: "兆易创新", secid: "1.603986", role: "存储芯片" },
          { name: "佰维存储", secid: "1.688525", role: "存储模组" },
        ],
      },
      {
        stage: "中游", name: "服务器与网络", products: "AI 服务器、交换机、光模块",
        companies: [
          { name: "浪潮信息", secid: "0.000977", role: "AI 服务器" },
          { name: "中际旭创", secid: "0.300308", role: "光模块龙头" },
          { name: "新易盛", secid: "0.300502", role: "光模块" },
          { name: "紫光股份", secid: "0.000938", role: "交换机" },
        ],
      },
      {
        stage: "下游", name: "数据中心", products: "IDC 运营、液冷温控、算力调度",
        companies: [
          { name: "润泽科技", secid: "0.300442", role: "IDC 运营" },
          { name: "英维克", secid: "0.002837", role: "液冷温控" },
          { name: "科华数据", secid: "0.002335", role: "数据中心" },
        ],
      },
    ],
  },
  {
    id: "pharma",
    name: "医药生物产业链",
    prosperity: "分化",
    marketSize: "约 3.5 万亿（2024 年口径）",
    outlook: "创新驱动转型，院内复苏与出海授权共振",
    relates: ["innovdrug", "meddevice", "medical-service", "baijiu"],
    segments: [
      {
        stage: "上游", name: "CXO 与原料药", products: "CRO/CDMO、原料药、中间体",
        companies: [
          { name: "药明康德", secid: "1.603259", role: "CXO 龙头" },
          { name: "凯莱英", secid: "0.002821", role: "CDMO" },
          { name: "华海药业", secid: "1.600521", role: "原料药" },
        ],
      },
      {
        stage: "中游", name: "化学与生物药", products: "化学制剂、疫苗、生长激素",
        companies: [
          { name: "恒瑞医药", secid: "1.600276", role: "创新药龙头" },
          { name: "智飞生物", secid: "0.300122", role: "疫苗" },
          { name: "长春高新", secid: "0.000661", role: "生长激素" },
        ],
      },
      {
        stage: "下游", name: "中药与流通", products: "中药品牌、医药商业、连锁药店",
        companies: [
          { name: "云南白药", secid: "0.000538", role: "中药龙头" },
          { name: "片仔癀", secid: "1.600436", role: "中药" },
          { name: "上海医药", secid: "1.601607", role: "医药流通" },
        ],
      },
    ],
  },
  {
    id: "innovdrug",
    name: "创新药产业链",
    prosperity: "高景气",
    marketSize: "约 1 万亿（2024 年口径）",
    outlook: "License-out 创纪录，BD 出海成为重要变现路径",
    relates: ["pharma", "medical-service", "meddevice"],
    segments: [
      {
        stage: "上游", name: "研发服务", products: "临床 CRO、全流程 CDMO、色谱填料",
        companies: [
          { name: "药明康德", secid: "1.603259", role: "CXO 龙头" },
          { name: "泰格医药", secid: "0.300347", role: "临床 CRO" },
          { name: "康龙化成", secid: "0.300759", role: "全流程 CRO" },
          { name: "纳微科技", secid: "1.688690", role: "色谱填料" },
        ],
      },
      {
        stage: "中游", name: "创新药企", products: "肿瘤、自免、代谢领域创新药",
        companies: [
          { name: "恒瑞医药", secid: "1.600276", role: "创新药龙头" },
          { name: "百济神州", secid: "1.688235", role: "PD-1 海外商业化" },
          { name: "荣昌生物", secid: "1.688331", role: "ADC" },
          { name: "贝达药业", secid: "0.300558", role: "肺癌靶向药" },
        ],
      },
      {
        stage: "下游", name: "商业化渠道", products: "医药分销、零售药店、医保支付",
        companies: [
          { name: "国药一致", secid: "0.000028", role: "医药分销" },
          { name: "益丰药房", secid: "1.603939", role: "零售药店" },
        ],
      },
    ],
  },
  {
    id: "meddevice",
    name: "医疗器械产业链",
    prosperity: "分化",
    marketSize: "约 1.2 万亿（2024 年口径）",
    outlook: "集采常态化后边际改善，国产替代向高端影像与内镜延伸",
    relates: ["pharma", "medical-service"],
    segments: [
      {
        stage: "上游", name: "影像与核心部件", products: "CT/MR/超声、探测器、探头",
        companies: [
          { name: "联影医疗", secid: "1.688271", role: "高端影像" },
          { name: "迈瑞医疗", secid: "0.300760", role: "监护/超声" },
        ],
      },
      {
        stage: "中游", name: "设备与高值耗材", products: "内窥镜、心血管介入、骨科",
        companies: [
          { name: "开立医疗", secid: "0.300633", role: "内窥镜" },
          { name: "澳华内镜", secid: "1.688212", role: "软镜" },
          { name: "乐普医疗", secid: "0.300003", role: "心血管介入" },
        ],
      },
      {
        stage: "下游", name: "IVD 与流通", products: "化学发光、分子诊断、检验服务",
        companies: [
          { name: "安图生物", secid: "1.603658", role: "化学发光" },
          { name: "新产业", secid: "0.300832", role: "发光龙头" },
        ],
      },
    ],
  },
  {
    id: "baijiu",
    name: "白酒消费产业链",
    prosperity: "分化",
    marketSize: "约 7500 亿（2024 年口径）",
    outlook: "库存去化接近尾声，名酒集中度提升、龙头韧性优于行业",
    relates: ["agrifood", "media-game", "logistics"],
    segments: [
      {
        stage: "上游", name: "原料与包装", products: "高粱、酒曲、玻璃瓶、包装",
        companies: [
          { name: "裕同科技", secid: "0.002831", role: "包装" },
          { name: "山东药玻", secid: "1.600529", role: "玻璃瓶" },
        ],
      },
      {
        stage: "中游", name: "高端白酒", products: "酱香/浓香高端酒",
        companies: [
          { name: "贵州茅台", secid: "1.600519", role: "酱香龙头" },
          { name: "五粮液", secid: "0.000858", role: "浓香龙头" },
          { name: "泸州老窖", secid: "0.000568", role: "国窖 1573" },
        ],
      },
      {
        stage: "中游", name: "次高端与区域酒", products: "清香、绵柔、徽酒、苏酒",
        companies: [
          { name: "山西汾酒", secid: "1.600809", role: "清香龙头" },
          { name: "洋河股份", secid: "0.002304", role: "绵柔浓香" },
          { name: "古井贡酒", secid: "0.000596", role: "徽酒龙头" },
        ],
      },
      {
        stage: "下游", name: "流通与电商", products: "酒类连锁、批发团购、电商",
        companies: [
          { name: "华致酒行", secid: "0.300755", role: "酒类连锁" },
        ],
      },
    ],
  },
  {
    id: "consumer",
    name: "消费电子产业链",
    prosperity: "分化",
    marketSize: "约 2.8 万亿（2024 年口径）",
    outlook: "AI 手机与折叠屏驱动换机周期，果链迎 AI 终端升级",
    relates: ["semiconductor", "ai", "telecom", "homeappliance"],
    segments: [
      {
        stage: "上游", name: "核心零部件", products: "精密结构件、声学器件、面板",
        companies: [
          { name: "立讯精密", secid: "0.002475", role: "精密制造" },
          { name: "歌尔股份", secid: "0.002241", role: "声学/VR" },
          { name: "京东方A", secid: "0.000725", role: "LCD 龙头" },
        ],
      },
      {
        stage: "中游", name: "整机组装", products: "手机/PC 代工、可穿戴组装",
        companies: [
          { name: "工业富联", secid: "1.601138", role: "代工龙头" },
          { name: "蓝思科技", secid: "0.300433", role: "玻璃盖板" },
          { name: "领益智造", secid: "0.002600", role: "精密功能件" },
        ],
      },
      {
        stage: "下游", name: "品牌与渠道", products: "手机品牌、出海消费电子",
        companies: [
          { name: "传音控股", secid: "1.688036", role: "非洲手机之王" },
          { name: "安克创新", secid: "0.300866", role: "充电出海" },
        ],
      },
    ],
  },
  {
    id: "telecom",
    name: "通信设备产业链",
    prosperity: "高景气",
    marketSize: "约 2 万亿（2024 年口径）",
    outlook: "AI 数据中心光互联升级，800G/1.6T 光模块与主设备共振",
    relates: ["computing", "ai", "consumer", "commercial-space"],
    segments: [
      {
        stage: "上游", name: "光器件与 PCB", products: "光模块、光器件、高多层 PCB、覆铜板",
        companies: [
          { name: "中际旭创", secid: "0.300308", role: "光模块龙头" },
          { name: "天孚通信", secid: "0.300394", role: "光器件" },
          { name: "沪电股份", secid: "0.002463", role: "高多层 PCB" },
          { name: "生益科技", secid: "1.600183", role: "覆铜板" },
        ],
      },
      {
        stage: "中游", name: "主设备与网络", products: "基站、传输设备、交换机路由器",
        companies: [
          { name: "中兴通讯", secid: "0.000063", role: "主设备龙头" },
          { name: "烽火通信", secid: "1.600498", role: "光通信设备" },
          { name: "紫光股份", secid: "0.000938", role: "交换机/路由器" },
        ],
      },
      {
        stage: "下游", name: "运营商与运维", products: "网络运营、基站运维、算力网络",
        companies: [
          { name: "中国移动", secid: "1.600941", role: "运营商" },
          { name: "中国电信", secid: "1.601728", role: "运营商" },
          { name: "润建股份", secid: "0.002929", role: "网络运维" },
        ],
      },
    ],
  },
  {
    id: "storage",
    name: "储能产业链",
    prosperity: "高景气",
    marketSize: "约 5000 亿（2024 年口径）",
    outlook: "强制配储与现货市场机制完善，海外大储订单高增",
    relates: ["nev", "solar", "wind", "nuclear"],
    segments: [
      {
        stage: "上游", name: "电芯与材料", products: "储能电芯、磷酸铁锂、正极材料",
        companies: [
          { name: "宁德时代", secid: "0.300750", role: "储能电芯" },
          { name: "亿纬锂能", secid: "0.300014", role: "储能电芯" },
          { name: "德方纳米", secid: "0.300769", role: "磷酸铁锂" },
          { name: "湖南裕能", secid: "0.301358", role: "磷酸铁锂正极" },
        ],
      },
      {
        stage: "中游", name: "PCS 与系统集成", products: "储能变流器、系统集成、BMS",
        companies: [
          { name: "阳光电源", secid: "0.300274", role: "储能系统" },
          { name: "盛弘股份", secid: "0.300693", role: "储能 PCS" },
          { name: "科华数据", secid: "0.002335", role: "储能变流器" },
        ],
      },
      {
        stage: "下游", name: "电站与运营", products: "独立储能电站、抽水蓄能、虚拟电厂",
        companies: [
          { name: "南网储能", secid: "1.600995", role: "抽水蓄能" },
          { name: "林洋能源", secid: "1.601222", role: "储能电站" },
        ],
      },
    ],
  },
  {
    id: "wind",
    name: "风电产业链",
    prosperity: "分化",
    marketSize: "约 3000 亿（2024 年口径）",
    outlook: "深远海与高塔筒降本共振，海风招标回暖",
    relates: ["solar", "storage", "machinery", "nuclear"],
    segments: [
      {
        stage: "上游", name: "铸件与材料", products: "轮毂铸件、主轴轴承、叶片材料",
        companies: [
          { name: "日月股份", secid: "1.603218", role: "铸件" },
          { name: "新强联", secid: "0.300850", role: "主轴轴承" },
          { name: "中材科技", secid: "0.002080", role: "叶片" },
        ],
      },
      {
        stage: "中游", name: "整机与海缆", products: "陆上/海上整机、塔筒、海底电缆",
        companies: [
          { name: "金风科技", secid: "0.002202", role: "整机龙头" },
          { name: "明阳智能", secid: "1.601615", role: "海上风电" },
          { name: "东方电缆", secid: "1.603606", role: "海缆" },
          { name: "大金重工", secid: "0.002487", role: "塔筒/管桩" },
        ],
      },
      {
        stage: "下游", name: "电站运营", products: "陆风/海风电站投资运营",
        companies: [
          { name: "龙源电力", secid: "0.001289", role: "风电运营" },
          { name: "三峡能源", secid: "1.600905", role: "新能源运营" },
        ],
      },
    ],
  },
  {
    id: "hydrogen",
    name: "氢能产业链",
    prosperity: "低景气",
    marketSize: "约 2000 亿（2024 年口径）",
    outlook: "绿氢项目批量开工，燃料电池示范城市群扩围",
    relates: ["storage", "nev", "steelcoal", "nuclear"],
    segments: [
      {
        stage: "上游", name: "制氢与储运", products: "电解槽、绿氢、储氢瓶、压缩机",
        companies: [
          { name: "隆基绿能", secid: "1.601012", role: "碱性电解槽" },
          { name: "双良节能", secid: "1.600481", role: "电解槽" },
          { name: "中材科技", secid: "0.002080", role: "储氢瓶" },
          { name: "冰轮环境", secid: "0.000811", role: "氢液化装备" },
        ],
      },
      {
        stage: "中游", name: "燃料电池", products: "燃料电池系统、电堆、空压机",
        companies: [
          { name: "亿华通", secid: "1.688339", role: "燃料电池系统" },
          { name: "潍柴动力", secid: "0.000338", role: "重卡氢燃料" },
          { name: "雪人股份", secid: "0.002639", role: "空压机" },
        ],
      },
      {
        stage: "下游", name: "加氢与应用", products: "加氢站、氢能重卡、绿氢化工",
        companies: [
          { name: "厚普股份", secid: "0.300471", role: "加氢设备" },
          { name: "美锦能源", secid: "0.000723", role: "氢能产业链布局" },
        ],
      },
    ],
  },
  {
    id: "defense",
    name: "军工产业链",
    prosperity: "分化",
    marketSize: "约 1.5 万亿（2024 年口径）",
    outlook: "十四五收官订单恢复，十五五备产、远火与军贸放量",
    relates: ["commercial-space", "lowaltitude", "shipbuilding", "machinery"],
    segments: [
      {
        stage: "上游", name: "材料与元器件", products: "碳纤维、钛合金、特种芯片、连接器",
        companies: [
          { name: "光威复材", secid: "0.300699", role: "碳纤维" },
          { name: "西部超导", secid: "1.688122", role: "钛合金/超导" },
          { name: "振华科技", secid: "0.000733", role: "军工电子" },
          { name: "紫光国微", secid: "0.002049", role: "特种芯片" },
        ],
      },
      {
        stage: "中游", name: "分系统", products: "战机、航发、导弹制导、直升机",
        companies: [
          { name: "中航沈飞", secid: "1.600760", role: "战斗机" },
          { name: "航发动力", secid: "1.600893", role: "航空发动机" },
          { name: "中直股份", secid: "1.600038", role: "直升机" },
          { name: "中兵红箭", secid: "0.000519", role: "弹药/超硬材料" },
        ],
      },
      {
        stage: "下游", name: "总装与维修", products: "运输机、装甲车辆、大修保障",
        companies: [
          { name: "中航西飞", secid: "0.000768", role: "运输机/轰炸机" },
          { name: "内蒙一机", secid: "1.600967", role: "坦克装甲车" },
        ],
      },
    ],
  },
  {
    id: "steelcoal",
    name: "钢铁煤炭产业链",
    prosperity: "低景气",
    marketSize: "约 9 万亿（2024 年口径）",
    outlook: "地产拖累需求，粗钢产量平控与并购重组优化供给",
    relates: ["machinery", "realestate", "shipbuilding", "defense"],
    segments: [
      {
        stage: "上游", name: "焦煤焦炭", products: "焦煤、喷吹煤、焦炭",
        companies: [
          { name: "山西焦煤", secid: "0.000983", role: "焦煤" },
          { name: "潞安环能", secid: "1.601699", role: "喷吹煤" },
        ],
      },
      {
        stage: "中游", name: "钢铁冶炼", products: "板材、长材、特钢、不锈钢",
        companies: [
          { name: "宝钢股份", secid: "1.600019", role: "板材龙头" },
          { name: "华菱钢铁", secid: "0.000932", role: "长材/板材" },
          { name: "抚顺特钢", secid: "1.600399", role: "高温合金钢" },
          { name: "太钢不锈", secid: "0.000825", role: "不锈钢" },
        ],
      },
      {
        stage: "下游", name: "钢材加工", products: "冷轧深加工、油井管、钢结构",
        companies: [
          { name: "甬金股份", secid: "1.603995", role: "冷轧不锈钢" },
          { name: "常宝股份", secid: "0.002478", role: "油井管" },
        ],
      },
    ],
  },
  {
    id: "agrifood",
    name: "农业食品产业链",
    prosperity: "分化",
    marketSize: "约 12 万亿（2024 年口径）",
    outlook: "生猪周期底部磨底，种业振兴与食品出海为主线",
    relates: ["baijiu", "logistics", "pharma"],
    segments: [
      {
        stage: "上游", name: "种业与农资", products: "杂交水稻、玉米种子、饲料、磷肥",
        companies: [
          { name: "隆平高科", secid: "0.000998", role: "杂交水稻" },
          { name: "登海种业", secid: "0.002041", role: "玉米种子" },
          { name: "海大集团", secid: "0.002311", role: "饲料龙头" },
        ],
      },
      {
        stage: "中游", name: "养殖与加工", products: "生猪养殖、肉制品、乳制品",
        companies: [
          { name: "牧原股份", secid: "0.002714", role: "生猪养殖" },
          { name: "温氏股份", secid: "0.300498", role: "生猪/家禽" },
          { name: "双汇发展", secid: "0.000895", role: "肉制品" },
          { name: "伊利股份", secid: "1.600887", role: "乳制品" },
        ],
      },
      {
        stage: "下游", name: "品牌食品", products: "调味品、速冻食品、休闲食品",
        companies: [
          { name: "海天味业", secid: "1.603288", role: "调味品" },
          { name: "安井食品", secid: "1.603345", role: "速冻食品" },
        ],
      },
    ],
  },
  {
    id: "petrochem",
    name: "石油化工产业链",
    prosperity: "低景气",
    marketSize: "约 15 万亿（2024 年口径）",
    outlook: "油价中枢回落，炼化价差修复与新材料转型并行",
    relates: ["steelcoal", "defense", "logistics", "machinery"],
    segments: [
      {
        stage: "上游", name: "油服与炼化", products: "海上油服、压裂设备、炼化一体化",
        companies: [
          { name: "中海油服", secid: "1.601808", role: "海上油服" },
          { name: "杰瑞股份", secid: "0.002353", role: "压裂设备" },
          { name: "中国石化", secid: "1.600028", role: "炼化一体化" },
          { name: "荣盛石化", secid: "0.002493", role: "炼化一体化" },
        ],
      },
      {
        stage: "中游", name: "化工品", products: "MDI、煤化工、轻烃一体化",
        companies: [
          { name: "万华化学", secid: "1.600309", role: "MDI 龙头" },
          { name: "华鲁恒升", secid: "1.600426", role: "煤化工" },
          { name: "卫星化学", secid: "0.002648", role: "轻烃一体化" },
        ],
      },
      {
        stage: "下游", name: "化纤橡塑", products: "涤纶长丝、轮胎、改性塑料",
        companies: [
          { name: "桐昆股份", secid: "1.601233", role: "涤纶长丝" },
          { name: "玲珑轮胎", secid: "1.601966", role: "轮胎" },
        ],
      },
    ],
  },
  {
    id: "realestate",
    name: "房地产产业链",
    prosperity: "低景气",
    marketSize: "约 10 万亿（2024 年口径）",
    outlook: "政策托底与收储推进，行业出清后集中度提升",
    relates: ["finance", "steelcoal", "homeappliance", "machinery"],
    segments: [
      {
        stage: "上游", name: "开发建设", products: "住宅开发、城市更新、保障房",
        companies: [
          { name: "保利发展", secid: "1.600048", role: "央企开发龙头" },
          { name: "万科A", secid: "0.000002", role: "综合开发" },
          { name: "招商蛇口", secid: "0.001979", role: "城市开发" },
        ],
      },
      {
        stage: "中游", name: "建材家居", products: "水泥、防水、石膏板、定制家居",
        companies: [
          { name: "海螺水泥", secid: "1.600585", role: "水泥龙头" },
          { name: "东方雨虹", secid: "0.002271", role: "防水材料" },
          { name: "北新建材", secid: "0.000786", role: "石膏板" },
          { name: "欧派家居", secid: "1.603833", role: "定制家居" },
        ],
      },
      {
        stage: "下游", name: "经纪与服务", products: "房产经纪、物业管理",
        companies: [
          { name: "我爱我家", secid: "0.000560", role: "房产经纪" },
          { name: "招商积余", secid: "0.001914", role: "物业管理" },
        ],
      },
    ],
  },
  {
    id: "finance",
    name: "银行保险产业链",
    prosperity: "分化",
    marketSize: "约 60 万亿（银行业资产，2024 年口径）",
    outlook: "息差企稳与化债推进，高股息配置价值延续",
    relates: ["realestate", "logistics", "media-game"],
    segments: [
      {
        stage: "上游", name: "金融科技", products: "金融 IT、行情终端、互联网券商",
        companies: [
          { name: "恒生电子", secid: "1.600570", role: "金融 IT" },
          { name: "同花顺", secid: "0.300033", role: "行情终端" },
          { name: "东方财富", secid: "0.300059", role: "互联网券商" },
        ],
      },
      {
        stage: "中游", name: "银行", products: "零售银行、国有大行、城商行",
        companies: [
          { name: "招商银行", secid: "1.600036", role: "零售之王" },
          { name: "工商银行", secid: "1.601398", role: "国有大行" },
          { name: "宁波银行", secid: "0.002142", role: "城商行标杆" },
        ],
      },
      {
        stage: "中游", name: "保险", products: "寿险、财险、综合金融",
        companies: [
          { name: "中国平安", secid: "1.601318", role: "综合金融" },
          { name: "中国人寿", secid: "1.601628", role: "寿险龙头" },
        ],
      },
      {
        stage: "下游", name: "券商资管", products: "投行、经纪、财富管理",
        companies: [
          { name: "中信证券", secid: "1.600030", role: "券商龙头" },
          { name: "华泰证券", secid: "1.601688", role: "财富管理" },
        ],
      },
    ],
  },
  {
    id: "crossborder",
    name: "跨境电商产业链",
    prosperity: "高景气",
    marketSize: "约 2.5 万亿（2024 年口径）",
    outlook: "Temu/TikTok Shop 扩容带动全托管模式，海外仓需求激增",
    relates: ["logistics", "media-game", "agrifood"],
    segments: [
      {
        stage: "上游", name: "品牌卖家", products: "充电、工具、服饰品牌出海",
        companies: [
          { name: "安克创新", secid: "0.300866", role: "充电品牌出海" },
          { name: "巨星科技", secid: "0.002444", role: "工具出海" },
          { name: "赛维时代", secid: "0.301381", role: "服装跨境" },
        ],
      },
      {
        stage: "中游", name: "平台与支付", products: "B2B/B2C 平台、跨境支付、出海营销",
        companies: [
          { name: "焦点科技", secid: "0.002315", role: "B2B 平台" },
          { name: "拉卡拉", secid: "0.300773", role: "跨境支付" },
          { name: "易点天下", secid: "0.301171", role: "出海营销" },
        ],
      },
      {
        stage: "下游", name: "物流仓储", products: "海外仓、头程物流、尾程派送",
        companies: [
          { name: "华凯易佰", secid: "0.300592", role: "泛品卖家" },
          { name: "乐歌股份", secid: "0.300729", role: "海外仓" },
        ],
      },
    ],
  },
  {
    id: "medical-service",
    name: "医疗服务产业链",
    prosperity: "中景气",
    marketSize: "约 6 万亿（2024 年口径）",
    outlook: "老龄化与消费医疗双轮驱动，连锁化率持续提升",
    relates: ["pharma", "meddevice", "finance"],
    segments: [
      {
        stage: "上游", name: "连锁医疗", products: "眼科、口腔、体检连锁",
        companies: [
          { name: "爱尔眼科", secid: "0.300015", role: "眼科连锁" },
          { name: "通策医疗", secid: "1.600763", role: "口腔连锁" },
          { name: "美年健康", secid: "0.002044", role: "体检龙头" },
        ],
      },
      {
        stage: "中游", name: "检验与信息化", products: "第三方检验、医疗信息化",
        companies: [
          { name: "金域医学", secid: "1.603882", role: "第三方检验" },
          { name: "卫宁健康", secid: "0.300253", role: "医疗信息化" },
          { name: "创业慧康", secid: "0.300451", role: "医疗 IT" },
        ],
      },
      {
        stage: "下游", name: "康复与家用医疗", products: "康复设备、家用医疗器械",
        companies: [
          { name: "翔宇医疗", secid: "1.688626", role: "康复设备" },
          { name: "鱼跃医疗", secid: "0.002223", role: "家用医疗" },
        ],
      },
    ],
  },
  {
    id: "nuclear",
    name: "核电产业链",
    prosperity: "高景气",
    marketSize: "约 8000 亿（2024 年口径）",
    outlook: "核准常态化，每年 8-10 台机组开工支撑十年景气",
    relates: ["defense", "machinery", "storage", "wind"],
    segments: [
      {
        stage: "上游", name: "核级材料与设备", products: "核级阀门、铸件、主设备",
        companies: [
          { name: "中核科技", secid: "0.000777", role: "核级阀门" },
          { name: "应流股份", secid: "1.603308", role: "核级铸件" },
          { name: "东方电气", secid: "1.600875", role: "核电主设备" },
        ],
      },
      {
        stage: "中游", name: "建造与系统", products: "核岛土建、常规岛、DCS 控制系统",
        companies: [
          { name: "中国核建", secid: "1.601611", role: "核岛土建" },
          { name: "中控技术", secid: "1.688777", role: "DCS 控制系统" },
          { name: "江苏神通", secid: "0.002438", role: "核电阀门" },
        ],
      },
      {
        stage: "下游", name: "运营", products: "核电运营、电力销售",
        companies: [
          { name: "中国核电", secid: "1.601985", role: "核电运营" },
          { name: "中国广核", secid: "0.003816", role: "核电运营" },
        ],
      },
    ],
  },
  {
    id: "logistics",
    name: "物流产业链",
    prosperity: "分化",
    marketSize: "约 18 万亿（2024 年口径）",
    outlook: "快递价格战收敛，出海物流与供应链服务升级",
    relates: ["crossborder", "finance", "agrifood", "realestate"],
    segments: [
      {
        stage: "上游", name: "装备与平台", products: "集装箱、智能仓储、物流平台",
        companies: [
          { name: "中集集团", secid: "0.000039", role: "物流装备" },
          { name: "音飞储存", secid: "1.603066", role: "智能仓储" },
          { name: "传化智联", secid: "0.002010", role: "公路物流平台" },
        ],
      },
      {
        stage: "中游", name: "快递快运", products: "时效快递、电商快递",
        companies: [
          { name: "顺丰控股", secid: "0.002352", role: "综合物流龙头" },
          { name: "圆通速递", secid: "1.600233", role: "快递" },
          { name: "韵达股份", secid: "0.002120", role: "快递" },
        ],
      },
      {
        stage: "中游", name: "航运港口", products: "集运、干散、油运、港口",
        companies: [
          { name: "中远海控", secid: "1.601919", role: "集运龙头" },
          { name: "上港集团", secid: "1.600018", role: "港口龙头" },
          { name: "招商轮船", secid: "1.601872", role: "干散/油运" },
        ],
      },
      {
        stage: "下游", name: "供应链服务", products: "大宗供应链、合同物流",
        companies: [
          { name: "建发股份", secid: "1.600153", role: "大宗供应链" },
          { name: "厦门象屿", secid: "1.600057", role: "供应链服务" },
        ],
      },
    ],
  },
  {
    id: "media-game",
    name: "传媒游戏产业链",
    prosperity: "高景气",
    marketSize: "约 3 万亿（2024 年口径）",
    outlook: "版号常态化 + AI 降本增效，游戏出海与短剧高增",
    relates: ["ai", "baijiu", "crossborder", "consumer"],
    segments: [
      {
        stage: "上游", name: "IP 与内容", products: "影视 IP、动画电影、数字版权",
        companies: [
          { name: "光线传媒", secid: "0.300251", role: "动画电影" },
          { name: "中国电影", secid: "1.600977", role: "电影发行" },
          { name: "中文在线", secid: "0.300364", role: "数字版权" },
        ],
      },
      {
        stage: "中游", name: "游戏研发", products: "手游、端游、买量发行",
        companies: [
          { name: "三七互娱", secid: "0.002555", role: "买量游戏" },
          { name: "完美世界", secid: "0.002624", role: "端游/手游" },
          { name: "恺英网络", secid: "0.002517", role: "传奇类" },
        ],
      },
      {
        stage: "中游", name: "影视与平台", products: "剧集、综艺、长视频平台",
        companies: [
          { name: "华策影视", secid: "0.300133", role: "剧集龙头" },
          { name: "芒果超媒", secid: "0.300413", role: "综艺平台" },
        ],
      },
      {
        stage: "下游", name: "发行与出海", products: "游戏发行、AI 应用、短剧",
        companies: [
          { name: "昆仑万维", secid: "0.300418", role: "AI+游戏出海" },
          { name: "巨人网络", secid: "0.002558", role: "征途系列" },
        ],
      },
    ],
  },
  {
    id: "commercial-space",
    name: "商业航天产业链",
    prosperity: "高景气",
    marketSize: "约 8000 亿（2024 年口径）",
    outlook: "G60/千帆星座组网提速，可回收火箭带动发射成本骤降",
    relates: ["defense", "telecom", "lowaltitude", "machinery"],
    segments: [
      {
        stage: "上游", name: "材料与动力", products: "碳纤维、3D 打印、火箭发动机",
        companies: [
          { name: "中简科技", secid: "0.300777", role: "碳纤维" },
          { name: "铂力特", secid: "1.688333", role: "3D 打印/火箭部件" },
          { name: "航天动力", secid: "1.600343", role: "液体发动机" },
        ],
      },
      {
        stage: "中游", name: "火箭与卫星", products: "火箭总装、卫星制造、星载芯片",
        companies: [
          { name: "航天科技", secid: "0.000901", role: "火箭总装" },
          { name: "中国卫星", secid: "1.600118", role: "卫星总装" },
          { name: "铖昌科技", secid: "0.001270", role: "星载相控阵芯片" },
          { name: "上海沪工", secid: "1.603131", role: "卫星制造" },
        ],
      },
      {
        stage: "下游", name: "卫星应用", products: "卫星通信、导航、遥感应用",
        companies: [
          { name: "海格通信", secid: "0.002465", role: "北斗/通信" },
          { name: "华力创通", secid: "0.300045", role: "卫星导航" },
          { name: "盟升电子", secid: "1.688311", role: "星载天线" },
        ],
      },
    ],
  },
  {
    id: "intelligent-driving",
    name: "智能驾驶产业链",
    prosperity: "高景气",
    marketSize: "约 4000 亿（2024 年口径）",
    outlook: "L2+ 渗透率快速提升，城市 NOA 进入平价放量期",
    relates: ["nev", "ai", "semiconductor", "telecom"],
    segments: [
      {
        stage: "上游", name: "传感器与地图", products: "激光雷达、车载镜头、高精地图",
        companies: [
          { name: "联创电子", secid: "0.002036", role: "车载镜头" },
          { name: "万集科技", secid: "0.300552", role: "激光雷达/路侧" },
          { name: "四维图新", secid: "0.002405", role: "高精地图/芯片" },
        ],
      },
      {
        stage: "中游", name: "域控与线控", products: "智驾域控、智能座舱、线控制动",
        companies: [
          { name: "德赛西威", secid: "0.002920", role: "智驾域控龙头" },
          { name: "中科创达", secid: "0.300496", role: "智能座舱软件" },
          { name: "伯特利", secid: "1.603596", role: "线控制动" },
          { name: "拓普集团", secid: "1.601689", role: "线控转向/空悬" },
        ],
      },
      {
        stage: "下游", name: "整车应用", products: "智驾车型、Robotaxi 运营",
        companies: [
          { name: "比亚迪", secid: "0.002594", role: "天神之眼" },
          { name: "赛力斯", secid: "1.601127", role: "问界智驾" },
        ],
      },
    ],
  },
  {
    id: "machinery",
    name: "工程机械产业链",
    prosperity: "分化",
    marketSize: "约 9000 亿（2024 年口径）",
    outlook: "内需筑底出海高增，电动化与后市场打开新空间",
    relates: ["robot", "steelcoal", "shipbuilding", "nev"],
    segments: [
      {
        stage: "上游", name: "核心零部件", products: "液压件、发动机、破碎锤",
        companies: [
          { name: "恒立液压", secid: "1.601100", role: "液压件龙头" },
          { name: "艾迪精密", secid: "1.603638", role: "破碎锤/马达" },
          { name: "潍柴动力", secid: "0.000338", role: "重卡动力" },
        ],
      },
      {
        stage: "中游", name: "整机制造", products: "挖掘机、起重机、混凝土机械",
        companies: [
          { name: "三一重工", secid: "1.600031", role: "挖掘机龙头" },
          { name: "徐工机械", secid: "0.000425", role: "起重机/挖掘机" },
          { name: "中联重科", secid: "0.000157", role: "混凝土机械" },
        ],
      },
      {
        stage: "下游", name: "租赁与服务", products: "高空作业平台、租赁运营、后市场",
        companies: [
          { name: "浙江鼎力", secid: "1.603338", role: "高空作业平台" },
          { name: "华铁应急", secid: "1.603300", role: "设备租赁" },
        ],
      },
    ],
  },
  {
    id: "homeappliance",
    name: "家用电器产业链",
    prosperity: "分化",
    marketSize: "约 1.8 万亿（2024 年口径）",
    outlook: "以旧换新政策托底内需，新兴品类与出海贡献增量",
    relates: ["consumer", "agrifood", "logistics", "realestate"],
    segments: [
      {
        stage: "上游", name: "核心部件", products: "压缩机、热管理部件、电机",
        companies: [
          { name: "三花智控", secid: "0.002050", role: "热管理部件" },
          { name: "海立股份", secid: "1.600619", role: "压缩机" },
          { name: "卧龙电驱", secid: "1.600580", role: "电机" },
        ],
      },
      {
        stage: "中游", name: "白电整机", products: "空调、冰箱、洗衣机",
        companies: [
          { name: "美的集团", secid: "0.000333", role: "综合白电龙头" },
          { name: "格力电器", secid: "0.000651", role: "空调龙头" },
          { name: "海尔智家", secid: "1.600690", role: "冰箱/洗衣机" },
        ],
      },
      {
        stage: "中游", name: "厨电与小家电", products: "厨电、清洁电器、创意小家电",
        companies: [
          { name: "苏泊尔", secid: "0.002032", role: "炊具" },
          { name: "石头科技", secid: "1.688169", role: "扫地机器人" },
          { name: "新宝股份", secid: "0.002705", role: "小家电代工" },
        ],
      },
      {
        stage: "下游", name: "渠道与品牌", products: "电商渠道、投影、智能家居",
        companies: [
          { name: "小熊电器", secid: "0.002959", role: "创意小家电" },
          { name: "极米科技", secid: "1.688696", role: "智能投影" },
        ],
      },
    ],
  },
  {
    id: "shipbuilding",
    name: "船舶制造产业链",
    prosperity: "高景气",
    marketSize: "约 5000 亿（2024 年口径）",
    outlook: "新船价格创新高，绿色甲醇双燃料船型订单占比提升",
    relates: ["defense", "machinery", "steelcoal", "logistics"],
    segments: [
      {
        stage: "上游", name: "船用配套", products: "船舶动力、锚链、船板",
        companies: [
          { name: "中国动力", secid: "1.600482", role: "船舶动力" },
          { name: "亚星锚链", secid: "1.601890", role: "锚链" },
          { name: "鞍钢股份", secid: "0.000898", role: "船板" },
        ],
      },
      {
        stage: "中游", name: "总装建造", products: "民船总装、军船、海工装备",
        companies: [
          { name: "中国船舶", secid: "1.600150", role: "民船总装龙头" },
          { name: "中船防务", secid: "1.600685", role: "军船/民船" },
          { name: "中国重工", secid: "1.601989", role: "军船总装" },
          { name: "海油工程", secid: "1.600583", role: "海上油气工程" },
        ],
      },
      {
        stage: "下游", name: "航运与修船", products: "特种船运输、船舶修理",
        companies: [
          { name: "招商轮船", secid: "1.601872", role: "航运" },
          { name: "中远海特", secid: "1.600428", role: "特种船运输" },
        ],
      },
    ],
  },
];

export function getStaticChain(id: string): StaticChain | undefined {
  return STATIC_CHAINS.find((c) => c.id === id);
}

const KEYWORD_CHAINS: Array<[string, string]> = [
  ["新能源汽车", "nev"], ["新能源车", "nev"], ["动力电池", "nev"], ["锂电池", "nev"],
  ["智能驾驶", "intelligent-driving"], ["自动驾驶", "intelligent-driving"], ["车联网", "intelligent-driving"],
  ["集成电路", "semiconductor"], ["半导体", "semiconductor"], ["芯片", "semiconductor"],
  ["光模块", "telecom"], ["光通信", "telecom"], ["通信设备", "telecom"], ["5G", "telecom"],
  ["人工智能", "ai"], ["AI", "ai"],
  ["数据中心", "computing"], ["算力", "computing"],
  ["机器人", "robot"],
  ["低空经济", "lowaltitude"], ["低空", "lowaltitude"], ["无人机", "lowaltitude"], ["eVTOL", "lowaltitude"],
  ["光伏", "solar"],
  ["储能", "storage"],
  ["氢能", "hydrogen"], ["氢燃料电池", "hydrogen"],
  ["风电", "wind"],
  ["核电", "nuclear"],
  ["酱香", "baijiu"], ["白酒", "baijiu"],
  ["创新药", "innovdrug"],
  ["医疗器械", "meddevice"],
  ["医疗服务", "medical-service"], ["医疗", "medical-service"],
  ["商业航天", "commercial-space"], ["卫星", "commercial-space"], ["火箭", "commercial-space"],
  ["航空航天", "defense"], ["军工", "defense"], ["国防", "defense"],
  ["船舶", "shipbuilding"], ["造船", "shipbuilding"],
  ["工程机械", "machinery"], ["机械", "machinery"],
  ["家电", "homeappliance"],
  ["物流", "logistics"], ["港口", "logistics"], ["航运", "logistics"],
  ["传媒", "media-game"], ["游戏", "media-game"], ["影视", "media-game"], ["电影", "media-game"],
  ["农业", "agrifood"], ["食品", "agrifood"], ["养殖", "agrifood"], ["种业", "agrifood"],
  ["钢铁", "steelcoal"], ["煤炭", "steelcoal"], ["焦煤", "steelcoal"],
  ["石油化工", "petrochem"], ["石化", "petrochem"], ["炼化", "petrochem"],
  ["房地产", "realestate"], ["地产", "realestate"],
  ["银行", "finance"], ["保险", "finance"], ["金融", "finance"], ["券商", "finance"],
  ["跨境电商", "crossborder"], ["跨境", "crossborder"],
  ["消费电子", "consumer"], ["电子信息", "consumer"], ["电子", "consumer"],
  ["医药", "pharma"], ["生物医药", "pharma"], ["疫苗", "pharma"],
];

export function matchChainId(text: string): string | undefined {
  for (const [kw, id] of KEYWORD_CHAINS) {
    if (text.includes(kw)) return id;
  }
  return undefined;
}