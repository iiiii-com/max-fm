import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

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

  try {
    const [kRes, fRes] = await Promise.all([
      fetch(
        `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=90.${bk}&klt=101&lmt=${lmt}` +
          `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`,
        { headers: UA, signal: AbortSignal.timeout(12000), cache: "no-store" },
      ),
      fetch(
        `https://push2his.eastmoney.com/api/qt/stock/fflow/kline/get?secid=90.${bk}&klt=101&lmt=${lmt}` +
          `&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56`,
        { headers: UA, signal: AbortSignal.timeout(12000), cache: "no-store" },
      ),
    ]);
    if (!kRes.ok) throw new Error(`kline api ${kRes.status}`);

    const kJson = await kRes.json();
    const fJson = await fRes.json();
    const klines: string[] = kJson?.data?.klines ?? [];
    const flowRows: string[] = fJson?.data?.klines ?? [];
    const flowMap = new Map<string, number>();
    for (const row of flowRows) {
      const p = (row ?? "").split(",");
      if (p.length > 2) flowMap.set(String(p[0]), Number(p[1]) || 0);
    }

    const list: SectorKline[] = [];
    for (const row of klines) {
      const p = (row ?? "").split(",");
      if (p.length < 8) continue;
      const date = String(p[0]);
      const close = Number(p[2]) || 0;
      const prev = Number(p[5]) || 0;
      list.push({
        date,
        close,
        pct: prev ? ((close - prev) / prev) * 100 : 0,
        main: flowMap.get(date) ?? 0,
      });
    }
    return NextResponse.json({ ok: true, bk, list });
  } catch {
    return NextResponse.json({ ok: false, error: "板块 K 线暂不可用" }, { status: 502 });
  }
}