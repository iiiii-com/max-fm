import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Windows 上 curl 位于 System32（Schannel TLS 栈，成功率更高）；非 Windows 用 PATH 中的 curl
const CURL_BIN = process.platform === "win32" ? "C:\\Windows\\System32\\curl.exe" : "curl";

export const dynamic = "force-dynamic";

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

// ---- 服务端缓存（stale-while-revalidate）----
// 日线数据分钟级更新，3 分钟内直接复用缓存（减少对东财的请求 → 反向降低被拦截概率）；
// 拉取失败时回落最近成功数据并标注数据时点（stale + asOf），同时后台静默刷新供下次使用。
interface CacheEntry {
  list: SectorKline[];
  ts: number; // 写入时间戳
}
const klineCache = new Map<string, CacheEntry>(); // key: `${bk}:${lmt}`
const FRESH_MS = 3 * 60 * 1000;
const refreshing = new Set<string>(); // 防并发重复后台刷新

// 东财 kline/get 会概率性拦截（连接掐断 或 返回空 klines 数组）：
// ① fetch 多参数重试（空数组视为失败）→ ② curl 子进程兜底（Schannel 指纹，成功率更高）
async function pullKlines(bk: string, lmt: number): Promise<string[]> {
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
  // curl 兜底（Schannel 栈，成功率高）
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
    // 资金流不可用时静默降级（main 为 0），不阻断 K 线主图
  }
  return map;
}

// 完整拉取：K线 + 资金流 → 组装为结构化列表
async function pullSectorKline(bk: string, lmt: number): Promise<SectorKline[]> {
  const [klines, flowMap] = await Promise.all([pullKlines(bk, lmt), fetchFlow(bk, lmt)]);
  // beg=19900101 会一次拿到 26 年全量；按请求条数截断，避免把 6000+ 根推给前端
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

// 后台静默刷新：成功则回填缓存（fire-and-forget，不阻塞响应）
function bgRefresh(key: string, bk: string, lmt: number): void {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  void (async () => {
    try {
      const list = await pullSectorKline(bk, lmt);
      if (list.length) klineCache.set(key, { list, ts: Date.now() });
    } catch {
      // 静默：下次请求再试
    } finally {
      refreshing.delete(key);
    }
  })();
}

export async function GET(req: Request) {
  const bk = new URL(req.url).searchParams.get("bk")?.trim() ?? "";
  /**
   * 板块 K 线默认条数与上限。
   * 原先 Math.min(120, ...) 且默认 30 根 —— 板块 K 线因此只有约 5.8 个月（默认仅 1.5 个月）。
   * 实测东财板块接口 beg=19900101 可返回 6480 根 / 26.7 年（BK0475），
   * 故放开上限并把 beg 放到 1990；lmt 对该接口无效，真正限制是 beg。
   */
  const lmt = Math.min(8000, Math.max(30, Number(new URL(req.url).searchParams.get("lmt")) || 500));
  if (!/^BK\d+$/.test(bk)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const key = `${bk}:${lmt}`;
  const cached = klineCache.get(key);

  // 命中新鲜缓存：直接返回，不发起上游请求
  if (cached && Date.now() - cached.ts < FRESH_MS) {
    return NextResponse.json({ ok: true, bk, list: cached.list, cached: true, asOf: new Date(cached.ts).toISOString() });
  }

  try {
    const list = await pullSectorKline(bk, lmt);
    klineCache.set(key, { list, ts: Date.now() });
    return NextResponse.json({ ok: true, bk, list });
  } catch (e: any) {
    console.error("[sector-kline] error:", e?.message ?? e, "| bk:", bk);
    // 拉新失败但有历史缓存：回落旧数据（标注数据时点）+ 后台刷新，避免核心诉求落空
    if (cached && cached.list.length) {
      bgRefresh(key, bk, lmt);
      return NextResponse.json({ ok: true, bk, list: cached.list, stale: true, asOf: new Date(cached.ts).toISOString() });
    }
    return NextResponse.json({ ok: false, error: "板块 K 线暂不可用" }, { status: 502 });
  }
}
