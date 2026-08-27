import { NextResponse } from "next/server";
import { fetchEastmoneyIndex, fetchSinaCnIndex, fetchTencentIndex, fetchSinaUsIndex } from "@/lib/data/index-kline";

export const dynamic = "force-dynamic";

interface Target {
  name: string;
  secid: string;
  price: number | null;
  changePct: number | null;
  pe: number | null;
  pb: number | null;
  eps: number | null;
  totalMv: number | null;
  monthChg: number | null; // 近 20 日涨跌
  verdict: string; // 估值/状态结论
}

/** 预置标的词典（问答匹配） */
const DICT: Array<{ name: string; secid: string; aliases: string[] }> = [
  { name: "上证指数", secid: "1.000001", aliases: ["上证", "沪指", "大盘"] },
  { name: "深证成指", secid: "0.399001", aliases: ["深成指", "深指"] },
  { name: "创业板指", secid: "0.399006", aliases: ["创业板"] },
  { name: "沪深300", secid: "1.000300", aliases: ["沪深 300"] },
  { name: "中证500", secid: "1.000905", aliases: ["中证 500"] },
  { name: "科创50", secid: "1.000688", aliases: ["科创 50"] },
  { name: "恒生指数", secid: "100.HSI", aliases: ["恒指", "恒生", "港股大盘"] },
  { name: "标普500", secid: "100.SPX", aliases: ["标普", "美股大盘"] },
  { name: "纳斯达克", secid: "100.NDX", aliases: ["纳指", "纳斯达克指数"] },
  { name: "道琼斯", secid: "100.DJIA", aliases: ["道指"] },
  { name: "日经225", secid: "100.N225", aliases: ["日经", "日股"] },
  { name: "贵州茅台", secid: "1.600519", aliases: ["茅台", "600519"] },
  { name: "宁德时代", secid: "0.300750", aliases: ["宁德", "300750"] },
  { name: "五粮液", secid: "0.000858", aliases: ["五粮液", "858"] },
  { name: "平安银行", secid: "0.000001", aliases: ["平安银行", "深发展"] },
  { name: "招商银行", secid: "1.600036", aliases: ["招行", "招商"] },
  { name: "比亚迪", secid: "0.002594", aliases: ["比亚迪", "2594"] },
  { name: "腾讯控股", secid: "100.00700", aliases: ["腾讯", "00700"] },
  { name: "阿里巴巴", secid: "100.09988", aliases: ["阿里", "阿里巴巴"] },
];

function findTargets(q: string) {
  const lower = q.toLowerCase();
  return DICT.filter(
    (d) => lower.includes(d.name) || d.aliases.some((a) => lower.includes(a.toLowerCase()))
  );
}

/** 拉个股财务（东财实时；指数返回 null） */
async function fetchFund(secid: string) {
  const mkt = secid.split(".")[0];
  if (mkt === "100") return null; // 全球指数无个股财务
  try {
    const res = await fetch(`http://localhost:3333/api/stock/fundamentals?secid=${secid}`, { cache: "no-store" });
    const j = await res.json();
    if (j?.ok && j.data) {
      const d = j.data;
      const pe = Number(d.pe);
      return {
        pe: isFinite(pe) && pe > 0 ? pe : null,
        pb: Number(d.pb) || null,
        eps: Number(d.eps) || null,
        price: Number(d.price) || null,
        totalMv: Number(d.totalMv) || null,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 拉指数/个股 K 线近 20 日（多源） */
async function fetchKlineTail(secid: string, days = 30) {
  const { mkt, code } = { mkt: secid.split(".")[0], code: secid.split(".")[1] };
  let bars: Array<{ date: string; close: number }> | null = null;
  if (mkt === "1" || mkt === "0") {
    bars = await fetchSinaCnIndex(secid, days);
  } else if (mkt === "100") {
    bars = (await fetchSinaUsIndex(code, days)) ?? (await fetchTencentIndex(code, days));
  }
  if (!bars?.length) bars = await fetchEastmoneyIndex(secid, days);
  return bars;
}

/** 拉实时行情（新浪/腾讯）——复用 quotes 接口逻辑简化：走站内 quotes 匹配 */
async function fetchQuoteByName(name: string) {
  try {
    const res = await fetch(`http://localhost:3333/api/quotes`, { cache: "no-store" });
    const j = await res.json();
    const q = (j?.quotes ?? []).find((x: any) => x.name === name || x.name.includes(name) || name.includes(x.name));
    if (q) return { price: q.price, changePct: q.changePct };
  } catch {
    /* ignore */
  }
  return null;
}

function verdict(peRaw: unknown): string {
  const pe = typeof peRaw === "number" && isFinite(peRaw) ? peRaw : Number(peRaw);
  if (!isFinite(pe) || pe <= 0) return "估值数据暂不可用";
  if (pe < 15) return `PE ${pe.toFixed(1)} 低于 15 倍中枢 → 低估区（安全边际较足）`;
  if (pe <= 30) return `PE ${pe.toFixed(1)} 处于 15-30 倍合理区间 → 估值合理`;
  return `PE ${pe.toFixed(1)} 高于 30 倍中枢 → 高估区（警惕拥挤）`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ error: "请输入问题", q });

  const targets = findTargets(q);
  if (!targets.length) {
    return NextResponse.json({
      q,
      type: "not-found",
      answer: `未在预置词典中找到「${q}」对应的标的。可尝试：贵州茅台贵不贵 / 上证指数最近走势 / 恒生指数估值 / 标普500表现 / 腾讯控股价格`,
      targets: [],
    });
  }

  const results: Target[] = [];
  for (const t of targets.slice(0, 3)) {
    const isIndex = t.secid.startsWith("100.") && !t.secid.startsWith("100.00");
    const fund = isIndex ? null : await fetchFund(t.secid);
    const bars = await fetchKlineTail(t.secid, 30);
    const quote = await fetchQuoteByName(t.name);
    let monthChg: number | null = null;
    if (bars && bars.length >= 21) {
      const base = bars[bars.length - 21].close;
      const cur = bars[bars.length - 1].close;
      monthChg = base ? Number((((cur - base) / base) * 100).toFixed(2)) : null;
    }
    results.push({
      name: t.name,
      secid: t.secid,
      price: fund?.price ?? quote?.price ?? (bars?.length ? bars[bars.length - 1].close : null) ?? null,
      changePct: quote?.changePct ?? null,
      pe: fund?.pe ?? null,
      pb: fund?.pb ?? null,
      eps: fund?.eps ?? null,
      totalMv: fund?.totalMv ?? null,
      monthChg,
      verdict: verdict(fund?.pe ?? null),
    });
  }

  // 组装自然语言答案
  const lines = results.map((r) => {
    const price = r.price != null ? `${r.price.toFixed(2)}` : "—";
    const chg = r.changePct != null ? `${r.changePct >= 0 ? "涨" : "跌"} ${Math.abs(r.changePct).toFixed(2)}%` : "";
    const mo = r.monthChg != null ? `近 1 月${r.monthChg >= 0 ? "涨" : "跌"} ${Math.abs(r.monthChg).toFixed(1)}%` : "";
    const mv = r.totalMv != null ? ` · 总市值 ${(r.totalMv / 1e12).toFixed(2)} 万亿` : "";
    return `${r.name}：现价 ${price}${chg ? "（" + chg + "）" : ""}${mo}。${r.verdict}${mv}`;
  });

  return NextResponse.json({
    q,
    type: "answer",
    answer: lines.join("\n"),
    targets: results,
  });
}
