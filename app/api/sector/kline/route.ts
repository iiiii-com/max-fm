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

export async function GET(req: Request) {
  const bk = new URL(req.url).searchParams.get("bk")?.trim() ?? "";
  const lmt = Math.min(120, Math.max(10, Number(new URL(req.url).searchParams.get("lmt")) || 30));
  if (!/^BK\d+$/.test(bk)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  // 东财 kline/get 会概率性拦截（连接掐断 或 返回空 klines 数组）：
  // ① fetch 多参数重试（空数组视为失败）→ ② curl 子进程兜底（Schannel 指纹，成功率更高）
  async function fetchKline(): Promise<{ klines: string[] }> {
    for (const fqt of [1, 0]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const url =
            `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${bk}&klt=101&fqt=${fqt}&end=20500101&lmt=${lmt}` +
            `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`;
          const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000), cache: "no-store" });
          if (res.ok) {
            const j = await res.json();
            const klines = j?.data?.klines;
            if (Array.isArray(klines) && klines.length > 0) return { klines: klines as string[] };
          }
        } catch {
          // 尝试下一参数 / 兜底
        }
      }
    }
    // curl 兜底（Schannel 栈，成功率高）
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${bk}&klt=101&fqt=1&end=20500101&lmt=${lmt}` +
      `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`;
    const { stdout } = await execFileAsync(
      CURL_BIN,
      ["-s", "--max-time", "10", "-A", UA["User-Agent"], "-H", "Referer: https://quote.eastmoney.com/", url],
      { timeout: 12000 },
    );
    const j = JSON.parse(stdout);
    const klines = j?.data?.klines;
    if (Array.isArray(klines) && klines.length > 0) return { klines: klines as string[] };
    throw new Error("kline empty");
  }

  async function fetchFlow(): Promise<Map<string, number>> {
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

  try {
    const [kJson, flowMap] = await Promise.all([fetchKline(), fetchFlow()]);
    const klines: string[] = kJson.klines;

    const list: SectorKline[] = [];
    for (let i = 0; i < klines.length; i++) {
      const row = klines[i];
      const p = (row ?? "").split(",");
      if (p.length < 3) continue;
      const date = String(p[0]);
      const close = Number(p[2]) || 0;
      const prevClose = i > 0 ? Number((klines[i - 1] ?? "").split(",")[2]) || 0 : close;
      list.push({
        date,
        close,
        pct: prevClose ? ((close - prevClose) / prevClose) * 100 : 0,
        main: flowMap.get(date) ?? 0,
      });
    }
    return NextResponse.json({ ok: true, bk, list });
  } catch (e: any) {
    console.error("[sector-kline] error:", e?.message ?? e, "| bk:", bk);
    return NextResponse.json({ ok: false, error: "板块 K 线暂不可用" }, { status: 502 });
  }
}