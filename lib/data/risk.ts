import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RiskIndicator {
  key: string;
  label: string;
  value: number;
  unit: string;
  level: "low" | "mid" | "high";
  note: string;
  stale?: boolean;
}

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } catch {
    try {
      for (const bin of ["curl", "curl.exe"]) {
        try {
          const { stdout } = await execFileAsync(bin, ["-s", "-m", "8", "-A", UA["User-Agent"], url], { timeout: 12000, encoding: "utf8" });
          return JSON.parse(stdout);
        } catch {
          // try next binary
        }
      }
    } catch {
      // curl unavailable
    }
  }
  return null;
}

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function levelOf(value: number, low: number, high: number): "low" | "mid" | "high" {
  return value < low ? "low" : value > high ? "high" : "mid";
}

async function fetchVix(): Promise<RiskIndicator> {
  const fallback: RiskIndicator = {
    key: "vix", label: "VIX 恐慌指数", value: 18.5, unit: "点", level: "mid",
    note: "2008 峰值 89.53、2020 峰值 82.69；>25 进入恐慌区，<15 市场平静", stale: true,
  };
  try {
    const j = await fetchJson(`https://push2.eastmoney.com/api/qt/stock/get?secid=100.VIX&fields=f43&fltt=2&invt=2`);
    const raw = num(j?.data?.f43);
    const v = raw == null ? null : raw / 100;
    if (v == null || v < 5 || v > 100) return fallback;
    return {
      key: "vix", label: "VIX 恐慌指数", value: Math.round(v * 100) / 100, unit: "点", level: levelOf(v, 15, 25),
      note: "2008 峰值 89.53、2020 峰值 82.69；>25 进入恐慌区，<15 市场平静",
    };
  } catch {
    return fallback;
  }
}

function spread10y2y(): RiskIndicator {
  return {
    key: "spread10y2y", label: "美债 10Y-2Y 利差", value: 20, unit: "bp", level: "low",
    note: "最新已知值（2026-08 约 +20bp），可能存在延迟；利差转负 = 衰退预警", stale: true,
  };
}

async function copperGoldRatio(): Promise<RiskIndicator> {
  const fallback: RiskIndicator = {
    key: "copperGold", label: "铜金比（风险偏好）", value: 5.5, unit: "‰", level: "low",
    note: "铜价/金价 ×1000，比值走低 = 避险资金涌入黄金", stale: true,
  };
  try {
    const j = await fetchJson(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=119.HG00Y,119.GC00Y&fields=f12,f43&fltt=2&invt=2`);
    const list = Array.isArray(j?.data?.diff) ? (j.data.diff as any[]) : [];
    const cu = num(list.find((q: any) => q.f12 === "HG00Y")?.f43);
    const au = num(list.find((q: any) => q.f12 === "GC00Y")?.f43);
    const ratio = cu != null && au != null && au > 0 ? (cu / au) * 1000 : null;
    if (ratio == null || ratio < 0.1 || ratio > 50) return fallback;
    return {
      key: "copperGold", label: "铜金比（风险偏好）", value: Math.round(ratio * 100) / 100, unit: "‰",
      level: ratio >= 2.5 ? "low" : ratio >= 1.5 ? "mid" : "high",
      note: "铜价/金价 ×1000，比值走低 = 避险资金涌入黄金",
    };
  } catch {
    return fallback;
  }
}

async function cn10yYield(): Promise<RiskIndicator> {
  const fallback: RiskIndicator = {
    key: "cn10y", label: "中国 10 年期国债收益率", value: 1.7, unit: "%", level: "low",
    note: "低收益率 = 资金宽松；持续走低反映宽货币与避险并存", stale: true,
  };
  try {
    const j = await fetchJson(`https://push2.eastmoney.com/api/qt/stock/get?secid=1.000012&fields=f43&fltt=2&invt=2`);
    const raw = num(j?.data?.f43);
    const v = raw == null ? null : raw / 100;
    if (v == null || v < 0.5 || v > 6) return fallback;
    return {
      key: "cn10y", label: "中国 10 年期国债收益率", value: Math.round(v * 100) / 100, unit: "%", level: levelOf(v, 2, 3),
      note: "低收益率 = 资金宽松；>3% 资金收紧，权益市场承压",
    };
  } catch {
    return fallback;
  }
}

export async function getRiskIndicators(): Promise<RiskIndicator[]> {
  const [vix, cg, cn] = await Promise.all([fetchVix(), copperGoldRatio(), cn10yYield()]);
  return [vix, spread10y2y(), cg, cn];
}