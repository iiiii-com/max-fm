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
  { code: "000001", name: "上证指数", secid: "1.000001", market: "cn" as const },
  { code: "399001", name: "深证成指", secid: "0.399001", market: "cn" as const },
  { code: "399006", name: "创业板指", secid: "0.399006", market: "cn" as const },
  { code: "000300", name: "沪深300", secid: "1.000300", market: "cn" as const },
  { code: "000905", name: "中证500", secid: "1.000905", market: "cn" as const },
  { code: "000688", name: "科创50", secid: "1.000688", market: "cn" as const },
  { code: "USDCNH", name: "美元/离岸人民币", secid: "133.USDCNH", market: "global" as const },
  { code: "XAU", name: "伦敦金", secid: "119.GC00Y", market: "global" as const },
  { code: "CL", name: "WTI原油", secid: "119.CL00Y", market: "global" as const },
];

const GLOBAL_SECIDS = [
  { code: "DJIA", name: "道琼斯", secid: "100.DJIA", market: "global" as const },
  { code: "NDX", name: "纳斯达克", secid: "100.NDX", market: "global" as const },
  { code: "SPX", name: "标普500", secid: "100.SPX", market: "global" as const },
  { code: "HSI", name: "恒生指数", secid: "100.HSI", market: "global" as const },
  { code: "N225", name: "日经225", secid: "100.N225", market: "global" as const },
  { code: "KS11", name: "韩国KOSPI", secid: "100.KS11", market: "global" as const },
  { code: "TWII", name: "台湾加权", secid: "100.TWII", market: "global" as const },
  { code: "GDAXI", name: "德国DAX", secid: "100.GDAXI", market: "global" as const },
  { code: "FTSE", name: "英国富时100", secid: "100.FTSE", market: "global" as const },
  { code: "FCHI", name: "法国CAC40", secid: "100.FCHI", market: "global" as const },
  { code: "SENSEX", name: "印度SENSEX", secid: "100.SENSEX", market: "global" as const },
  { code: "AS51", name: "澳洲ASX200", secid: "100.AS51", market: "global" as const },
  { code: "STI", name: "新加坡STI", secid: "100.STI", market: "global" as const },
  { code: "RTS", name: "俄罗斯RTS", secid: "100.RTS", market: "global" as const },
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

export function fallbackQuotes(): Quote[] {
  const base: Array<[string, string, number]> = [
    ["000001", "上证指数", 3421.56], ["399001", "深证成指", 11245.32],
    ["399006", "创业板指", 2289.47], ["000300", "沪深300", 4123.89],
    ["000905", "中证500", 6234.71], ["000688", "科创50", 1092.3],
    ["USDCNH", "美元/离岸人民币", 7.12],
    ["XAU", "伦敦金", 2689.4], ["CL", "WTI原油", 76.35],
  ];
  return base.map(([code, name, price]) => {
    const changePct = Number(((Math.random() - 0.45) * 3).toFixed(2));
    return {
      code, name, price: Number(price.toFixed(2)),
      changePct,
      changeAmount: Number((price * changePct / 100).toFixed(2)),
      open: Number(price.toFixed(2)), high: Number((price * 1.01).toFixed(2)),
      low: Number((price * 0.99).toFixed(2)),
      volume: Math.floor(Math.random() * 1e8), amount: Math.floor(Math.random() * 1e10),
      timestamp: Date.now(),
      market: INDEX_SECIDS.find((x) => x.code === code)?.market ?? ("cn" as const),
    };
  });
}

export function fallbackGlobalQuotes(): Quote[] {
  const base: Array<[string, string, number]> = [
    ["DJIA", "道琼斯", 40320.4], ["NDX", "纳斯达克", 21560.4], ["SPX", "标普500", 6120.5],
    ["HSI", "恒生指数", 18642.8], ["N225", "日经225", 37600.2], ["KS11", "韩国KOSPI", 2512.3],
    ["TWII", "台湾加权", 22300.1], ["GDAXI", "德国DAX", 18250.6], ["FTSE", "英国富时100", 8210.4],
    ["FCHI", "法国CAC40", 7320.8], ["SENSEX", "印度SENSEX", 76500.9], ["AS51", "澳洲ASX200", 7820.5],
    ["STI", "新加坡STI", 3360.7], ["RTS", "俄罗斯RTS", 1120.2],
  ];
  return base.map(([code, name, price]) => ({
    code, name, price: Number(price.toFixed(2)),
    changePct: Number(((Math.random() - 0.45) * 1.6).toFixed(2)),
    changeAmount: 0, open: Number(price.toFixed(2)),
    high: Number((price * 1.005).toFixed(2)), low: Number((price * 0.995).toFixed(2)),
    volume: 0, amount: 0, timestamp: Date.now(), market: "global" as const,
  }));
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
    return fallbackQuotes();
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
    return fallbackGlobalQuotes();
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
    const names = ["银行", "半导体", "白酒", "新能源车", "人工智能", "券商", "医药", "房地产", "煤炭", "电力", "家电", "军工"];
    return names.map((name, i) => ({
      code: `sec${i}`, name,
      price: 0, changePct: Number(((Math.random() - 0.4) * 4).toFixed(2)), changeAmount: 0,
      open: 0, high: 0, low: 0, volume: 0, amount: 0, timestamp: Date.now(), market: "cn" as const,
    }));
  }
}
