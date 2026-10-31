import { NextResponse } from "next/server";

/**
 * CSP 违规上报收集端点（任务④：先只观察，不拦截）。
 *
 * 背景：站点此前没有任何 CSP。直接上强制 CSP 会因为 Next 内联脚本、ECharts、
 * 地图瓦片、AI 富文本等因素白屏，所以先用 `Content-Security-Policy-Report-Only`
 * 观察一段时间：浏览器只上报违规、不阻断资源。
 *
 * 认证与隐私：
 * - 匿名可上报（浏览器不会带 Cookie 到 report-uri 之外的语义保证，这里也不需要鉴权）；
 * - 只记录定位问题所需的字段（指令名、被拦资源、文档路径），并做长度截断；
 * - 不落库，只在进程内做「同指令同资源 10 分钟内只记一次 + 计数」，避免刷屏与被打爆；
 * - 不记录 IP、Referer、Cookie、完整查询串（页面 HTML 里可能带用户标识）。
 */

interface Bucket {
  count: number;
  first: number;
  last: number;
  sample: string;
}

const WINDOW_MS = 10 * 60_000;
const MAX_BUCKETS = 80;
const buckets = new Map<string, Bucket>();

function clip(v: unknown, max = 160): string {
  if (typeof v !== "string") return "";
  const cut = v.split(/[?#]/)[0];
  return cut.length > max ? `${cut.slice(0, max)}…` : cut;
}

/** 兼容三种上报格式：report-uri 旧格式、Reporting API 数组、以及裸对象。 */
function normalize(body: any): Array<{ directive: string; blocked: string; doc: string }> {
  const out: Array<{ directive: string; blocked: string; doc: string }> = [];
  const push = (r: any) => {
    if (!r || typeof r !== "object") return;
    const directive = clip(r["violated-directive"] ?? r["effective-directive"] ?? r.effectiveDirective, 64);
    if (!directive) return;
    out.push({
      directive,
      blocked: clip(r["blocked-uri"] ?? r.blockedURL ?? r.blockedURI),
      doc: clip(r["document-uri"] ?? r.documentURL ?? r.documentURI),
    });
  };

  if (Array.isArray(body)) body.forEach((item) => push(item?.body ?? item));
  else if (body && typeof body === "object") {
    if (body["csp-report"]) push(body["csp-report"]);
    else if (Array.isArray(body.reports)) body.reports.forEach((item: any) => push(item?.body ?? item));
    else push(body);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const now = Date.now();
    for (const v of normalize(body)) {
      const key = `${v.directive} ${v.blocked}`.slice(0, 200);
      const cur = buckets.get(key);
      if (cur && now - cur.first < WINDOW_MS) {
        cur.count += 1;
        cur.last = now;
      } else if (buckets.size < MAX_BUCKETS || cur) {
        buckets.set(key, { count: 1, first: now, last: now, sample: v.doc });
        // 只在「首次出现」时打一条日志，避免同一违规刷爆日志
        console.warn(`[csp] ${v.directive} blocked=${v.blocked || "(none)"} doc=${v.doc || "(unknown)"}`);
      }
    }
  } catch {
    // 上报体可能是畸形 JSON，直接忽略：这个端点绝不能因为解析失败而 500 影响页面
  }
  return new NextResponse(null, { status: 204 });
}

/** 运维自查：看当前进程内累计到了哪些违规（不暴露任何用户信息）。 */
export async function GET() {
  const now = Date.now();
  const list = [...buckets.entries()]
    .filter(([, b]) => now - b.first < WINDOW_MS)
    .map(([key, b]) => {
      const [directive, blocked] = key.split(" ");
      return { directive, blocked: blocked || "", count: b.count, lastAt: new Date(b.last).toISOString() };
    })
    .sort((a, b) => b.count - a.count);
  return NextResponse.json(
    { ok: true, windowMinutes: WINDOW_MS / 60_000, total: list.reduce((n, x) => n + x.count, 0), items: list.slice(0, 40) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
