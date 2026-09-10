/**
 * 测量移动端页面的「区块高度贡献」，定位长页面根因
 * 用法：node scripts/audit-mobile-height.mjs [baseUrl] [path]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const PATH = process.argv[3] || "/market";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(BASE + PATH, { waitUntil: "domcontentloaded", timeout: 40000 });
await page.waitForTimeout(9000);

// 滚到底触发懒加载，再回到顶部
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, 1200));
  await page.waitForTimeout(400);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const total = document.body.scrollHeight;
  // 找出「直接子级区块」的高度贡献：从 main 的一级子节点逐层往下找显著的块
  const main = document.querySelector("main") || document.body;
  const rows = [];
  const walk = (el, depth) => {
    for (const child of el.children) {
      const b = child.getBoundingClientRect();
      const h = child.offsetHeight || b.height;
      if (h < 120) continue;
      rows.push({
        depth,
        tag: child.tagName.toLowerCase(),
        cls: (child.className || "").toString().slice(0, 60),
        h: Math.round(h),
        text: (child.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      });
      if (depth < 7) walk(child, depth + 1);
    }
  };
  walk(main, 0);
  // 只保留「最大且不重复包含」的若干块：按高度降序，去掉被更大块完全包含的
  rows.sort((a, b) => b.h - a.h);
  return { total, rows: rows.slice(0, 18) };
});

console.log(`\n${PATH} 移动端总高度: ${r.total}px\n`);
console.log("高度贡献最大的区块（去重后）：");
r.rows.forEach((x) => {
  const indent = "  ".repeat(x.depth);
  console.log(`${indent}${String(x.h).padStart(6)}px  <${x.tag}> "${x.text}"  [${x.cls}]`);
});

await browser.close();
