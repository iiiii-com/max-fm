import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface NewsItem {
  title: string;
  url: string;
  ctime: string;
  date: string;
  /** 来源栏目（由 URL 路径推断），用于前端标注 */
  channel: string;
  /** 命中「非市场内容」规则时为 true，前端会标注或过滤 */
  offMarket?: boolean;
}

/**
 * 快讯栏目过滤规则。
 *
 * 旧实现把新浪 roll feed 原样透传，于是 A 股行情页的「财经快讯」里会混进：
 *   手机新品发布、企业公关稿、名人八卦、诉讼新闻、券商对某只港股的评级快评……
 * 这些对「看盘」这一使用场景是纯噪音，会稀释真正与持仓/大盘相关的条目。
 *
 * 现在按栏目 + 关键词两级过滤：栏目只保留财经类；标题命中「非市场内容」特征词的条目
 * 标记 offMarket，由前端决定降权还是隐藏。**不做语义判断、不改写标题**，
 * 只做可解释的规则过滤，并在响应里返回被过滤的条数以便读者核对。
 */
const MARKET_CHANNELS = new Set(["hyjz", "stock", "finance", "cj", "gn"]);

/** 与「大盘/持仓研究」无关的内容特征词（命中即标记为 offMarket） */
const OFF_MARKET_PATTERNS: RegExp[] = [
  /发布会|新品|上市发布会|首款|正式发售/,              // 产品发布
  /将出席|参加.*大会|论坛|峰会.*召开|圆满举行/,        // 公关活动
  /回应|辟谣|道歉|维权|起诉|名誉|纠纷|争议/,           // 社会/舆论事件
  /离婚|结婚|恋情|去世|逝世|悼念|遗体/,               // 名人/社会新闻
  /视频\|/,                                          // 视频栏目（非文本快讯）
  / sustains|专栏|海报|图集/,                          // 图集类
];

/** 从 URL 推断新浪栏目 */
function channelOf(url: string): string {
  const m = url.match(/finance\.sina\.com\.cn\/([a-z]+)\//);
  return m ? m[1] : "";
}

function isOffMarket(title: string): boolean {
  return OFF_MARKET_PATTERNS.some((re) => re.test(title));
}

export async function GET() {
  try {
    // 多取一些，过滤后仍能凑够 20 条
    const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&num=40&page=1&r=${Date.now()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`news api ${res.status}`);
    const json = await res.json();
    const list = json?.result?.data || [];

    let dropped = 0;
    const all: NewsItem[] = [];
    for (const x of anyList(list)) {
      const title = String(x?.title ?? "").trim();
      const link = String(x?.url ?? "");
      if (!title) continue;
      const ch = channelOf(link);
      if (ch && !MARKET_CHANNELS.has(ch)) {
        dropped++;
        continue;
      }
      all.push({
        title,
        url: link,
        ctime: String(x?.ctime ?? ""),
        date: formatCtime(String(x?.ctime ?? "")),
        channel: ch,
        offMarket: isOffMarket(title),
      });
    }

    // offMarket 降到列表末尾（而不是丢弃），保证信息不丢失、只是不占据前排
    const primary = all.filter((i) => !i.offMarket).slice(0, 20);
    const items = primary.length >= 5 ? primary : all.slice(0, 20);

    return NextResponse.json(
      { ok: true, items, filtered: dropped, total: all.length },
      { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } }
    );
  } catch {
    return NextResponse.json({ ok: false, items: [] });
  }
}

function anyList(v: unknown): any[] {
  return Array.isArray(v) ? (v as any[]) : [];
}

function formatCtime(ts: string): string {
  const n = Number(ts);
  if (!n) return "";
  const d = new Date(n * 1000);
  const now = Date.now();
  const diff = Math.floor((now - n * 1000) / 60000);
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff} 分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
