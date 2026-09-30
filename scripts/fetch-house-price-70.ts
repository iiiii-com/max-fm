/**
 * 抓取国家统计局「70 个大中城市商品住宅销售价格变动情况」月度数据。
 *
 * 为什么走官方发布页而不是新版数据 API：
 * 2026 年 3 月统计局上线新版数据发布库（/dg/website/publicrelease/web/external，
 * 无需鉴权），其「主要城市月度数据」确实含 70 城房价，但**批量取数端点未能定位**
 * （文档路径已 404，13 个候选路径均 404，查询逻辑在懒加载 chunk 中）。
 * 而每月发布页 stats.gov.cn/sj/zxfbhjd/ 的正文表格是同一份官方数据，
 * 公开、结构稳定、可直接解析，且自带完整口径注释。
 * 不去猜 API 端点 —— 猜错会静默返回别的数据，比拿不到更糟。
 *
 * 官方口径（必须随数据一起展示，不能只给数字）：
 *   - 调查范围：各城市的市辖区，不包括县
 *   - 新建商品住宅：全面调查，基础数据为当地房地产管理部门网签数据
 *   - 二手住宅：重点调查 + 典型调查，数据来自经纪机构上报与调查员实地采价
 *   - 2026 年 1 月起以 2025 年为新一轮对比基期
 *
 * 运行：npx tsx scripts/fetch-house-price-70.ts [--dry] [--cached]
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface CityPriceRow {
  city: string;
  newMom: number | null;
  newYoy: number | null;
  usedMom: number | null;
  usedYoy: number | null;
}

export interface PriceSnapshot {
  period: string;
  sourceUrl: string;
  fetchedAt: string;
  rows: CityPriceRow[];
}

/**
 * 解析「呼 和 浩 特 99.7 97.7 97.8」这类行。
 * 官方表格里城市名逐字加空格排版（"呼 和 浩 特"），所以名字部分要允许内部空格，
 * 否则只会匹配到尾部两三个字（曾把呼和浩特解析成"和浩特"）。
 */
function parseTable(text: string): CityPriceRow[] {
  const out: CityPriceRow[] = [];
  const re = /([一-龥](?:\s*[一-龥]){1,4}?)\s+(\d{2,3}\.\d)\s+(\d{2,3}\.\d)\s+(\d{2,3}\.\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const city = m[1].replace(/\s+/g, "");
    // 城市名统一为 2-4 字（不含"市"后缀，官方表就不带）
    if (city.length < 2 || city.length > 4) continue;
    out.push({
      city,
      newMom: Number(m[2]),
      newYoy: Number(m[3]),
      usedMom: null,
      usedYoy: null,
    });
  }
  return out;
}

async function fetchLatest(): Promise<{ url: string; html: string } | null> {
  // 列表页有两个：/sj/zxfb/（最新发布）与 /sj/zxfbhjd/（解读）
  // 「70个大中城市」的正文表格挂在 /sj/zxfb/ 下，且链接是相对路径（./202609/t...html）
  const LIST = "https://www.stats.gov.cn/sj/zxfb/";
  const listRes = await fetch(LIST, { headers: { "User-Agent": UA } });
  const listHtml = await listRes.text();
  const links = [
    ...listHtml.matchAll(
      /href="(\.\/\d{6}\/t\d+_\d+\.html)"[^>]*>([^<]*70个大中城市[^<]*)</g
    ),
  ];
  if (!links.length) return null;
  // 列表页倒序，取最后一个 = 最新一期
  const picked = links[links.length - 1];
  const url = new URL(picked[1], LIST).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  return { url, html: await res.text() };
}

async function main() {
  let html: string;
  let url: string;
  const cache = join(process.cwd(), "data", "house-price-70-raw.html");

  if (existsSync(cache) && process.argv.includes("--cached")) {
    html = readFileSync(cache, "utf8");
    url = "（本地缓存）";
    console.log("使用本地缓存 HTML");
  } else {
    const got = await fetchLatest();
    if (!got) {
      console.log("⚠ 发布列表页未找到「70 个大中城市」文章，未抓取任何数据");
      return;
    }
    html = got.html;
    url = got.url;
    if (!DRY) {
      mkdirSync(join(process.cwd(), "data"), { recursive: true });
      writeFileSync(cache, html, "utf8");
    }
  }

  const pm = html.match(/(\d{4})\s*年\s*(\d{1,2})\s*月份/);
  const period = pm ? `${pm[1]}年${Number(pm[2])}月` : "未知";

  // 表题（"表1：…新建商品住宅销售价格指数"）在 <table> **之外**，
  // 所以不能按表内文字找表 —— 早期版本因此找不到任何表。
  // 正确做法：按 <table> 出现顺序 + 前方最近的表题来判断是哪张表。
  // 页面为移动端/桌面端各渲染一份，因此表成对重复（12 张 = 4 张 ×2）。
  const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

  const tables: Array<{ body: string; caption: string }> = [];
  for (const m of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
    // 表题在 <table> 之前且被 <span> 拆碎（"表"、"1"、正文分属不同 span），
    // 既匹配不到连续的 `表\d`，剥标签后也残留 CSS 片段。
    // 稳定做法：不解析表题结构，只取表前的纯文本窗口，用关键词判断表的种类。
    const before = strip(html.slice(Math.max(0, m.index - 600), m.index));
    tables.push({ body: strip(m[1]), caption: before.slice(-160) });
  }

  const newTbl = tables.find((t) => /新建商品住宅销售价格指数/.test(t.caption) && !/分类/.test(t.caption));
  const usedTbl = tables.find(
    (t) => /二手住宅销售价格指数/.test(t.caption) && !/分类/.test(t.caption)
  );

  if (!newTbl) {
    console.log("⚠ 未定位到表1（新建商品住宅销售价格指数）");
    console.log("   实际表题:", tables.map((t, i) => `[${i}] ${t.caption || "(无)"}`).slice(0, 6).join(" | "));
    return;
  }

  const newRows = parseTable(newTbl.body);
  const usedRows = usedTbl ? parseTable(usedTbl.body) : [];
  const usedByCity = new Map(usedRows.map((r) => [r.city, r]));
  const rows: CityPriceRow[] = newRows.map((r) => {
    const u = usedByCity.get(r.city);
    return { ...r, usedMom: u?.newMom ?? null, usedYoy: u?.newYoy ?? null };
  });

  const snap: PriceSnapshot = { period, sourceUrl: url, fetchedAt: new Date().toISOString(), rows };

  console.log(`数据期: ${period}`);
  console.log(`来源: ${url}`);
  console.log(`新房 ${rows.length} 城 / 二手 ${usedRows.length} 城`);
  console.log("样例:");
  for (const r of rows.slice(0, 8)) {
    console.log(
      `  ${r.city}: 新房环比 ${r.newMom} 同比 ${r.newYoy} | 二手环比 ${r.usedMom ?? "—"} 同比 ${r.usedYoy ?? "—"}`
    );
  }

  if (DRY) {
    console.log("\n(dry-run，未写库)");
    return;
  }
  const outDir = join(process.cwd(), "data", "snapshots");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "house-price-70.json");
  writeFileSync(out, JSON.stringify(snap, null, 2), "utf8");
  console.log(`\n已写入 ${out}`);
}

main();
