import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Windows 下 curl 位于 System32（Schannel TLS 栈，对东财成功率显著高于 Node 内置 undici）
const CURL_BIN = process.platform === "win32" ? "C:\\Windows\\System32\\curl.exe" : "curl";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Referer: "https://quote.eastmoney.com/",
};

export interface SectorKline {
  date: string;
  close: number;
  pct: number;
  main: number; // 主力净流入（元）
}

/**
 * 东财 push2his 会概率性拦截本机连接（连接被掐断，或返回空 klines）：
 *   ① fetch 多参数重试（空数组视为失败）→ ② curl 子进程兜底（Schannel 指纹，成功率更高）
 * 抽成独立模块，供 /api/sector/kline 与 /api/sector/sentiment 共用同一套取数与降级策略。
 */
async function pullKlines(bk: string): Promise<string[]> {
  for (const fqt of [1, 0]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url =
          `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${bk}&klt=101&fqt=${fqt}&beg=19900101&end=20500101` +
          `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`;
        const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000), cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          const klines = j?.data?.klines;
          if (Array.isArray(klines) && klines.length > 0) return klines as string[];
        }
      } catch {
        // 尝试下一参数 / 兜底
      }
    }
  }
  const url =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${bk}&klt=101&fqt=1&beg=19900101&end=20500101` +
    `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`;
  const { stdout } = await execFileAsync(
    CURL_BIN,
    ["-s", "--max-time", "10", "-A", UA["User-Agent"], "-H", "Referer: https://quote.eastmoney.com/", url],
    { timeout: 12000 },
  );
  const j = JSON.parse(stdout);
  const klines = j?.data?.klines;
  if (Array.isArray(klines) && klines.length > 0) return klines as string[];
  throw new Error("kline empty");
}

/** 板块资金流历史；不可用时静默降级（main=0），不阻断 K 线主图 */
async function fetchFlow(bk: string, lmt: number): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(
      `https://push2his.eastmoney.com/api/qt/stock/fflow/kline/get?secid=90.${bk}&klt=101&lmt=${lmt}` +
        `&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56`,
      { headers: UA, signal: AbortSignal.timeout(12000), cache: "no-store" },
    );
    if (res.ok) {
      const fJson = await res.json();
      for (const row of (fJson?.data?.klines ?? []) as string[]) {
        const p = (row ?? "").split(",");
        if (p.length > 2) map.set(String(p[0]), Number(p[1]) || 0);
      }
    }
  } catch {
    // 静默降级
  }
  return map;
}

/** 完整拉取：K线 + 资金流 → 组装为结构化列表（beg=19900101 会一次拿到 26 年全量，按 lmt 截断） */
export async function pullSectorKline(bk: string, lmt: number): Promise<SectorKline[]> {
  const [klines, flowMap] = await Promise.all([pullKlines(bk), fetchFlow(bk, lmt)]);
  const window = klines.slice(-lmt);
  // 截断窗口需要前一根算涨跌幅，否则首根 pct 恒为 0
  const offset = klines.length - window.length;
  const list: SectorKline[] = [];
  for (let i = 0; i < window.length; i++) {
    const p = (window[i] ?? "").split(",");
    if (p.length < 3) continue;
    const date = String(p[0]);
    const close = Number(p[2]) || 0;
    const prev = offset + i;
    const prevClose = prev > 0 ? Number((klines[prev - 1] ?? "").split(",")[2]) || 0 : close;
    list.push({
      date,
      close,
      pct: prevClose ? ((close - prevClose) / prevClose) * 100 : 0,
      main: flowMap.get(date) ?? 0,
    });
  }
  return list;
}