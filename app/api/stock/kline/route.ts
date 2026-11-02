import { NextResponse } from "next/server";
import { aggregateBars } from "@/lib/data/indicators";
import { fetchSinaUsIndex, fetchTencentIndex, fetchEastmoneyIndex, TENCENT_SYMBOLS } from "@/lib/data/index-kline";
import { fetchStockQuote, type Quote } from "@/lib/data/quotes";
import { emJson } from "@/lib/data/eastmoney";
import { cachedJsonResponse } from "@/lib/data/http-cache";
import { klineTtlMs } from "@/lib/data/market-hours";

export const dynamic = "force-dynamic";

// 类型定义与「对齐最新交易日」的纯计算都放在 lib/data 下：
// 路由文件会连带 next/server、数据库连接，纯计算留在路由里就没法单测。
import type { KlineBar, KlinePeriod } from "@/lib/data/kline-types";
import { finalizeBars, cstToday } from "@/lib/data/kline-finalize";

// 仍然从本路由 re-export，避免 40+ 个既有调用点改 import 路径
export type { KlineBar, KlinePeriod } from "@/lib/data/kline-types";

const KLT: Record<KlinePeriod, number> = { day: 101, week: 102, month: 103 };

/**
 * 所有数据链路（东财/新浪/腾讯）取到的 K 线最后统一过一遍：
 * 1) A 股/ETF/沪深指数：用实时快照把「今天」的盘中 bar 补进日 K（或更新当天 bar）；
 * 2) 周/月 K：把 bar 日期从「周期起始日」改成「周期末交易日」——东财周 K 的 date 是周一、
 *    月 K 是月初首个交易日，直接画会让「最新日期」显示成 10-19 / 10-08，看起来像两周没更新；
 * 3) 当前周期最后一根的日期按实时交易日期/今天收敛，保证图例 as-of 与最新交易日一致。
 */
async function finalizeKlines(
  secid: string,
  mkt: string,
  period: KlinePeriod,
  klines: KlineBar[]
): Promise<{ bars: KlineBar[]; live: boolean; tradeDate?: string }> {
  if (!klines.length || (mkt !== "0" && mkt !== "1")) return { bars: klines, live: false };
  let quote: Quote | null = null;
  try {
    quote = await fetchStockQuote(secid);
  } catch {
    quote = null;
  }
  // 对齐/叠加实时 bar 的纯计算在 lib/data/kline-finalize.ts（有单测），这里只负责取快照
  return finalizeBars(period, klines, quote);
}

/**
 * 个股/ETF K 线接口（多数据源容错，保证本地/线上双环境可用）
 * 1) 东方财富 push2his（线上 Vercel 可达，日/周/月 + 前复权）
 * 2) 新浪 getKLineData（本地/线上均可达，A 股日线；周/月由日线聚合）★ 本地环境关键源
 * 3) 腾讯 fqkline（部分市场兜底）
 * 背景：本机网络到东财/腾讯均不稳定（曾致"K 线数据暂不可用"），新浪为稳定第三源。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secid = searchParams.get("secid")?.trim() ?? "";
  if (!/^\d+\.\w+$/.test(secid)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  const periodRaw = (searchParams.get("period") ?? "day").trim();
  const period: KlinePeriod = periodRaw === "week" ? "week" : periodRaw === "month" ? "month" : "day";
  const days = Math.min(8000, Math.max(10, Number(searchParams.get("days") ?? 500)));
  /**
   * 并发/重复请求缓存（2026-11-02 线上实测：本接口在 Vercel 上每次 1.9–4.3 秒，
   * 且响应不允许 CDN 缓存，于是「每换一只标的、每刷新一次」都要重新打上游，
   * K 线实验室首屏 6–8 秒才出图）。缓存键包含全部影响结果的参数；
   * TTL 按交易时段分档（盘中 20s / 非盘中 10min），见 lib/data/market-hours.ts。
   * 缓存里存的是「最终 JSON」，所以前端的实时 bar 合成、复权口径说明都原样复用。
   */
  return cachedJsonResponse(`kline:stock:${secid}:${period}:${days}`, klineTtlMs(), () =>
    buildKline(secid, period, days)
  );
}

/** 真正的取数逻辑（多源容错）。与缓存解耦，便于单独推理/测试。 */
async function buildKline(secid: string, period: KlinePeriod, days: number) {
  const [mkt, code] = secid.split(".");

  // ---- 源1：东方财富（fqt=1 前复权优先，失败再试 fqt=0 不复权）----
  /**
   * 为什么要逐个试 fqt：部分标的（ETF/基金）在前复权口径下东财返回空数组，
   * 而个股正常 —— 表现就是"个股 K 线好好的，ETF 专区一片空白"。
   * lib/data/sector-kline.ts 的 pullKlines 对同一类问题早已采用同样写法，这里对齐。
   * 注意 fqt 会影响历史价格（分红除权），所以回传里注明实际用的是哪个口径。
   */
  for (const fqt of [1, 0]) {
    try {
      const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(
        secid
      )}&klt=${KLT[period]}&fqt=${fqt}&beg=19900101&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57`;
      // 行情数据必须 no-store（见下）。统一走 emJson：限并发 + 重试，
      // 避免页面同时拉多只标的 K 线时被上游按并发连接数批量掐断。
      const json = await emJson<{ data?: { klines?: string[]; name?: string; code?: string } }>(url, {
        timeoutMs: 20000,
      });
      if (!json) throw new Error("em unavailable");
      const raw: string[] = json?.data?.klines ?? [];
      if (!Array.isArray(raw) || !raw.length) throw new Error("empty");
      const name = String(json?.data?.name ?? secid);
      const klines: KlineBar[] = raw.slice(-days).map((row) => {
        const [date, open, close, high, low, volume, amount] = row.split(",");
        return {
          date, open: Number(open), close: Number(close), high: Number(high), low: Number(low),
        // 东财 f56=成交量（手）、f57=成交额（元）：本接口对外统一「手」，故不换算
        volume: Math.round(Number(volume)), amount: Math.round(Number(amount)),
        };
      });
      // 回传实际覆盖区间与复权口径，前端据此显示而不是猜
      const final = await finalizeKlines(secid, mkt, period, klines);
      return NextResponse.json({
        name, code: String(json?.data?.code ?? code), secid, period, klines: final.bars,
        total: raw.length,
        adjust: fqt === 1 ? "前复权" : "不复权",
        live: final.live,
        tradeDate: final.tradeDate,
        span: final.bars.length ? { from: final.bars[0].date, to: final.bars[final.bars.length - 1].date } : null,
      });
    } catch {
      /* 换下一个 fqt，或落到新浪兜底 */
    }
  }

  // ---- 源2：新浪（A 股/ETF 日线，周/月聚合）----
  if (mkt === "1" || mkt === "0") {
    try {
      const sym = `${mkt === "1" ? "sh" : "sz"}${code}`;
      /**
       * datalen 必须封顶：实测新浪该接口 datalen=1800 正常、2000 起返回空
       * （响应体只剩 62 字节的 JSONP 外壳）。
       * 原先日线直接传 days（默认 2500），于是新浪兜底**必然失败**，
       * 东财一旦取不到就整个 502 —— 这就是 ETF 日线打不开的直接原因。
       */
      const SINA_MAX = 1800;
      const need = period === "day" ? Math.min(SINA_MAX, days) : Math.min(500, days * 5);
      const url = `https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_=/CN_MarketDataService.getKLineData?symbol=${sym}&scale=240&ma=no&datalen=${need}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { Referer: "https://finance.sina.com.cn/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      const text = await res.text();
      const m = text.match(/\((\[[\s\S]*?\])\)/);
      if (!m) throw new Error("sina empty");
      const rows = JSON.parse(m[1]) as Array<{ day: string; open: string; high: string; low: string; close: string; volume: string }>;
      if (!rows?.length) throw new Error("sina empty");
      // 新浪 getKLineData 的 volume 单位是「股」（实测茅台 4,159,916 股），
      // 而东财/腾讯/本接口对外统一是「手」，故 /100 归一化，避免混源时量能差 100 倍。
      let bars = rows.map((r) => ({
        date: r.day, open: Number(r.open), close: Number(r.close), high: Number(r.high), low: Number(r.low), volume: Math.round(Number(r.volume) / 100),
      }));
      if (period !== "day") bars = aggregateBars(bars, period);
      const rawKlines: KlineBar[] = bars.slice(-days).map((b) => ({ ...b, amount: 0 }));
      const final = await finalizeKlines(secid, mkt, period, rawKlines);
      return NextResponse.json({
        name: `${sym}`, code, secid, period, klines: final.bars,
        source: "新浪",
        live: final.live,
        tradeDate: final.tradeDate,
        // 与东财分支保持同样的区间回传，前端不必猜覆盖到哪一天
        span: final.bars.length ? { from: final.bars[0].date, to: final.bars[final.bars.length - 1].date } : null,
      });
    } catch {
      /* fallthrough */
    }
  }

  // ---- 源2.5：全球指数（100. 前缀）专用兜底 ----
  if (mkt === "100") {
    try {
      // 新浪美股（SPX/NDX/DJIA）
      const su = await fetchSinaUsIndex(code, days);
      if (su?.length) {
        return NextResponse.json({
          name: code,
          code,
          secid,
          period,
          source: "新浪美股",
          klines: su.slice(-days).map((b) => ({ ...b, amount: 0 })),
        });
      }
      // 腾讯（美股三大指数 + 恒指 hkHSI）
      const tx = await fetchTencentIndex(code, days);
      if (tx?.length) {
        return NextResponse.json({
          name: code,
          code,
          secid,
          period,
          source: "腾讯",
          klines: tx.slice(-days).map((b) => ({ ...b, amount: 0 })),
        });
      }
      // 东财（N225/KS11/GDAXI/FTSE 等）
      const em = await fetchEastmoneyIndex(secid, days);
      if (em?.length) {
        return NextResponse.json({
          name: code,
          code,
          secid,
          period,
          source: "东方财富",
          klines: em.slice(-days).map((b) => ({ ...b, amount: 0 })),
        });
      }
    } catch {
      /* fallthrough */
    }
  }

  // ---- 源3：腾讯 ----
  try {
    const prefix = mkt === "1" ? "sh" : mkt === "0" ? "sz" : mkt === "100" ? (TENCENT_SYMBOLS[code] ?? "hk") : "sh";
    const param = mkt === "100" && TENCENT_SYMBOLS[code] ? TENCENT_SYMBOLS[code] : `${prefix}${code}`;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param},${period},,,${days},qfq`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) throw new Error(`tx ${res.status}`);
    const json = await res.json();
    const node = json?.data?.[param];
    const raw: any[][] = node?.[`qfq${period}`] || node?.[period] || [];
    if (!Array.isArray(raw) || !raw.length) throw new Error("empty");
    const rawKlines: KlineBar[] = raw.map((row: any[]) => ({
      date: String(row[0]), open: Number(row[1]), close: Number(row[2]), high: Number(row[3]), low: Number(row[4]),
      // 腾讯 fqkline volume 单位是手，与本接口的其他源统一，不再 ×100
      volume: Math.round(Number(row[5])), amount: 0,
    }));
    const final = await finalizeKlines(secid, mkt, period, rawKlines);
    return NextResponse.json({ name: String(node?.qt?.name ?? param), code, secid, period, klines: final.bars, live: final.live, tradeDate: final.tradeDate });
  } catch {
    return NextResponse.json({ error: "K 线数据暂不可用" }, { status: 502 });
  }
}
