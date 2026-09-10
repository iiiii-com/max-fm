/**
 * 受 safeJsonArray / 边界防护改动影响页面的冒烟测试
 * 覆盖：动态路由（policy/industry/history 详情）+ 使用 ContextStrip/StockDrawer 的页面
 */
import { chromium } from "playwright-core";

const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = "http://localhost:3121";

const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function visit(path) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 140));
  });
  let status = 0;
  try {
    const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 40000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(3500);
  } catch (e) {
    console.log(`  ✗ ${path} 访问失败 ${String(e).slice(0, 60)}`);
    await page.close();
    return { status: 0, errs: [] };
  }
  const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
  console.log(`  ${status === 200 ? "✓" : "✗"} ${path.padEnd(38)} HTTP ${status}  控制台: ${real.length ? "✗ " + real[0] : "✓ 无错误"}`);
  await page.close();
  return { status, errs: real };
}

console.log("=== 静态/列表页 ===");
for (const p of ["/", "/policy", "/industry", "/history", "/stock", "/map", "/market", "/macro"]) {
  await visit(p);
}

console.log("\n=== 动态详情页（从列表页取第一个真实链接）===");
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + "/policy", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const policyHref = await page.evaluate(() =>
  [...document.querySelectorAll('a[href^="/policy/"]')].map((a) => a.getAttribute("href")).find((h) => h && h !== "/policy")
);
await page.close();
if (policyHref) await visit(policyHref);
else console.log("  （未找到政策详情链接）");

const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page2.goto(BASE + "/industry", { waitUntil: "domcontentloaded" });
await page2.waitForTimeout(3000);
const industryHref = await page2.evaluate(() =>
  [...document.querySelectorAll('a[href^="/industry/"]')].map((a) => a.getAttribute("href")).find((h) => h && h !== "/industry")
);
await page2.close();
if (industryHref) await visit(industryHref);
else console.log("  （未找到产业链详情链接）");

const page3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page3.goto(BASE + "/history", { waitUntil: "domcontentloaded" });
await page3.waitForTimeout(3000);
const historyHref = await page3.evaluate(() =>
  [...document.querySelectorAll('a[href^="/history/"]')].map((a) => a.getAttribute("href")).find((h) => h && h !== "/history")
);
await page3.close();
if (historyHref) await visit(historyHref);
else console.log("  （未找到历史详情链接）");

await browser.close();
console.log("\n完成");
