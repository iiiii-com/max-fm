import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

const KEYWORDS = ["金融", "财政", "经济", "产业", "货币", "税收", "房地产", "科技", "农业", "外贸", "消费", "投资", "就业", "能源", "人工智能", "设备更新", "民营企业", "国债", "降息", "消费券"];

const SRC_ORG: Record<string, string> = {
  gov: "中国政府网", mof: "财政部", ndrc: "国家发展改革委", pbc: "中国人民银行",
};

async function fetchText(url: string, timeoutMs = 25000, headers: Record<string, string> = UA): Promise<string> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`fetch ${url} status ${res.status}`);
  return res.text();
}

// 部委站点对 Node 的 TLS 指纹返回验证页，需经 curl 抓取
async function fetchViaCurl(url: string, timeoutMs = 25000): Promise<string> {
  const binaries = ["curl", "curl.exe"];
  let lastErr: any = null;
  for (const bin of binaries) {
    try {
      const { stdout } = await execFileAsync(bin, ["-s", "-m", String(Math.ceil(timeoutMs / 1000)), "-A", UA["User-Agent"], url], { timeout: timeoutMs + 5000, encoding: "utf8" });
      // 有效性校验：页面里必须存在「带日期的链接」。
      // 各部委 URL 里的日期长度不一致——
      //   财政部/发改委：/202509/t20250924_1234.htm  → 20 + 6 位
      //   人民银行：    /.../2026092408454713496/index.html → 20 + 16 位
      // 旧校验写作 /20\d{4,8}\// ，只能匹配前者，人民银行页面被判为「响应无日期链接」而整源失败，
      // 直接导致「货币政策」分类的数据停更。
      if (stdout.length > 1000 && /20\d{4,16}[/_.]/.test(stdout)) return stdout;
      lastErr = new Error(`响应无日期链接(${stdout.length})`);
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("curl 全部失败");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&ensp;|&emsp;/g, " ")
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&mdash;|&ndash;/g, "-")
    .replace(/&times;/g, "x")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchGovSearch(): Promise<Array<{
  title: string; docNo: string; pubDate: string; url: string; summary: string; body: string; department: string;
}>> {
  const out: any[] = [];
  for (const kw of KEYWORDS) {
    const url = `https://sousuo.www.gov.cn/search-gov/data?t=zhengcelibrary_gw&q=${encodeURIComponent(kw)}&p=1&n=20&sort=pubtime&sortType=1`;
    const text = await fetchText(url);
    try {
      const j = JSON.parse(text);
      const list: any[] = j?.searchVO?.listVO || [];
      for (const it of list) {
        if (!it?.url || !it?.title) continue;
        out.push({
          title: String(it.title).replace(/<[^>]+>/g, "").trim(),
          docNo: String(it.pcode || ""),
          pubDate: String(it.pubtimeStr || "").replace(/\./g, "-").slice(0, 10),
          url: String(it.url),
          summary: String(it.summary || "").replace(/<[^>]+>/g, "").replace(/<em>|<\/em>/g, "").trim(),
          body: "",
          department: String(it.fwdw || ""),
        });
      }
    } catch {
      // skip malformed page
    }
  }
  const seen = new Set<string>();
  const uniq = out.filter((x) => {
    const k = x.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const withBody: any[] = [];
  for (const it of uniq.slice(0, 80)) {
    try {
      const html = await fetchText(it.url, 30000);
      const m = html.match(/<div[^>]*class="[^"]*pages_content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const body = stripHtml(m ? m[1] : html);
      if (body.length > 80) it.body = body.slice(0, 8000);
    } catch {
      it.body = "";
    }
    withBody.push(it);
  }
  return withBody;
}

/**
 * 清洗抓取到的摘要。
 *
 * 部委列表页的摘要直接取正文前若干字符，因此经常从句子中间开始，
 * 列表里出现「收入和支出。 第五条　审计法所称财务收支…」这类半截话。
 * 这里丢掉开头的不完整句子，并在句末截断（超过长度时补省略号）。
 */
function cleanSummary(text: string, maxLen = 110): string {
  let s = stripHtml(text ?? "");
  // 丢掉开头的不完整片段。
  // 关键约束：只有当**丢弃后仍有足够内容**时才丢。
  // 旧实现只判 `firstStop < 24`，于是「破除地方保护和市场分割，推动要素市场化配置。」
  // 这类首句在 24 字内结束的正常短摘要，会被 slice 成空字符串 —— 164 条存量里 46 条命中。
  const MIN_AFTER_DROP = 24;
  const firstStop = s.search(/[。！？；]/);
  if (firstStop > 0 && firstStop < 24 && s.length - (firstStop + 1) >= MIN_AFTER_DROP) {
    s = s.slice(firstStop + 1);
  }
  s = s.replace(/^[，、。；：\s]+/, "").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("；"), cut.lastIndexOf("！"), cut.lastIndexOf("？"));
  return (lastStop > maxLen * 0.5 ? cut.slice(0, lastStop + 1) : cut) + "…";
}

/**
 * 解析部委政策列表页。
 *
 * 日期精度：旧实现只从 URL 抠年+月，所有部委条目入库都是「2026-09」这种月级日期，
 * 列表里出现「2026-09」与「2026-09-24」两种粒度并存。现在优先取 **anchor 之后紧邻文本**
 * 里的完整日期（部委列表页通常是 <a>标题</a><span>2026-09-24</span>），
 * 取不到才回退 URL 里的年+月，且必须通过合法性校验才写入。
 */
async function parseListPage(html: string, base: string, max = 25): Promise<Array<{
  title: string; pubDate: string; url: string;
}>> {
  const out: any[] = [];
  const VALID_YYYYMMDD = /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,120}?)<\/a>/g)];
  const picked: Array<{ href: string; text: string; tail: string }> = [];
  for (const m of matches) {
    const text = stripHtml(m[2]);
    if (text.length <= 8) continue;
    if (!/20\d{4,16}/.test(m[1]) || !/\.html/.test(m[1])) continue;
    // anchor 结束后的一小段文本，用于找紧随其后的日期
    picked.push({ href: m[1], text, tail: html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 200) });
    if (picked.length >= max) break;
  }

  for (const l of picked) {
    const norm = l.href.replace(/^t?p?p?:\/\//, "").replace(/^\/\//, "");
    const full = norm.startsWith("http") ? norm : new URL(norm, base).href;

    // 1) 优先：anchor 之后的紧邻日期文本（<span class="hui12">2026-09-24</span>）
    const tailDate = l.tail.match(/(20\d{2}-\d{2}-\d{2})/);
    let pubDate = tailDate && VALID_YYYYMMDD.test(tailDate[1]) ? tailDate[1] : "";

    // 2) 回退：URL 里的 6 位年+月
    if (!pubDate) {
      const d = norm.match(/20(\d{2})(\d{2})/);
      if (d) pubDate = `${d[1]}-${d[2]}`;
    }

    out.push({
      title: l.text.trim(),
      pubDate,
      url: full.replace(/^https?:\/\//, "https://"),
    });
  }
  return out;
}

async function syncFromGov(): Promise<number> {
  const items = await fetchGovSearch();
  let inserted = 0;
  for (const it of items) {
    const exists = await db.select({ id: s.policies.id }).from(s.policies)
      .where(sql`source_url = ${it.url}`).limit(1);
    if (exists.length) continue;
    const ts = now();
    await db.insert(s.policies).values({
      id: uid("pol"), title: it.title, summary: cleanSummary(it.summary || it.title),
      content: it.body || null, department: it.department || "国务院",
      category: "官方政策", status: "published", source: SRC_ORG.gov,
      sourceUrl: it.url, publishDate: it.pubDate || null,
      tags: JSON.stringify(["国务院", "官方发布"]),
      createdAt: ts, updatedAt: ts,
    } as any);
    inserted++;
  }
  return inserted;
}

/**
 * 政策分类器（来源 + 标题关键词）
 *
 * 旧实现给所有部委条目写死 category="部委公告" / "央行公告"，
 * 导致筛选器里的「货币政策 / 财政 / 资本市场 / 房地产」等分类几乎为空
 * （实测：财政 1 条、房地产 1 条、资本市场 3 条，且最新日期可差 2 年），
 * 而每天真正同步到的部委政策全落在一个不参与筛选的通用桶里。
 * 现在按「发布机构 + 标题关键词」归入与筛选器一致的分类。
 */
function classifyPolicy(title: string, dept: string): string {
  const t = String(title ?? "");
  if (dept === "中国人民银行") return "货币政策";
  if (dept === "财政部") {
    if (/税|增值税|所得税|关税|退税/.test(t)) return "财税";
    if (/金融|银行|证券|保险|资本市场|直接融资/.test(t)) return "资本市场";
    return "财政";
  }
  if (dept === "国家发展改革委") {
    if (/产业|制造业|科技|创新|数字|算力|人工智能|新能源/.test(t)) return "产业政策";
    if (/价格|物价|收费/.test(t)) return "财税";
    return "产业政策";
  }
  if (/资本市场|证券|交易所|退市|IPO|再融资|上市公司/.test(t)) return "资本市场";
  if (/货币|利率|降准|降息|存款准备金|公开市场|流动性|再贷款/.test(t)) return "货币政策";
  if (/财政|预算|国债|转移支付|专项债|减税/.test(t)) return "财政";
  if (/税|增值税|所得税|关税|退税/.test(t)) return "财税";
  if (/房地产|楼市|商品房|住房|公积金|土地/.test(t)) return "房地产";
  if (/消费|零售|家电|以旧换新|促消费|文旅/.test(t)) return "消费促进";
  if (/开放|外资|外贸|进出口|关税|自贸/.test(t)) return "对外开放";
  if (/改革|体制|机制|试点/.test(t)) return "改革";
  if (/民生|医疗|教育|社保|就业|养老|生育/.test(t)) return "民生";
  return "部委公告";
}

async function syncFromMof(): Promise<number> {
  const html = await fetchViaCurl("https://www.mof.gov.cn/zhengwuxinxi/zhengcefabu/");
  const items = await parseListPage(html, "https://www.mof.gov.cn/zhengwuxinxi/zhengcefabu/");
  let inserted = 0;
  for (const it of items) {
    const exists = await db.select({ id: s.policies.id }).from(s.policies)
      .where(sql`source_url = ${it.url}`).limit(1);
    if (exists.length) continue;
    const ts = now();
    await db.insert(s.policies).values({
      id: uid("pol"), title: it.title, summary: cleanSummary(it.title) || it.title,
      department: "财政部", category: classifyPolicy(it.title, "财政部"), status: "published",
      source: SRC_ORG.mof, sourceUrl: it.url, publishDate: it.pubDate || null,
      tags: JSON.stringify(["财政部", "官方发布"]), createdAt: ts, updatedAt: ts,
    } as any);
    inserted++;
  }
  return inserted;
}

async function syncFromNdr(): Promise<number> {
  const html = await fetchViaCurl("https://www.ndrc.gov.cn/xxgk/zcfb/fzggwl/");
  const items = await parseListPage(html, "https://www.ndrc.gov.cn/xxgk/zcfb/");
  let inserted = 0;
  for (const it of items) {
    const exists = await db.select({ id: s.policies.id }).from(s.policies)
      .where(sql`source_url = ${it.url}`).limit(1);
    if (exists.length) continue;
    const ts = now();
    await db.insert(s.policies).values({
      id: uid("pol"), title: it.title, summary: cleanSummary(it.title) || it.title,
      department: "国家发展改革委", category: classifyPolicy(it.title, "国家发展改革委"), status: "published",
      source: SRC_ORG.ndrc, sourceUrl: it.url, publishDate: it.pubDate || null,
      tags: JSON.stringify(["发改委", "官方发布"]), createdAt: ts, updatedAt: ts,
    } as any);
    inserted++;
  }
  return inserted;
}

async function syncFromPbc(): Promise<number> {
  const html = await fetchViaCurl("https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/index.html");
  const items = await parseListPage(html, "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/");
  let inserted = 0;
  for (const it of items) {
    const exists = await db.select({ id: s.policies.id }).from(s.policies)
      .where(sql`source_url = ${it.url}`).limit(1);
    if (exists.length) continue;
    const ts = now();
    await db.insert(s.policies).values({
      id: uid("pol"), title: it.title, summary: cleanSummary(it.title) || it.title,
      department: "中国人民银行", category: classifyPolicy(it.title, "中国人民银行"), status: "published",
      source: SRC_ORG.pbc, sourceUrl: it.url, publishDate: it.pubDate || null,
      tags: JSON.stringify(["央行", "官方发布"]), createdAt: ts, updatedAt: ts,
    } as any);
    inserted++;
  }
  return inserted;
}

export async function syncPoliciesReal(): Promise<{ org: string; inserted: number; error?: string }[]> {
  const jobs: { org: string; fn: () => Promise<number> }[] = [
    { org: "gov", fn: syncFromGov },
    { org: "mof", fn: syncFromMof },
    { org: "ndrc", fn: syncFromNdr },
    { org: "pbc", fn: syncFromPbc },
  ];
  const results: { org: string; inserted: number; error?: string }[] = [];
  for (const j of jobs) {
    try {
      const n = await j.fn();
      results.push({ org: j.org, inserted: n });
    } catch (e: any) {
      results.push({ org: j.org, inserted: 0, error: String(e?.message || e) });
    }
  }
  return results;
}