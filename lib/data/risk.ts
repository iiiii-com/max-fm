import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RiskIndicator {
  key: string;
  label: string;
  /** 指标当前值；取不到时为 null（前端显示「不可用」，不展示占位数字） */
  value: number | null;
  unit: string;
  level: "low" | "mid" | "high" | "unknown";
  /** 阈值说明，必须与 level 的判定规则一致 */
  note: string;
  /** 数据来源说明 */
  source: string;
  /** true = 降级/缓存值；false = 实时拉取成功 */
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

/**
 * 三段阈值：value < low → low；low ≤ value ≤ high → mid；value > high → high。
 * 所有指标的 note 必须描述同一套阈值，否则会出现「说明写 >25 才算恐慌，18.5 却标需警惕」。
 */
function levelOf(value: number, low: number, high: number): "low" | "mid" | "high" {
  return value < low ? "low" : value > high ? "high" : "mid";
}

function unavailable(key: string, label: string, unit: string, note: string, source: string): RiskIndicator {
  return { key, label, value: null, unit, level: "unknown", note, source, stale: true };
}

async function fetchVix(): Promise<RiskIndicator> {
  const note = "阈值：<15 市场平静，15–25 中性，>25 进入恐慌区（2008 峰值 89.53、2020 峰值 82.69）";
  const srcNote = "东方财富行情不提供 VIX（secid=100.VIX 返回空）；权威口径见 CBOE 官网 VIX 指数";
  try {
    const j = await fetchJson(`https://push2.eastmoney.com/api/qt/stock/get?secid=100.VIX&fields=f43&fltt=2&invt=2`);
    const raw = num(j?.data?.f43);
    const v = raw == null ? null : raw / 100;
    if (v == null || v < 5 || v > 100) return unavailable("vix", "VIX 恐慌指数", "点", `${note}；${srcNote}`, "不可用（需 CBOE）");
    return {
      key: "vix", label: "VIX 恐慌指数", value: Math.round(v * 100) / 100, unit: "点",
      level: levelOf(v, 25, 25), note, source: "东方财富 VIX（实时）",
    };
  } catch {
    return unavailable("vix", "VIX 恐慌指数", "点", `${note}；${srcNote}`, "不可用（需 CBOE）");
  }
}

/**
 * 美债 10Y-2Y 利差。
 * 东方财富 / 新浪的公开行情接口均不提供美债收益率曲线（secid 返回空），
 * 因此本站**不展示该数值**，而不是硬编码一个「约 +20bp」充数。
 * 如需该指标请以 FRED（DFEDT10U / DFEDT2U）为准。
 */
function spread10y2y(): RiskIndicator {
  return unavailable(
    "spread10y2y",
    "美债 10Y-2Y 利差",
    "bp",
    "本站行情源不提供美债收益率曲线，故不展示该数值。权威口径见 FRED：DFEDT10U − DFEDT2U。利差转负 = 衰退预警",
    "不可用（需 FRED）"
  );
}

async function copperGoldRatio(): Promise<RiskIndicator> {
  const note = "铜金比 = 铜价 / 金价 × 1000。阈值：<1.5 高风险（避险资金涌入黄金），1.5–2.5 中性，>2.5 风险低";
  const srcNote = "东方财富该合约不返回报价（rc=102）；权威口径见 LME 铜 / COMEX 黄金官方结算价";
  try {
    const j = await fetchJson(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=119.HG00Y,119.GC00Y&fields=f12,f43&fltt=2&invt=2`);
    const list = Array.isArray(j?.data?.diff) ? (j.data.diff as any[]) : [];
    const cu = num(list.find((q: any) => q.f12 === "HG00Y")?.f43);
    const au = num(list.find((q: any) => q.f12 === "GC00Y")?.f43);
    const ratio = cu != null && au != null && au > 0 ? (cu / au) * 1000 : null;
    if (ratio == null || ratio < 0.1 || ratio > 50) {
      return unavailable("copperGold", "铜金比（风险偏好）", "‰", `${note}；${srcNote}`, "不可用（需 LME/CMEX）");
    }
    return {
      key: "copperGold", label: "铜金比（风险偏好）", value: Math.round(ratio * 100) / 100, unit: "‰",
      level: ratio < 1.5 ? "high" : ratio > 2.5 ? "low" : "mid",
      note, source: "COMEX 铜/黄金（实时）",
    };
  } catch {
    return unavailable("copperGold", "铜金比（风险偏好）", "‰", `${note}；${srcNote}`, "不可用（需 LME/CMEX）");
  }
}

/**
 * 中国 10 年期国债收益率。
 * 口径修正：旧实现抓 `1.000012`，而该 secid 是**国债指数**（约 230），除以 100 后得到
 * 一个并不存在的「2.31% 收益率」，与站内指标表里的真实值冲突。
 * 现改为复用站内指标表同一数据源（economic_indicators 的 yield10y，中债登口径），
 * 保证预警面板与 24 指标表永远显示同一个数。
 */
async function cn10yYield(): Promise<RiskIndicator> {
  const note = "阈值：<2% 偏宽松，2–3% 中性，>3% 资金收紧、权益承压";
  try {
    const { getLatestIndicator } = await import("@/lib/data/queries");
    // 取该指标**最新一期**（getIndicatorSeries 是升序 + limit，取 1 会拿到最旧的一期）
    const row = (await getLatestIndicator("10年期国债收益率")) as any;
    const v = num(row?.value);
    if (v == null || v < 0.5 || v > 6) {
      return unavailable("cn10y", "中国 10 年期国债收益率", "%", `${note}；指标表暂无可用值`, "中债登（站内指标表）");
    }
    return {
      key: "cn10y", label: "中国 10 年期国债收益率", value: Math.round(v * 100) / 100, unit: "%",
      level: levelOf(v, 2, 3), note,
      source: `中债登（站内指标表，与 24 指标表同源，截至 ${row?.date ?? "—"}）`,
    };
  } catch {
    return unavailable("cn10y", "中国 10 年期国债收益率", "%", `${note}；指标表读取失败`, "中债登（站内指标表）");
  }
}

export async function getRiskIndicators(): Promise<RiskIndicator[]> {
  const [vix, cg, cn] = await Promise.all([fetchVix(), copperGoldRatio(), cn10yYield()]);
  return [vix, spread10y2y(), cg, cn];
}