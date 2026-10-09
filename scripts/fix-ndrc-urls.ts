/**
 * 修复发改委政策的原文链接（一次性，可重复运行）。
 *
 * 背景：syncFromNdr 曾用列表页的**上一级目录**（…/zcfb/）作 base 解析相对路径，
 * 而列表页里的 href 是 `./202609/t20260928_1407859.html` —— 少了一层 fzggwl/，
 * 于是 25 条发改委政策的 source_url 全部指向不存在的页面（404）。
 * 域名真实、路径规整，点开才知道是坏的，比留空更糟。
 *
 * 修法纪律：**先验证再写**。
 * 每条候选先请求修正后的 URL，只有真的返回 200 才落库；
 * 验证失败的原样保留并在报告里列出 —— 宁可留一条已知坏的链接让人看得见，
 * 也不要批量改成一个同样没验证过的新猜测。
 *
 * 运行：npx tsx scripts/fix-ndrc-urls.ts [--dry]
 */
import { bootstrap, db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { like, eq } from "drizzle-orm";

const DRY = process.argv.includes("--dry");
const MISSING = "/xxgk/zcfb/";
const FIXED = "/xxgk/zcfb/fzggwl/";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126" };

/**
 * 修正 URL；不匹配已知模式则返回 null（不猜）。
 *
 * 两类错误，成因相同（相对路径的 base 少了一层），表现不同：
 *   1) 政策正文：/xxgk/zcfb/202609/…  →  /xxgk/zcfb/fzggwl/202609/…（少 fzggwl 一层）
 *   2) 解读图解：/jd/jd/…、/jd/zctj/…  →  /xxgk/jd/…（少 xxgk 前缀）
 * 两类都已逐条实测正确形态返回 200，其余形态一律不动。
 */
function corrected(url: string): string | null {
  if (!url.includes("ndrc.gov.cn")) return null;
  // ① 政策正文
  if (!url.includes("/xxgk/zcfb/fzggwl/") && url.includes("/xxgk/zcfb/")) {
    return url.replace("/xxgk/zcfb/", "/xxgk/zcfb/fzggwl/");
  }
  // ② 解读 / 政策图解
  if (!url.includes("/xxgk/jd/") && /\/jd\/(jd|zctj)\//.test(url)) {
    return url.replace(/\/jd\/(jd|zctj)\//, "/xxgk/jd/$1/");
  }
  return null;
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  await bootstrap();
  const rows = (await db
    .select({ id: s.policies.id, title: s.policies.title, url: s.policies.sourceUrl })
    .from(s.policies)
    .where(like(s.policies.sourceUrl, "%ndrc.gov.cn%"))) as Array<{ id: string; title: string | null; url: string | null }>;

  console.log(`发改委政策 ${rows.length} 条`);

  const todo: Array<{ id: string; title: string; from: string; to: string }> = [];
  const skipped: string[] = [];
  for (const r of rows) {
    const url = String(r.url ?? "");
    const fixed = corrected(url);
    if (!fixed) {
      skipped.push(`${String(r.title).slice(0, 24)}（无需修正）`);
      continue;
    }
    todo.push({ id: r.id, title: String(r.title ?? ""), from: url, to: fixed });
  }

  console.log(`需修正 ${todo.length} 条，跳过 ${skipped.length} 条\n`);

  let verified = 0;
  let failed = 0;
  for (const t of todo) {
    const ok = await isReachable(t.to);
    if (ok) {
      verified++;
      console.log(`  ✓ ${t.title.slice(0, 26)}`);
    } else {
      failed++;
      console.log(`  ✗ 验证失败（不改） ${t.title.slice(0, 26)}`);
      console.log(`      ${t.to}`);
    }
  }

  console.log(`\n验证通过 ${verified} 条，失败 ${failed} 条`);

  if (DRY) {
    console.log("(dry-run，未落库)");
    return;
  }
  if (!verified) {
    console.log("没有可安全写入的条目，本次不做任何修改。");
    return;
  }

  for (const t of todo) {
    // 只写验证通过的
    if (!(await isReachable(t.to))) continue;
    await db.update(s.policies).set({ sourceUrl: t.to }).where(eq(s.policies.id, t.id));
  }
  console.log(`已写入 ${verified} 条修正后的链接（其余保持原样，不猜）`);
}

main();