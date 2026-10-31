import { NextResponse } from "next/server";
import { fetchIndexKlineMulti, type IndexKlineBar } from "@/lib/data/index-kline";
import { fetchStockQuote } from "@/lib/data/quotes";

export const dynamic = "force-dynamic";

export interface IndexKlineBar_ {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

/**
 * 指数 K 线接口（多源容错：东财 → 新浪/腾讯）
 * 支持全球指数 secid：100.SPX（标普500）/ 100.NDX（纳指）/ 100.DJIA（道指）/
 * 100.HSI（恒指）/ 100.N225（日经）/ 1.000001（上证）等。
 * 修复：本机环境东财不可达时自动降级新浪/腾讯；N225/KS11/GDAXI/FTSE 仅东财支持（线上可用）。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  /**
   * 天数上限由此处决定。
   * 原先 Math.min(500, ...) 把指数 K 线限制在约 2 年，
   * 而东财/腾讯接口实际可返回数十年（beg 放到 1990 后）。
   * 现上限 8000 根，日线可覆盖指数全历史。
   */
  const days = Math.min(8000, Math.max(5, Number(searchParams.get("days") ?? 60)));

  const { bars, source } = await fetchIndexKlineMulti(secid, days);

  /**
   * 盘中「最新一天」补齐：上游指数 K 线在部分时段只给到昨收，而实时快照已有今天的价格。
   * 对沪深指数（secid 0.xxx / 1.xxx）用实时快照合成/更新最后一根日 bar，
   * 这样指数详情 K 线的 as-of 不会停留在昨天（用户反馈「K 线没有更新到最新日期」）。
   */
  let outBars = bars;
  let tradeDate: string | undefined;
  if (/^[01]\./.test(secid)) {
    try {
      const q = await fetchStockQuote(secid);
      tradeDate = q?.tradeDate;
      if (q && tradeDate && q.price > 0 && outBars.length) {
        const last = outBars[outBars.length - 1];
        if (tradeDate > last.date) {
          outBars = [
            ...outBars,
            {
              date: tradeDate,
              open: q.open || q.price,
              close: q.price,
              high: q.high || q.price,
              low: q.low || q.price,
              volume: q.volume || 0,
            } as IndexKlineBar,
          ];
        } else if (tradeDate === last.date) {
          outBars = [
            ...outBars.slice(0, -1),
            {
              ...last,
              close: q.price,
              high: Math.max(last.high, q.high || q.price),
              low: Math.min(last.low, q.low || q.price),
              volume: q.volume || last.volume,
            },
          ];
        }
      }
    } catch {
      /* 实时快照失败不影响历史 K 线 */
    }
  }

  if (!outBars.length) {
    return NextResponse.json(
      { error: "指数 K 线暂不可用（本机数据源受限，请刷新重试或访问线上版本）" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    name: secid,
    code: secid.split(".")[1],
    secid,
    source,
    tradeDate,
    klines: outBars,
    // 实际覆盖区间，供前端显示而不是猜
    span: outBars.length ? { from: outBars[0].date, to: outBars[outBars.length - 1].date } : null,
  });
}

export type { IndexKlineBar_ as IndexKlineBar };
