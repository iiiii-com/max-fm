import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface NewsItem {
  title: string;
  url: string;
  ctime: string;
  date: string;
}

export async function GET() {
  try {
    const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&num=20&page=1&r=${Date.now()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`news api ${res.status}`);
    const json = await res.json();
    const list = json?.result?.data || [];
    const items: NewsItem[] = list.map((x: any) => ({
      title: String(x.title ?? ""),
      url: String(x.url ?? ""),
      ctime: String(x.ctime ?? ""),
      date: formatCtime(String(x.ctime ?? "")),
    }));
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, items: [] });
  }
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