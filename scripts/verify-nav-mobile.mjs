/** 移动端导航检查：无下级的板块不应出现展开按钮 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 40000 });
await page.waitForTimeout(3500);
// 打开移动菜单
await page.click('button[aria-label="菜单"]');
await page.waitForTimeout(1200);

const rows = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="移动端导航"]');
  if (!nav) return null;
  return [...nav.querySelectorAll(":scope > div")].map((el) => {
    const link = el.querySelector("a");
    const btn = el.querySelector("button");
    return {
      label: (link?.textContent || "").trim(),
      hasExpand: !!btn,
      expandLabel: btn?.getAttribute("aria-label") || "",
    };
  });
});

console.log("=== 移动端导航 ===");
if (!rows) console.log("  ✗ 未找到移动端导航");
else {
  rows.forEach((r) => console.log("  " + r.label.padEnd(6) + " 展开按钮:" + (r.hasExpand ? "有 (" + r.expandLabel + ")" : "无")));
  const industry = rows.find((r) => r.label === "产业地图");
  console.log("\n  产业地图无展开按钮: " + (industry && !industry.hasExpand ? "✓" : "✗"));
  console.log("  展开按钮总数: " + rows.filter((r) => r.hasExpand).length + " / 板块数 " + rows.length);
}

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log("  横向溢出: " + overflow + "px");
console.log("  控制台: " + (errs.length ? "✗ " + errs[0] : "✓ 无错误"));

await browser.close();
