import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const [mkt, code] = secid.split(".");
  const prefix = mkt === "1" ? "sh" : mkt === "0" ? "sz" : "sh";
  const param = `${prefix}${code}`;
  try {
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param},day,,,250,qfq`;
    const res = await fetch(url, {
      next: { revalidate: 120 },
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) throw new Error(`kline api ${res.status}`);
    const json = await res.json();
    const node = json?.data?.[param];
    const raw: any[][] = node?.qfqday || node?.day || [];
    if (!Array.isArray(raw) || !raw.length) throw new Error("empty kline");
    const klines: KlineBar[] = raw.map((row: any[]) => ({
      date: String(row[0]),
      open: Number(row[1]),
      close: Number(row[2]),
      high: Number(row[3]),
      low: Number(row[4]),
      volume: Math.round(Number(row[5]) * 100),
      amount: 0,
    }));
    return NextResponse.json({
      name: String(node?.qt?.name ?? param),
      code: String(node?.qt?.code ?? code),
      secid,
      klines,
    });
  } catch {
    return NextResponse.json({ error: "K 线数据暂不可用" }, { status: 502 });
  }
}