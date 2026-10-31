import { NextResponse } from "next/server";
import { fetchEtfQuote, computeIndicators, type EtfQuote } from "@/lib/data/market";
import { fetchKline } from "@/lib/data/kline";

export const dynamic = "force-dynamic";

/**
 * ETF 行情快照。
 *
 * 容错策略（对应「ETF 有时无法显示数据」）：
 *  1. 东财快照失败 → fetchEtfQuote 内部已自动切新浪兜底（价格/涨跌幅/成交额）；
 *  2. 快照与 K 线都拿不到才算失败；
 *  3. 只有 K 线成功时，用最近两根 K 线合成一份行情（净值/换手率留 null，前端显示「—」）。
 * 绝不因为「净值缺失」就把整个详情判 502 —— 净值是加分项，不是页面能否显示的前提。
 */
export async function GET(req: Request) {
  const secid = new URL(req.url).searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const [quote, klines] = await Promise.all([
    fetchEtfQuote(secid).catch(() => null),
    fetchKline(secid, undefined, undefined, "day").catch(() => null),
  ]);
  const bars = klines ?? [];
  const barsOk = bars.length >= 2;

  let q: EtfQuote | null = quote;
  if (!q && barsOk) {
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const changePct = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;
    q = {
      code: secid.split(".")[1] ?? "",
      name: "",
      price: last.close,
      prevClose: prev.close,
      changePct,
      nav: null,
      navDate: null,
      navStale: false,
      premiumPct: null,
      turnover: 0,
      amount: last.amount ?? 0,
      volume: last.volume ?? 0,
      scale: 0,
    };
  }

  if (!q) {
    return NextResponse.json(
      { ok: false, error: "ETF 行情暂不可用：行情源与 K 线源均未返回数据，请稍后重试" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    quote: q,
    signals: barsOk ? computeIndicators(bars) : { signals: [] },
    // 页面据此提示「仅有 K 线数据，净值/换手率暂缺」
    partial: { quote: !!quote, kline: barsOk },
  });
}
