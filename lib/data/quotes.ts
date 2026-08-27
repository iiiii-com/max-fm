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
    volume: Number(q.f5),
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
  try {
    const secids = INDEX_SECIDS.map((x) => x.secid).join(",");
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f2,f3,f4,f12,f14,f15,f16,f17,f5,f6&fltt=2&invt=2`;
    const res = await fetch(url, { next: { revalidate: 15 } });
    if (!res.ok) throw new Error(`quote api ${res.status}`);
    const json = await res.json();
    const list = json?.data?.diff || [];
    if (!Array.isArray(list) || !list.length) throw new Error("empty quote list");
    return list.map((q: any) => toQuote(q, INDEX_SECIDS.find((x) => x.secid === `${q.f13}.${q.f12}`)?.market ?? "cn"));
  } catch {
    // 东财失败 → 新浪真实实时源（A股 6 指数 + 汇率）；黄金/原油新浪不支持则过滤
    const symbols = INDEX_SECIDS.filter((x) => x.sina).map((x) => x.sina!);
    const map = await fetchSina(symbols).catch(() => new Map<string, string>());
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
  }
}

export async function fetchGlobalQuotes(): Promise<Quote[]> {
  try {
    const secids = GLOBAL_SECIDS.map((x) => x.secid).join(",");
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids}&fields=f2,f3,f4,f12,f14,f15,f16,f17,f5,f6&fltt=2&invt=2`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`global quote api ${res.status}`);
    const json = await res.json();
    const list = json?.data?.diff || [];
    if (!Array.isArray(list) || !list.length) throw new Error("empty global quote list");
    return list.map((q: any) => toQuote(q, "global"));
  } catch {
    // 东财失败 → 新浪真实实时源（美股三大/恒指/KOSPI/印度等可用项；不支持的返回过滤）
    const symbols = GLOBAL_SECIDS.filter((x) => x.sina).map((x) => x.sina!);
    const map = await fetchSina(symbols).catch(() => new Map<string, string>());
    const out: Quote[] = [];
    for (const x of GLOBAL_SECIDS) {
      if (!x.sina) continue;
      const raw = map.get(x.sina);
      if (!raw) continue;
      const q = sinaGlobalQuote(x.sina, raw, x.code, x.name);
      if (q) out.push(q);
    }
    return out;
  }
}

export async function fetchSectors(): Promise<Quote[]> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=12&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14,f6`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`sector api ${res.status}`);
    const json = await res.json();
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
