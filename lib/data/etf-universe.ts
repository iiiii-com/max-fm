/**
 * 静态 ETF 代码清单（人工核对过的「活跃标的」备胎库）。
 *
 * 用途：东财 push2 板块接口（clist）在部分网络环境下会被重置，
 * 导致 ETF 专区「榜单空白 / 无法显示」。此清单保证：
 *   1) 榜单页在行情源降级时仍能展示一批主流 ETF 的实时价格；
 *   2) ETF 搜索接口不可用时，可用本地名称/代码匹配兜底；
 *   3) 产业链 × ETF 面板与对比中心有稳定的代码语料。
 *
 * 维护纪律：只放核对过代码/名称的标的（东财 ulist 校验通过），
 * 宁缺毋滥；新增条目请同时确认 secid 的市场前缀（1.=沪，0.=深）。
 */
export interface EtfUniverseItem {
  code: string;
  secid: string;
  name: string;
}

export const ETF_UNIVERSE: EtfUniverseItem[] = [
  // 宽基
  { code: "510300", secid: "1.510300", name: "沪深300ETF华泰柏瑞" },
  { code: "510500", secid: "1.510500", name: "中证500ETF南方" },
  { code: "563300", secid: "1.563300", name: "中证2000ETF华泰柏瑞" },
  { code: "588000", secid: "1.588000", name: "科创50ETF华夏" },
  { code: "159915", secid: "0.159915", name: "创业板ETF易方达" },
  { code: "510900", secid: "1.510900", name: "恒生中国企业ETF易方达" },
  // 半导体 / 芯片
  { code: "512480", secid: "1.512480", name: "半导体ETF国联安" },
  { code: "159995", secid: "0.159995", name: "芯片ETF华夏" },
  { code: "512760", secid: "1.512760", name: "芯片ETF国泰" },
  { code: "159801", secid: "0.159801", name: "芯片ETF广发" },
  { code: "516920", secid: "1.516920", name: "芯片ETF汇添富" },
  // 新能源 / 光储 / 电池 / 电力
  { code: "515030", secid: "1.515030", name: "新能源车ETF华夏" },
  { code: "159755", secid: "0.159755", name: "电池ETF广发" },
  { code: "516160", secid: "1.516160", name: "新能源ETF南方" },
  { code: "515790", secid: "1.515790", name: "光伏ETF华泰柏瑞" },
  { code: "159857", secid: "0.159857", name: "光伏ETF天弘" },
  { code: "159566", secid: "0.159566", name: "储能电池ETF易方达" },
  { code: "159611", secid: "0.159611", name: "电力ETF广发" },
  { code: "562990", secid: "1.562990", name: "碳中和ETF易方达" },
  // 科技 / 计算 / 通信 / 机器人
  { code: "562500", secid: "1.562500", name: "机器人ETF华夏" },
  { code: "512720", secid: "1.512720", name: "计算机ETF国泰" },
  { code: "515880", secid: "1.515880", name: "通信ETF国泰" },
  { code: "516510", secid: "1.516510", name: "云计算ETF易方达" },
  { code: "515070", secid: "1.515070", name: "人工智能ETF华夏" },
  { code: "159819", secid: "0.159819", name: "人工智能ETF易方达" },
  { code: "515000", secid: "1.515000", name: "科技ETF华宝" },
  // 医药 / 消费
  { code: "512010", secid: "1.512010", name: "医药ETF易方达" },
  { code: "512170", secid: "1.512170", name: "医疗ETF华宝" },
  { code: "159992", secid: "0.159992", name: "创新药ETF银华" },
  { code: "517110", secid: "1.517110", name: "创新药ETF国泰" },
  { code: "517380", secid: "1.517380", name: "创新药ETF天弘" },
  { code: "159883", secid: "0.159883", name: "医疗器械ETF永赢" },
  { code: "516820", secid: "1.516820", name: "医疗创新ETF平安" },
  { code: "560080", secid: "1.560080", name: "中药ETF汇添富" },
  { code: "512690", secid: "1.512690", name: "酒ETF鹏华" },
  { code: "159732", secid: "0.159732", name: "消费电子ETF华夏" },
  { code: "562950", secid: "1.562950", name: "消费电子ETF易方达" },
  { code: "159996", secid: "0.159996", name: "家电ETF国泰" },
  { code: "159766", secid: "0.159766", name: "旅游ETF富国" },
  // 军工 / 周期 / 地产金融
  { code: "512660", secid: "1.512660", name: "军工ETF国泰" },
  { code: "512670", secid: "1.512670", name: "国防ETF鹏华" },
  { code: "515210", secid: "1.515210", name: "钢铁ETF国泰" },
  { code: "515220", secid: "1.515220", name: "煤炭ETF国泰" },
  { code: "512400", secid: "1.512400", name: "有色金属ETF南方" },
  { code: "561360", secid: "1.561360", name: "石油ETF国泰" },
  { code: "561260", secid: "1.561260", name: "能源ETF工银" },
  { code: "512200", secid: "1.512200", name: "房地产ETF南方" },
  { code: "512800", secid: "1.512800", name: "银行ETF华宝" },
  { code: "512880", secid: "1.512880", name: "证券ETF国泰" },
  // 农业 / 基建 / 物流 / 机械
  { code: "159865", secid: "0.159865", name: "养殖ETF国泰" },
  { code: "516670", secid: "1.516670", name: "畜牧养殖ETF招商" },
  { code: "516970", secid: "1.516970", name: "基建ETF广发" },
  { code: "516910", secid: "1.516910", name: "物流ETF富国" },
  { code: "560280", secid: "1.560280", name: "工程机械ETF广发" },
  // 汽车 / 智能驾驶
  { code: "515250", secid: "1.515250", name: "智能汽车ETF富国" },
  { code: "516110", secid: "1.516110", name: "汽车ETF国泰" },
  // 传媒 / 游戏 / 互联网 / 港股
  { code: "159869", secid: "0.159869", name: "游戏ETF华夏" },
  { code: "512980", secid: "1.512980", name: "传媒ETF广发" },
  { code: "513050", secid: "1.513050", name: "中概互联网ETF易方达" },
  { code: "513330", secid: "1.513330", name: "恒生互联网ETF华夏" },
  { code: "513180", secid: "1.513180", name: "恒生科技ETF华夏" },
  { code: "159920", secid: "0.159920", name: "恒生ETF华夏" },
  // 跨境 / 商品
  { code: "513100", secid: "1.513100", name: "纳指ETF国泰" },
  { code: "518880", secid: "1.518880", name: "黄金ETF华安" },
];
