import { emJson } from "./eastmoney";

export interface Quote {
  code: string;
  name: string;
  price: number;
  changePct: number;
  changeAmount: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  timestamp: number;
  /** 最新交易日期（北京时间 yyyy-mm-dd）。仅 A 股/ETF/沪深指数快照提供，用于 K 线把当日盘中 bar 补到最新日期 */
  tradeDate?: string;
  market: "cn" | "global";
}

const INDEX_SECIDS = [
  { code: "000001", name: "上证指数", secid: "1.000001", market: "cn" as const, sina: "sh000001" },
  { code: "399001", name: "深证成指", secid: "0.399001", market: "cn" as const, sina: "sz399001" },
  { code: "399006", name: "创业板指", secid: "0.399006", market: "cn" as const, sina: "sz399006" },
  { code: "000300", name: "沪深300", secid: "1.000300", market: "cn" as const, sina: "sh000300" },
  { code: "000905", name: "中证500", secid: "1.000905", market: "cn" as const, sina: "sh000905" },
  { code: "000688", name: "科创50", secid: "1.000688", market: "cn" as const, sina: "sh000688" },
  { code: "USDCNH", name: "美元/离岸人民币", secid: "133.USDCNH", market: "global" as const, sina: "fx_susdcnh" },
  { code: "XAU", name: "伦敦金", secid: "119.GC00Y", market: "global" as const, sina: null },
  { code: "CL", name: "WTI原油", secid: "119.CL00Y", market: "global" as const, sina: null },
];

const GLOBAL_SECIDS = [
  { code: "DJIA", name: "道琼斯", secid: "100.DJIA", market: "global" as const, sina: "gb_$dji" },
  { code: "NDX", name: "纳斯达克", secid: "100.NDX", market: "global" as const, sina: "gb_$ixic" },
  { code: "SPX", name: "标普500", secid: "100.SPX", market: "global" as const, sina: "gb_$inx" },
  { code: "HSI", name: "恒生指数", secid: "100.HSI", market: "global" as const, sina: "hkHSI" },
  { code: "N225", name: "日经225", secid: "100.N225", market: "global" as const, sina: "b_N225" },
  { code: "KS11", name: "韩国KOSPI", secid: "100.KS11", market: "global" as const, sina: "b_KOSPI" },
  { code: "TWII", name: "台湾加权", secid: "100.TWII", market: "global" as const, sina: "b_TWII" },
  { code: "GDAXI", name: "德国DAX", secid: "100.GDAXI", market: "global" as const, sina: "b_GDAXI" },
  { code: "FTSE", name: "英国富时100", secid: "100.FTSE", market: "global" as const, sina: "b_FTSE" },
  { code: "FCHI", name: "法国CAC40", secid: "100.FCHI", market: "global" as const, sina: "b_FCHI" },
  { code: "SENSEX", name: "印度SENSEX", secid: "100.SENSEX", market: "global" as const, sina: "b_SENSEX" },
  { code: "AS51", name: "澳洲ASX200", secid: "100.AS51", market: "global" as const, sina: "b_AS51" },
  { code: "STI", name: "新加坡STI", secid: "100.STI", market: "global" as const, sina: "b_STI" },
  { code: "RTS", name: "俄罗斯RTS", secid: "100.RTS", market: "global" as const, sina: "b_RTS" },
];

function toQuote(q: any, market: "cn" | "global"): Quote {
  return {
    code: String(q.f12),
    name: String(q.f14),
    price: Number(q.f2),
    changePct: Number(q.f3),
    changeAmount: Number(q.f4),
    open: Number(q.f17),
    high: Number(q.f15),
    low: Number(q.f16),
    volume: Number(q.f5), // 东财 f5=成交量（手），全站统一用「手」
    amount: Number(q.f6),
    timestamp: Date.now(),
    market,
  };
}

/** 新浪实时行情解析（真实数据；新浪为免费源，约 15 秒延迟） */
async function fetchSina(symbols: string[]): Promise<Map<string, string>> {
  if (!symbols.length) return new Map();
  const url = `https://hq.sinajs.cn/list=${symbols.join(",")}`;
  const res = await fetch(url, {
    headers: { Referer: "https://finance.sina.com.cn/", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(6000),
  });
  const text = await res.text();
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = line.match(/hq_str_([a-zA-Z0-9_$]+)="([^"]*)"/);
    if (m && m[2]) map.set(m[1], m[2]);
  }
  return map;
}

/** 新浪 A 股指数解析：名称,今开,昨收,现价,最高,最低,买一,卖一,成交量,成交额,... */
function sinaCnQuote(sym: string, raw: string, code: string, name: string): Quote | null {
  const p = raw.split(",");
  if (p.length < 10) return null;
  const price = Number(p[3]);
  const prevClose = Number(p[2]);
  if (!isFinite(price) || price <= 0) return null;
  const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  return {
    code, name, price, changePct, changeAmount: prevClose > 0 ? price - prevClose : 0,
    open: Number(p[1]) || 0, high: Number(p[4]) || 0, low: Number(p[5]) || 0,
    // 仅用于 A 股指数：新浪指数快照 p[8] 已是「手」（实测与东财 f47 同量级），不换算
    volume: Number(p[8]) || 0, amount: Number(p[9]) || 0, timestamp: Date.now(), market: "cn",
  };
}

/** 新浪全球指数解析：美股 gb_ 为「名称,现价,涨跌幅%,时间」；b_/hk 前缀格式见各分支 */
function sinaGlobalQuote(sym: string, raw: string, code: string, name: string): Quote | null {
  const p = raw.split(",");
  if (sym.startsWith("gb_")) {
    const price = Number(p[1]);
    if (!isFinite(price) || price <= 0) return null;
    return { code, name, price, changePct: Number(p[2]) || 0, changeAmount: 0, open: 0, high: 0, low: 0, volume: 0, amount: 0, timestamp: Date.now(), market: "global" };
  }
  if (sym.startsWith("hk")) {
    // HSI,恒生指数,现价,昨收,最高,最低,买一,卖一,涨跌额,涨跌幅%,成交量,成交额,...
    const price = Number(p[2]);
    if (!isFinite(price) || price <= 0) return null;
    return { code, name, price, changePct: Number(p[9]) || 0, changeAmount: Number(p[8]) || 0, open: 0, high: Number(p[4]) || 0, low: Number(p[5]) || 0, volume: Number(p[10]) || 0, amount: Number(p[11]) || 0, timestamp: Date.now(), market: "global" };
  }
  if (sym.startsWith("b_")) {
    // b_KOSPI：名称,现价,涨跌额,涨跌幅%,时间,...；b_SENSEX 同构
    const price = Number(p[1]);
    if (!isFinite(price) || price <= 0) return null;
    return { code, name, price, changePct: Number(p[3]) || 0, changeAmount: Number(p[2]) || 0, open: 0, high: Number(p[7]) || 0, low: Number(p[8]) || 0, volume: 0, amount: 0, timestamp: Date.now(), market: "global" };
  }
  if (sym.startsWith("fx_")) {
    // 汇率：时间,买价,卖价,?,?,?,?,?,现价?... 取 p[1] 为参考价
    const price = Number(p[1]);
    if (!isFinite(price) || price <= 0) return null;
    return { code, name, price, changePct: 0, changeAmount: 0, open: 0, high: 0, low: 0, volume: 0, amount: 0, timestamp: Date.now(), market: "global" };
  }
  return null;
}

export async function fetchQuotes(): Promise<Quote[]> {
  // 东财与新浪**并行**发起，先到的可用结果胜出。
  // 串行时的痛点：东财（push2）被限流/掐断要等重试与超时，用户白等数秒才见到新浪兜底；
  // 并行后兜底源的延迟不再叠加在东财失败之上，而 HTTP 缓存只按结果缓存，不会放大上游压力。
  const emTask = (async (): Promise<Quote[]> => {
    const secids = INDEX_SECIDS.map((x) => x.secid).join(",");
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f2,f3,f4,f12,f14,f15,f16,f17,f5,f6&fltt=2&invt=2`;
    // 通过 emJson 走「限并发 + 重试」：上游按并发连接数掐断，直接并发 fetch 会成批失败
    const json = await emJson<{ data?: { diff?: any[] } }>(url);
    if (!json) throw new Error("quote api unavailable");
    const list = json?.data?.diff || [];
    if (!Array.isArray(list) || !list.length) throw new Error("empty quote list");
    return list.map((q: any) => toQuote(q, INDEX_SECIDS.find((x) => x.secid === `${q.f13}.${q.f12}`)?.market ?? "cn"));
  })();

  const sinaTask = (async (): Promise<Quote[]> => {
    const symbols = INDEX_SECIDS.filter((x) => x.sina).map((x) => x.sina!);
    const map = await fetchSina(symbols);
    const out: Quote[] = [];
    for (const x of INDEX_SECIDS) {
      if (!x.sina) continue;
      const raw = map.get(x.sina);
      if (!raw) continue;
      if (x.market === "cn") {
        const q = sinaCnQuote(x.sina, raw, x.code, x.name);
        if (q) out.push(q);
      } else {
        const q = sinaGlobalQuote(x.sina, raw, x.code, x.name);
        if (q) out.push(q);
      }
    }
    return out;
  })();

  const [em, sina] = await Promise.allSettled([emTask, sinaTask]);
  const emList = em.status === "fulfilled" ? em.value : [];
  if (emList.length) return emList;
  return sina.status === "fulfilled" ? sina.value : [];
}

export async function fetchGlobalQuotes(): Promise<Quote[]> {
  const emTask = (async (): Promise<Quote[]> => {
    const secids = GLOBAL_SECIDS.map((x) => x.secid).join(",");
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f2,f3,f4,f12,f14,f15,f16,f17,f5,f6&fltt=2&invt=2`;
    const json = await emJson<{ data?: { diff?: any[] } }>(url);
    if (!json) throw new Error("global quote api unavailable");
    const list = json?.data?.diff || [];
    if (!Array.isArray(list) || !list.length) throw new Error("empty global quote list");
    return list.map((q: any) => toQuote(q, "global"));
  })();

  const sinaTask = (async (): Promise<Quote[]> => {
    const symbols = GLOBAL_SECIDS.filter((x) => x.sina).map((x) => x.sina!);
    const map = await fetchSina(symbols);
    const out: Quote[] = [];
    for (const x of GLOBAL_SECIDS) {
      if (!x.sina) continue;
      const raw = map.get(x.sina);
      if (!raw) continue;
      const q = sinaGlobalQuote(x.sina, raw, x.code, x.name);
      if (q) out.push(q);
    }
    return out;
  })();

  const [em, sina] = await Promise.allSettled([emTask, sinaTask]);
  const emList = em.status === "fulfilled" ? em.value : [];
  if (emList.length) return emList;
  return sina.status === "fulfilled" ? sina.value : [];
}

export async function fetchSectors(): Promise<Quote[]> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=12&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14,f6`;
    const json = await emJson<{ data?: { diff?: any[] } }>(url);
    if (!json) throw new Error("sector api unavailable");
    const list = json?.data?.diff || [];
    if (!Array.isArray(list) || !list.length) throw new Error("empty sector list");
    return list.map((q: any) => ({
      code: String(q.f12), name: String(q.f14),
      price: Number(q.f2), changePct: Number(q.f3), changeAmount: Number(q.f4),
      open: 0, high: 0, low: 0, volume: 0, amount: Number(q.f6),
      timestamp: Date.now(), market: "cn" as const,
    }));
  } catch {
    // 板块实时新浪无对应源：不生成假数据，返回空数组（前端显示暂无数据）
    return [];
  }
}

/**
 * 单只 A 股实时快照（个股行情页头部）。
 *
 * K 线接口返回的是「日线收盘」，盘中打开页面时价格会停在昨收附近，
 * 这是「个股行情更新不及时」的体感来源。这里补一个实时快照：
 * 东财 push2 优先（含涨跌幅/量额/开高低），失败退新浪 hq.sinajs.cn；
 * 两源皆失败返回 null（前端保留 K 线最新价并标注延迟），绝不造数。
 * 延迟约 15 秒（新浪）/ 实时（东财），由调用方决定轮询节奏。
 */
export async function fetchStockQuote(secid: string): Promise<Quote | null> {
  const m = /^(\d)\.(\d{6})$/.exec(secid.trim());
  if (!m) return null;
  const code = m[2];
  const sym = (m[1] === "1" ? "sh" : "sz") + code;
  try {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f86,f169,f170&fltt=2&invt=2`;
    const json = await emJson<{ data?: Record<string, any> }>(url, { timeoutMs: 6000 });
    if (json) {
      const d = json?.data;
      const price = Number(d?.f43);
      if (d && isFinite(price) && price > 0) {
        const prevClose = Number(d.f60) || price;
        const f86 = Number(d.f86);
        return {
          code: String(d.f57 ?? code),
          name: String(d.f58 ?? code),
          price,
          changePct: Number(d.f170) || 0,
          changeAmount: Number(d.f169) || (price - prevClose),
          open: Number(d.f46) || 0,
          high: Number(d.f44) || 0,
          low: Number(d.f45) || 0,
          volume: Number(d.f47) || 0,
          amount: Number(d.f48) || 0,
          timestamp: Date.now(),
          market: "cn",
          tradeDate: Number.isFinite(f86) && f86 > 0 ? cstDateFromUnix(f86) : undefined,
        };
      }
    }
  } catch {
    /* 落到新浪 */
  }
  try {
    const map = await fetchSina([sym]);
    const raw = map.get(sym);
    if (!raw) return null;
    const p = raw.split(",");
    const price = Number(p[3]);
    const prevClose = Number(p[2]);
    if (!isFinite(price) || price <= 0) return null;
    const sinaDate = /^\d{4}-\d{2}-\d{2}$/.test(p[30] ?? "") ? p[30] : undefined;
    return {
      code,
      name: p[0] || code,
      price,
      changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      changeAmount: prevClose > 0 ? price - prevClose : 0,
      open: Number(p[1]) || 0,
      high: Number(p[4]) || 0,
      low: Number(p[5]) || 0,
      // 新浪 A 股快照的成交量单位是「股」，东财 f47 与本站其他接口统一用「手」（/100）
      volume: Math.round((Number(p[8]) || 0) / 100),
      amount: Number(p[9]) || 0,
      timestamp: Date.now(),
      market: "cn",
      tradeDate: sinaDate,
    };
  } catch {
    return null;
  }
}

const CST_OFFSET_SEC = 8 * 3600;

/**
 * 东财 f86（unix 秒）→ 北京时间 yyyy-mm-dd。
 * 不能直接 `new Date(...).toISOString()`：服务器时区是 UTC 时，收盘 15:00 CST = 07:00 UTC，
 * 日期一致；但 0:00–8:00 CST 的更新会被算成前一天，因此显式加 8 小时。
 */
function cstDateFromUnix(sec: number): string {
  return new Date((sec + CST_OFFSET_SEC) * 1000).toISOString().slice(0, 10);
}
