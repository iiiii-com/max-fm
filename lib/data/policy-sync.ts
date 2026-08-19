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
      if (stdout.length > 1000 && /20\d{4,8}\//.test(stdout)) return stdout;
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

async function parseListPage(html: string, base: string, max = 25): Promise<Array<{
  title: string; pubDate: string; url: string;
}>> {
  const out: any[] = [];
const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,120}?)<\/a>/g)]
    .map((m) => ({ href: m[1], text: stripHtml(m[2]) }))
    .filter((l) => l.text.length > 8 && /20\d{4,17}/.test(l.href) && /\.html/.test(l.href));
  for (const l of links.slice(0, max)) {
    const norm = l.href.replace(/^t?p?p?:\/\//, "").replace(/^\/\//, "");
    const full = norm.startsWith("http") ? norm : new URL(norm, base).href;
    const d = norm.match(/20\d{4,17}/);
    const ds = d ? d[0] : "";
    const pubDate = ds.length >= 6 ? `${ds.slice(0, 4)}-${ds.slice(4, 6)}` : "";
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
      id: uid("pol"), title: it.title, summary: it.summary || it.title,
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
      id: uid("pol"), title: it.title, summary: it.title,
      department: "财政部", category: "部委公告", status: "published",
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
      id: uid("pol"), title: it.title, summary: it.title,
      department: "国家发展改革委", category: "部委公告", status: "published",
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
      id: uid("pol"), title: it.title, summary: it.title,
      department: "中国人民银行", category: "央行公告", status: "published",
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