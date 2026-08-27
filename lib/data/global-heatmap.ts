/**
 * 全球涨跌全景图数据层
 * 覆盖市场：中国 / 美国 / 中国香港 / 亚太（日·韩·印·澳·新）/ 欧洲（英·德·法）
 * 数据源：新浪 hq.sinajs.cn（实时，本机/线上均可用）；日经/台湾/德国/法国仅东财（线上可用，本机标注受限）
 * 核验日期：2026-08-27
 */

export interface HeatItem {
  code: string;
  name: string;
  region: string;
  /** 新浪实时行情 symbol（空=本机无源，走东财/受限） */
  sina?: string;
  /** 东财 secid（受限项走东财，线上可用） */
  secid?: string;
  /** 点击下钻搜索词 */
  drill: string;
}

export interface HeatGroup {
  market: string;
  flag: string;
  items: HeatItem[];
}

export interface HeatQuote {
  code: string;
  name: string;
  price: number;
  changePct: number | null; // null = 数据源受限
  timestamp?: string;
}

export const HEAT_GROUPS: HeatGroup[] = [
  {
    market: "中国",
    flag: "🇨🇳",
    items: [
      { code: "SH000001", name: "上证指数", region: "中国", sina: "sh000001", drill: "上证指数" },
      { code: "SZ399001", name: "深证成指", region: "中国", sina: "sz399001", drill: "深证成指" },
      { code: "SZ399006", name: "创业板指", region: "中国", sina: "sz399006", drill: "创业板指" },
      { code: "SH000300", name: "沪深300", region: "中国", sina: "sh000300", drill: "沪深300" },
      { code: "SH000905", name: "中证500", region: "中国", sina: "sh000905", drill: "中证500" },
      { code: "SH000688", name: "科创50", region: "中国", sina: "sh000688", drill: "科创50" },
      { code: "SH600519", name: "贵州茅台", region: "中国", sina: "sh600519", drill: "贵州茅台" },
      { code: "SZ300750", name: "宁德时代", region: "中国", sina: "sz300750", drill: "宁德时代" },
    ],
  },
  {
    market: "美国",
    flag: "🇺🇸",
    items: [
      { code: "SPX", name: "标普500", region: "美国", sina: "gb_$inx", drill: "标普500" },
      { code: "NDX", name: "纳斯达克", region: "美国", sina: "gb_$ixic", drill: "纳斯达克" },
      { code: "DJIA", name: "道琼斯", region: "美国", sina: "gb_$dji", drill: "道琼斯" },
      { code: "AAPL", name: "苹果", region: "美国", sina: "gb_aapl", drill: "苹果" },
      { code: "MSFT", name: "微软", region: "美国", sina: "gb_msft", drill: "微软" },
      { code: "NVDA", name: "英伟达", region: "美国", sina: "gb_nvda", drill: "英伟达" },
      { code: "TSLA", name: "特斯拉", region: "美国", sina: "gb_tsla", drill: "特斯拉" },
      { code: "GOOG", name: "谷歌A", region: "美国", sina: "gb_goog", drill: "谷歌" },
    ],
  },
  {
    market: "中国香港",
    flag: "🇭🇰",
    items: [
      { code: "HSI", name: "恒生指数", region: "中国香港", sina: "hkHSI", drill: "恒生指数" },
      { code: "HK00700", name: "腾讯控股", region: "中国香港", sina: "hk00700", drill: "腾讯控股" },
      { code: "HK09988", name: "阿里巴巴", region: "中国香港", sina: "hk09988", drill: "阿里巴巴" },
      { code: "HK03690", name: "美团", region: "中国香港", sina: "hk03690", drill: "美团" },
      { code: "HK01810", name: "小米集团", region: "中国香港", sina: "hk01810", drill: "小米集团" },
      { code: "HK00941", name: "中国移动", region: "中国香港", sina: "hk00941", drill: "中国移动" },
    ],
  },
  {
    market: "亚太",
    flag: "🌏",
    items: [
      { code: "N225", name: "日经225", region: "日本", secid: "100.N225", drill: "日经225" },
      { code: "KS11", name: "韩国KOSPI", region: "韩国", sina: "b_KOSPI", drill: "韩国KOSPI" },
      { code: "TWII", name: "台湾加权", region: "中国台湾", secid: "100.TWII", drill: "台湾加权" },
      { code: "SENSEX", name: "印度SENSEX", region: "印度", sina: "b_SENSEX", drill: "印度SENSEX" },
      { code: "AS51", name: "澳洲ASX200", region: "澳大利亚", sina: "b_AS51", drill: "澳洲ASX200" },
      { code: "STI", name: "新加坡STI", region: "新加坡", sina: "b_STI", drill: "新加坡STI" },
    ],
  },
  {
    market: "欧洲",
    flag: "🇪🇺",
    items: [
      { code: "GDAXI", name: "德国DAX", region: "德国", secid: "100.GDAXI", drill: "德国DAX" },
      { code: "FCHI", name: "法国CAC40", region: "法国", secid: "100.FCHI", drill: "法国CAC40" },
      { code: "FTSE", name: "英国富时100", region: "英国", sina: "b_FTSE", drill: "英国富时100" },
    ],
  },
];

export const ALL_HEAT_ITEMS: HeatItem[] = HEAT_GROUPS.flatMap((g) => g.items);

/**
 * 解析新浪实时行情文本（var hq_str_xxx="...";）
 * 不同市场字段格式不同，按 symbol 前缀分派
 */
export function parseSinaLine(symbol: string, line: string): HeatQuote | null {
  if (!line || line.trim().startsWith("hq_str_" + symbol + "=\"\";")) return null;
  const body = line.replace(/^var hq_str_[^=]+="([^"]*)";\s*$/, "$1");
  const f = body.split(",");

  if (symbol.startsWith("gb_")) {
    // 美股：0名称,1当前价,2涨跌%,3时间,4涨跌额,5今开,6最高,7最低
    return {
      code: symbol,
      name: f[0] ?? symbol,
      price: Number(f[1]),
      changePct: Number(f[2]),
      timestamp: f[3],
    };
  }
  if (symbol.startsWith("hk")) {
    // 港股：0代码,1名称,2当前,3昨收,4今开,5最高,6最低,...,9涨跌额,10涨跌%
    const price = Number(f[2]);
    const prev = Number(f[3]);
    return {
      code: symbol,
      name: f[1] ?? symbol,
      price,
      changePct: prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : null,
    };
  }
  if (symbol.startsWith("b_")) {
    // 全球指数：0名称,1当前,2涨跌额,3涨跌%
    return {
      code: symbol,
      name: f[0] ?? symbol,
      price: Number(f[1]),
      changePct: Number(f[3]),
    };
  }
  // A股指数/个股：0名称,1今开,2昨收,3当前,4最高,5最低,...,30日期,31时间
  const prev = Number(f[2]);
  const price = Number(f[3]);
  return {
    code: symbol,
    name: f[0] ?? symbol,
    price,
    changePct: prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : null,
    timestamp: `${f[30]} ${f[31]}`,
  };
}
