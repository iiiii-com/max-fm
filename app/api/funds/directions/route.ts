import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface FundDirection {
  key: string;
  name: string;
  value: number | null; // 当日净额（元）
  trend5: number[]; // 近 5 日净额（元），旧 → 新
  source: "realtime" | "aggregated" | "static";
  comment: string;
}

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

function parseNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// kamt.rtmin：s2n = 沪深股通（北向），n2s = 港股通（南向），行格式 time,净买入(万),...
async function fetchKamtRt(): Promise<{ north: number | null; south: number | null; date: string } | null> {
  try {
    const j = await getJson<{ data?: any }>(
      "https://push2.eastmoney.com/api/qt/kamt.rtmin/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56"
    );
    const d = j?.data;
    if (!d) return null;
    const last = (rows: string[] | undefined): number | null => {
      if (!Array.isArray(rows) || !rows.length) return null;
      for (let i = rows.length - 1; i >= 0; i--) {
        const p = (rows[i] ?? "").split(",");
        if (p.length > 2 && p[1] !== "-" && p[1] !== "" && parseNum(p[1]) !== 0) return parseNum(p[1]) * 1e4;
      }
      return null;
    };
    return { north: last(d.s2n), south: last(d.n2s), date: String(d.s2nDate ?? "") };
  } catch {
    return null;
  }
}

// kamt.kline：hk2sh/hk2sz = 北向沪/深日净买入（万），sh2hk/sz2hk = 南向
async function fetchKamtKline(lmt: number): Promise<{
  north: { date: string; value: number }[];
  south: { date: string; value: number }[];
} | null> {
  try {
    const j = await getJson<{ data?: any }>(
      `https://push2his.eastmoney.com/api/qt/kamt.kline/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56&klt=101&lmt=${lmt}`
    );
    const d = j?.data;
    if (!d) return null;
    const merge = (a: string[], b: string[]) => {
      const n = Math.min(a.length, b.length);
      const out: { date: string; value: number }[] = [];
      for (let i = 0; i < n; i++) {
        const pa = (a[i] ?? "").split(",");
        const pb = (b[i] ?? "").split(",");
        const va = parseNum(pa[1]);
        const vb = parseNum(pb[1]);
        // 单位修正：kamt 南向行值若异常恒定（接口停更占位），视为无效
        const v = (va + vb) * 1e4;
        out.push({ date: String(pa[0]), value: Number.isFinite(v) ? v : 0 });
      }
      return out;
    };
    return {
      north: merge(d.hk2sh ?? [], d.hk2sz ?? []),
      south: merge(d.sh2hk ?? [], d.sz2hk ?? []),
    };
  } catch {
    return null;
  }
}

// 过滤占位/失真序列：全 0 或连续 ≥3 天完全相同的值视为接口占位
function sanitizeSeries(rows: any[] | null | undefined): any[] {
  if (!rows || !rows.length) return [];
  const vals = rows.map((r) => Number(r?.value) || 0);
  const allZero = vals.every((v) => v === 0);
  let constant = true;
  for (let i = 2; i < vals.length; i++) {
    if (vals[i] !== vals[i - 1] || vals[i] !== vals[i - 2]) {
      constant = false;
      break;
    }
  }
  return allZero || (constant && vals.length >= 3) ? [] : rows;
}

// 板块主力/大单/散户聚合：clist 板块列表（f62/f66 元，f69/f75 亿）
async function fetchSectorAgg(): Promise<{ main: number; big: number; retail: number } | null> {
  try {
    const j = await getJson<{ data?: { diff?: any[] } }>(
      "https://push2.eastmoney.com/api/qt/clist/get?fid=f62&po=1&pz=100&pn=1&np=1&fltt=2&invt=2&fs=m:90+t:2&fields=f62,f66,f69,f72,f75"
    );
    const diff = j?.data?.diff;
    if (!Array.isArray(diff) || !diff.length) return null;
    let main = 0;
    let big = 0;
    let retail = 0;
    for (const q of diff) {
      main += parseNum(q.f62);
      big += parseNum(q.f69) * 1e8; // 大单（亿 → 元）
      retail += parseNum(q.f72) + parseNum(q.f75) * 1e8; // 中单（元）+ 小单（亿 → 元）
    }
    return { main, big, retail };
  } catch {
    return null;
  }
}

// 上证指数日资金流历史：f52 主力 / f53 小单 / f54 中单 / f55 大单
async function fetchMarketFlowHistory(): Promise<{ date: string; main: number; big: number; retail: number }[] | null> {
  try {
    const j = await getJson<{ data?: { klines?: string[] } }>(
      "https://push2his.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=6&klt=101&secid=1.000001&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56"
    );
    const rows = j?.data?.klines;
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows.map((r: string) => {
      const p = r.split(",");
      return {
        date: String(p[0]),
        main: parseNum(p[1]),
        retail: parseNum(p[2]) + parseNum(p[3]), // 小单 + 中单
        big: parseNum(p[4]),
      };
    });
  } catch {
    return null;
  }
}

function commentFor(key: string, v: number | null): string {
  const yi = (n: number) => n / 1e8;
  if (v === null) return "数据延迟";
  switch (key) {
    case "north":
      return v > 0 ? "北向资金净买入，外资情绪回暖" : "北向资金净流出，外资偏谨慎";
    case "south":
      return v > 0 ? "南向资金积极南下，港股承接力强" : "南向资金净流出，港股承压";
    case "main":
      if (v > 50e8) return "机构大举进场";
      if (v > 0) return "主力资金小幅净流入";
      if (v < -50e8) return "机构在撤退";
      return v < 0 ? "主力资金小幅流出" : "主力资金平稳";
    case "big":
      return v > 0 ? "大单资金跟流入，短线资金活跃" : "大单资金流出，短线资金离场";
    case "retail":
      return v > 0 ? "散户资金进场，注意与主力反向" : "散户资金离场";
    default:
      return "";
  }
}

export async function GET() {
  const [rt, kline, agg, hist] = await Promise.all([
    fetchKamtRt(),
    fetchKamtKline(6),
    fetchSectorAgg(),
    fetchMarketFlowHistory(),
  ]);

  const trend5 = (rows: { value: number }[] | null | undefined) =>
    sanitizeSeries(rows)
      .slice(-5)
      .map((r) => r.value);
  const lastVal = (rows: { value: number }[] | null | undefined) => {
    const s = sanitizeSeries(rows);
    return s.length ? s[s.length - 1].value : null;
  };

  const northRows = sanitizeSeries(kline?.north ?? null);
  const southRows = sanitizeSeries(kline?.south ?? null);
  const histRows = hist ? sanitizeSeries(hist) : null;

  const northVal = rt?.north && rt.north !== 0 ? rt.north : lastVal(northRows);
  const southVal = rt?.south && rt.south !== 0 ? rt.south : lastVal(southRows);

  const directions: FundDirection[] = [
    {
      key: "north",
      name: "北向",
      value: northVal,
      trend5: trend5(northRows),
      source: rt?.north && rt.north !== 0 ? "realtime" : northRows.length ? "aggregated" : "static",
      comment: northVal == null ? "数据延迟（接口停更）" : commentFor("north", northVal),
    },
    {
      key: "south",
      name: "南向",
      value: southVal,
      trend5: trend5(southRows),
      source: rt?.south && rt.south !== 0 ? "realtime" : southRows.length ? "aggregated" : "static",
      comment: southVal == null ? "数据延迟（接口停更）" : commentFor("south", southVal),
    },
    {
      key: "main",
      name: "主力",
      value: agg?.main ?? (histRows ? histRows[histRows.length - 1].main : null),
      trend5: histRows ? histRows.slice(-5).map((r) => r.main) : [],
      source: agg || histRows ? "aggregated" : "static",
      comment: commentFor("main", agg?.main ?? (histRows ? histRows[histRows.length - 1].main : null)),
    },
    {
      key: "big",
      name: "大单",
      value: agg?.big ?? (histRows ? histRows[histRows.length - 1].big : null),
      trend5: histRows ? histRows.slice(-5).map((r) => r.big) : [],
      source: agg || histRows ? "aggregated" : "static",
      comment: commentFor("big", agg?.big ?? (histRows ? histRows[histRows.length - 1].big : null)),
    },
    {
      key: "retail",
      name: "散户",
      value: agg?.retail ?? (histRows ? histRows[histRows.length - 1].retail : null),
      trend5: histRows ? histRows.slice(-5).map((r) => r.retail) : [],
      source: agg || histRows ? "aggregated" : "static",
      comment: commentFor("retail", agg?.retail ?? (histRows ? histRows[histRows.length - 1].retail : null)),
    },
  ];

  return NextResponse.json({
    ok: true,
    date: rt?.date ?? new Date().toISOString().slice(5, 10),
    estimated: agg != null || histRows != null,
    directions,
  });
}